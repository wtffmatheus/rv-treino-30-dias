'use strict'
const assert=require('node:assert/strict')
const {configuration,checkoutURL,validateOrder,createStoneClient}=require('../backend/server/stone')
const now=Date.parse('2026-11-07T12:00:00.000Z')
const date=new Date(now).toISOString()
const local={id:'33333333-3333-4333-8333-333333333333',user_id:'11111111-1111-4111-8111-111111111111',buyer_email:'fixture@example.test',provider:'stone',product_id:'rv30',amount_cents:39900,currency:'BRL',environment:'test',status:'pending',payment_id:null}
const remote={id:'or_fixture123',code:local.id,customer:{code:local.user_id},status:'paid',amount:39900,currency:'BRL',updated_at:date,items:[{description:'RV 30',amount:39900,quantity:1}],charges:[{id:'ch_fixture123',amount:39900,currency:'BRL',status:'paid',paid_amount:39900,paid_at:date,updated_at:date}]}
const env={PAYMENT_PROVIDER:'stone',PAYMENT_ENVIRONMENT:'test',STONE_GATEWAY:'stone_pagarme_v5',STONE_INTEGRATION_VERIFIED:'true',STONE_PAGARME_SECRET_KEY:'sk_test_fixture_secret',STONE_PAGARME_ACCOUNT_ID:'acc_fixture123'}
let passed=0
async function test(name,fn){await fn();passed++;console.log('OK Stone '+name)}
;(async()=>{
  await test('generic Stone credentials and missing verification cannot enable the adapter',()=>{
    assert.equal(configuration({PAYMENT_PROVIDER:'stone',STONE_API_KEY:'fixture'}).configured,false)
    assert.equal(configuration({...env,STONE_INTEGRATION_VERIFIED:'false'}).configured,false)
    assert.equal(configuration({...env,PAYMENT_ENVIRONMENT:'production'}).configured,false)
    assert.equal(configuration(env).configured,true)
  })
  await test('checkout allows only the exact hosted link without credentials or extra redirects',()=>{
    assert.equal(checkoutURL('https://payment-link.pagar.me/pl_fixture123','pl_fixture123'),'https://payment-link.pagar.me/pl_fixture123')
    for(const url of ['https://payment-link.pagar.me.evil.test/pl_fixture123','http://payment-link.pagar.me/pl_fixture123','https://user:secret@payment-link.pagar.me/pl_fixture123','https://payment-link.pagar.me/pl_fixture123?redirect=evil','https://payment-link.pagar.me/pl_other123','//payment-link.pagar.me/pl_fixture123'])assert.equal(checkoutURL(url,'pl_fixture123'),null)
  })
  await test('amount product account binding currency and environment cannot be substituted',()=>{
    assert.equal(validateOrder(remote,local,'test',now).status,'approved')
    for(const patch of [{code:'other'},{customer:{code:'other'}},{amount:1},{currency:'USD'},{items:[{description:'Other',amount:39900,quantity:1}]},{items:[{description:'RV 30',amount:39900,quantity:2}]},{charges:[]},{charges:[{...remote.charges[0],paid_amount:1}]},{updated_at:'invalid',charges:[{...remote.charges[0],updated_at:'invalid'}]}])assert.throws(()=>validateOrder({...remote,...patch},local,'test',now))
    for(const patch of [{provider:'mercado_pago'},{amount_cents:50000},{product_id:'other'},{environment:'production'},{payment_id:'or_other123'}])assert.throws(()=>validateOrder(remote,{...local,...patch},'test',now))
  })
  await test('approval requires an actual paid timestamp and forbids future provider dates',()=>{
    for(const charges of [[{...remote.charges[0],paid_at:null}],[{...remote.charges[0],paid_at:new Date(now+600000).toISOString()}],[{...remote.charges[0],updated_at:new Date(now+600000).toISOString()}]])assert.throws(()=>validateOrder({...remote,charges},local,'test',now))
  })
  await test('refunds and chargebacks take priority over a stale paid order status',()=>{
    assert.equal(validateOrder({...remote,charges:[{...remote.charges[0],status:'chargedback'}]},local,'test',now).status,'chargeback')
    assert.equal(validateOrder({...remote,charges:[{...remote.charges[0],status:'canceled',canceled_amount:39900}]},local,'test',now).status,'refunded')
    assert.equal(validateOrder({...remote,status:'canceled'},{...local,status:'approved'},'test',now).status,'refunded')
    assert.equal(validateOrder({...remote,status:'canceled',charges:[{...remote.charges[0],status:'canceled',paid_amount:0,paid_at:null}]},local,'test',now).status,'canceled')
  })
  await test('a notification is only a hint; the authenticated provider response is authoritative',async()=>{
    const calls=[]
    const client=createStoneClient({env,now:()=>now,fetchImpl:async(url,options)=>{
      calls.push({url,options});return{ok:true,json:async()=>remote}
    }})
    const result=await client.notification({id:'hook_fixture123',account:{id:env.STONE_PAGARME_ACCOUNT_ID},event:'order.paid',data:{id:remote.id,status:'refunded',amount:1}})
    assert.equal(client.validate(result.remote,local).status,'approved')
    assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.pagar.me/core/v5/orders/or_fixture123')
    assert.equal(calls[0].options.redirect,'error');assert.match(calls[0].options.headers.Authorization,/^Basic /)
    await assert.rejects(()=>client.notification({id:'hook_fixture123',account:{id:'acc_other123'},event:'order.paid',data:{id:remote.id}}))
    assert.equal(calls.length,1)
  })
  await test('checkout uses sandbox and immutable correlation with exactly one paid session',async()=>{
    let call
    const client=createStoneClient({env,fetchImpl:async(url,options)=>{call={url,options};return{ok:true,json:async()=>({id:'pl_fixture123',url:'https://payment-link.pagar.me/pl_fixture123'})}}})
    await client.createCheckout(local,{name:'Fixture'},'https://preview.example.test')
    assert.equal(call.url,'https://sdx-api.pagar.me/core/v5/paymentlinks')
    const body=JSON.parse(call.options.body)
    assert.equal(body.order_code,local.id);assert.equal(body.max_paid_sessions,1);assert.equal(body.max_sessions,1)
    assert.equal(body.customer_settings.customer.code,local.user_id)
    assert.equal(body.cart_settings.items[0].amount,39900)
    assert.equal(body.type,'order')
  })
  await test('provider errors never disclose tokens or internal messages',async()=>{
    const client=createStoneClient({env,fetchImpl:async()=>{throw new Error(env.STONE_PAGARME_SECRET_KEY)}})
    await assert.rejects(()=>client.order(remote.id),error=>error.code==='STONE_UNAVAILABLE'&&!error.message.includes(env.STONE_PAGARME_SECRET_KEY))
  })
  console.log(`Stone: ${passed} contratos passaram com respostas simuladas; nenhuma cobrança ou conta real foi acessada.`)
})().catch(error=>{console.error(error);process.exitCode=1})
