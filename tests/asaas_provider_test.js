'use strict'
const assert=require('node:assert/strict')
const {configuration,authorizeNotification,checkoutURL,instant,validatePayment,createAsaasClient}=require('../backend/server/asaas')
const now=Date.parse('2026-11-07T12:00:00.000Z')
const id='88888888-8888-4888-8888-888888888888'
const env={PAYMENT_PROVIDER:'asaas',PAYMENT_ENVIRONMENT:'test',ASAAS_API_KEY:'fixture-api-key-not-real',ASAAS_WEBHOOK_TOKEN:'fixture-webhook-token-not-real-1234567890',ASAAS_ACCOUNT_ID:'77777777-7777-4777-8777-777777777777',ASAAS_WEBHOOK_UTC_OFFSET:'-03:00',ASAAS_INTEGRATION_VERIFIED:'true',PUBLIC_SITE_URL:'https://preview.example.test'}
const local={id:'33333333-3333-4333-8333-333333333333',user_id:'11111111-1111-4111-8111-111111111111',product_id:'rv30',amount_cents:39900,currency:'BRL',provider:'asaas',environment:'test',preference_id:id,status:'pending',payment_id:null}
const remote={id:'pay_fixture123',checkoutSession:id,externalReference:local.id,value:399,billingType:'CREDIT_CARD',status:'CONFIRMED',confirmedDate:'2026-11-07'}
const event={id:'evt_fixture123&123',event:'PAYMENT_CONFIRMED',dateCreated:'2026-11-07 09:00:00',account:{id:env.ASAAS_ACCOUNT_ID},payment:{id:remote.id}}
const options={environment:'test',event,now,offset:'-03:00'}
let passed=0
async function test(name,fn){await fn();passed++;console.log('OK Asaas '+name)}
;(async()=>{
  await test('configuration requires separate sandbox setup, webhook secret and explicit timezone',()=>{
    assert.equal(configuration(env).configured,true)
    for(const key of ['ASAAS_API_KEY','ASAAS_WEBHOOK_TOKEN','ASAAS_ACCOUNT_ID','ASAAS_WEBHOOK_UTC_OFFSET'])assert.equal(configuration({...env,[key]:''}).configured,false)
    assert.equal(configuration({...env,ASAAS_INTEGRATION_VERIFIED:'false'}).configured,false)
  })
  await test('webhook authenticates before any external lookup',async()=>{
    let calls=0
    const client=createAsaasClient({env,fetchImpl:async()=>{calls++;throw new Error('must not call')}})
    for(const token of ['',env.ASAAS_WEBHOOK_TOKEN+'x'])await assert.rejects(()=>client.notification(event,token),error=>error.code==='INVALID_NOTIFICATION')
    assert.throws(()=>authorizeNotification({...event,account:{id:local.user_id}},env.ASAAS_WEBHOOK_TOKEN,env))
    assert.equal(calls,0)
  })
  await test('exact environment, checkout id and allowed redirect path are required',()=>{
    const url=`https://sandbox.asaas.com/checkoutSession/show?id=${id}`
    assert.equal(checkoutURL(url,id,'test'),url)
    assert.equal(checkoutURL(`https://sandbox.asaas.com/checkoutSession/show/${id}`,id,'test'),`https://sandbox.asaas.com/checkoutSession/show/${id}`)
    for(const bad of [url+'&next=https://evil.example',url+'#fragment',url.replace('sandbox.asaas.com','sandbox.asaas.com.evil.example'),url.replace('https:','http:'),url.replace('sandbox.asaas.com','user:secret@sandbox.asaas.com')])assert.equal(checkoutURL(bad,id,'test'),null)
    assert.equal(checkoutURL(url,id,'production'),null)
  })
  await test('approval binds provider, checkout, order, gross amount and payment method',()=>{
    assert.equal(validatePayment(remote,local,options).status,'approved')
    for(const patch of [{value:1},{checkoutSession:local.id},{externalReference:'other'},{billingType:'BOLETO'},{currency:'USD'},{id:'invalid'}])assert.throws(()=>validatePayment({...remote,...patch},local,options))
    for(const patch of [{provider:'stone'},{amount_cents:1},{product_id:'other'},{currency:'USD'},{environment:'production'},{payment_id:'pay_other123'}])assert.throws(()=>validatePayment(remote,{...local,...patch},options))
  })
  await test('original approval date is explicit and a late settlement cannot start another year',()=>{
    assert.equal(validatePayment(remote,local,options).approvedAt,'2026-11-07T12:00:00.000Z')
    const late={...event,event:'PAYMENT_RECEIVED',dateCreated:'2026-12-09 09:00:00'}
    assert.throws(()=>validatePayment(remote,local,{...options,event:late,now:Date.parse('2026-12-09T13:00:00Z')}),error=>error.code==='APPROVAL_REVIEW_REQUIRED')
    assert.equal(validatePayment(remote,{...local,approved_at:'2026-11-07T12:00:00.000Z'},{...options,event:late,now:Date.parse('2026-12-09T13:00:00Z')}).approvedAt,'2026-11-07T12:00:00.000Z')
    assert.equal(instant('2026-11-07 09:00:00',undefined),null)
    assert.equal(instant('2026-02-30 09:00:00','-03:00'),null)
  })
  await test('confirmed refunds and disputes override a paid-looking object; pending refund does not invent approval',()=>{
    for(const status of ['REFUNDED','PARTIALLY_REFUNDED'])assert.equal(validatePayment({...remote,status},local,options).status,'refunded')
    assert.equal(validatePayment({...remote,refunds:[{status:'DONE',value:1}]},local,options).status,'refunded')
    for(const status of ['CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'])assert.equal(validatePayment({...remote,status},local,options).status,'chargeback')
    assert.equal(validatePayment({...remote,status:'REFUND_REQUESTED'},local,options).status,'pending')
    assert.equal(validatePayment({...remote,status:'AUTHORIZED'},local,options).status,'pending')
  })
  await test('hosted checkout offers only Pix/card as a one-off payment and contains server order reference',async()=>{
    let call
    const client=createAsaasClient({env,fetchImpl:async(url,options)=>{call={url,options};return{ok:true,json:async()=>({id})}}})
    const created=await client.createCheckout(local)
    assert.equal(call.url,'https://api-sandbox.asaas.com/v3/checkouts')
    assert.equal(call.options.headers.access_token,env.ASAAS_API_KEY)
    const body=JSON.parse(call.options.body)
    assert.equal(body.externalReference,local.id);assert.deepEqual(body.billingTypes,['PIX','CREDIT_CARD']);assert.deepEqual(body.chargeTypes,['DETACHED'])
    assert.equal(body.items[0].value,399);assert.equal(body.items[0].quantity,1)
    assert.ok(!body.installment&&!body.subscription&&!body.customerData)
    assert.equal(created.url,`https://sandbox.asaas.com/checkoutSession/show?id=${id}`)
  })
  await test('body approval cannot replace current authenticated provider state',async()=>{
    const calls=[]
    const client=createAsaasClient({env,now:()=>now,fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({...remote,status:'PENDING'})}}})
    const found=await client.notification({...event,payment:{id:remote.id,status:'CONFIRMED',value:1}},env.ASAAS_WEBHOOK_TOKEN)
    assert.equal(client.validate(found.remote,local,found.event).status,'pending')
    assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api-sandbox.asaas.com/v3/payments/'+remote.id)
  })
  await test('checkout notifications reject ambiguous payment associations',async()=>{
    const client=createAsaasClient({env,fetchImpl:async()=>({ok:true,json:async()=>({data:[remote,remote]})})})
    await assert.rejects(()=>client.notification({...event,event:'CHECKOUT_PAID',payment:undefined,checkout:{id}},env.ASAAS_WEBHOOK_TOKEN),error=>error.code==='PAYMENT_REVIEW_REQUIRED')
  })
  await test('unknown events are ignored and provider errors disclose no secrets',async()=>{
    const client=createAsaasClient({env,fetchImpl:async()=>{throw new Error(env.ASAAS_API_KEY)}})
    assert.equal((await client.notification({...event,event:'PAYMENT_CREATED'},env.ASAAS_WEBHOOK_TOKEN)).ignored,true)
    await assert.rejects(()=>client.order(remote.id),error=>error.code==='PAYMENT_UNAVAILABLE'&&!error.message.includes(env.ASAAS_API_KEY))
  })
  console.log(`Asaas: ${passed} contratos com respostas simuladas passaram; sem conta, cobrança ou webhook reais.`)
})().catch(error=>{console.error(error);process.exitCode=1})
