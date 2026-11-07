'use strict'
const assert = require('node:assert/strict')
const { Readable } = require('node:stream')
const fs = require('node:fs')
const path = require('node:path')
const { createApi, deliveryResult } = require('../backend/server/api')
const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ORDER = '33333333-3333-4333-8333-333333333333'
const PROVIDER_SESSION = '44444444-4444-4444-8444-444444444444'
// Signature validation is the mocked Auth provider's responsibility, not local decoding.
const providerToken = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:USER,session_id:PROVIDER_SESSION})).toString('base64url')}.test-provider-signature`
const origin = 'http://127.0.0.1:8081'
const timestamp = Date.now()
const CHECKOUT='88888888-8888-4888-8888-888888888888'
const date=new Date(timestamp).toISOString()
const env={PUBLIC_SITE_URL:origin,SUPABASE_URL:'https://unit.supabase.co',SUPABASE_ANON_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'service-secret-test',ADMIN_EMAIL:'owner@example.test',PAYMENT_ENVIRONMENT:'test',PAYMENT_PROVIDER:'asaas',ASAAS_API_KEY:'fixture-api-key-not-real',ASAAS_WEBHOOK_TOKEN:'fixture-webhook-token-not-real-1234567890',ASAAS_ACCOUNT_ID:'77777777-7777-4777-8777-777777777777',ASAAS_WEBHOOK_UTC_OFFSET:'-03:00',ASAAS_INTEGRATION_VERIFIED:'true'}
const order={id:ORDER,user_id:USER,buyer_email:'student@example.test',product_id:'rv30',amount_cents:39900,currency:'BRL',environment:'test',status:'approved',provider:'asaas',payment_id:'pay_fixture123',preference_id:CHECKOUT,approved_at:date}
const payment={id:'pay_fixture123',checkoutSession:CHECKOUT,externalReference:ORDER,value:399,billingType:'CREDIT_CARD',status:'CONFIRMED',confirmedDate:date.slice(0,10)}
const notification={id:'evt_fixture123',account:{id:env.ASAAS_ACCOUNT_ID},event:'PAYMENT_CONFIRMED',dateCreated:date,payment:{id:payment.id}}
let passed = 0
async function test(name, run) { await run(); passed++; console.log(`OK ${name}`) }
function response(data, status = 200) { return { ok:status >= 200 && status < 300, json:async () => data, status } }
function harness(options = {}) {
  const calls = []
  const user = options.user || { id:USER, email:'student@example.test', email_confirmed_at:new Date(timestamp).toISOString(), user_metadata:{ role:'admin', name:'Aluno' } }
  let clock = timestamp
  const fetchImpl = async (raw, request = {}) => {
    const url = new URL(raw)
    calls.push({ url, ...request })
    const customized = options.fetch?.(url, request)
    if (customized !== undefined) return customized
    if (url.pathname === '/auth/v1/token') return response({ access_token:providerToken, expires_in:3600 })
    if (url.pathname === '/auth/v1/user') return response(user)
    if (url.pathname === '/rest/v1/rpc/rv30_session_active') return response(true)
    if (url.pathname === '/rest/v1/rv30_profiles') return response(request.method === 'POST' ? null : [{ user_id:USER, name:'Aluno', status:'active' }])
    if (url.pathname === '/rest/v1/rv30_entitlements') return response(options.access === false ? [] : [{ user_id:USER, product_id:'rv30', status:'active', order_id:ORDER,expires_at:new Date(timestamp+86400000).toISOString() }])
    if (url.pathname === '/rest/v1/rv30_orders') return response([order])
    if (url.pathname === '/rest/v1/rv30_lessons') return response([])
    if (url.pathname === '/rest/v1/rv30_progress') return response([])
    if (url.pathname === '/v3/payments/pay_fixture123') return response(payment)
    if (url.pathname === '/rest/v1/rpc/rv30_apply_payment') return response({ result:'applied' })
    return response({})
  }
  const api = createApi({ env:{ ...env,...options.env }, fetchImpl, now:() => clock })
  async function invoke(route, { method = 'GET', body, headers = {}, cookie } = {}) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    Object.assign(req, { url:route, method, headers:{ ...(method !== 'GET' ? { origin,'content-type':'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, socket:{ remoteAddress:'127.0.0.1' } })
    const result = { headers:{} }
    const res = { setHeader:(key,value) => { result.headers[key] = value }, writeHead:(status,head) => { result.status=status; Object.assign(result.headers,head) }, end:body => { result.body=JSON.parse(body || '{}') } }
    result.handled = await api(req,res)
    return result
  }
  async function login() {
    const result = await invoke('/api/auth/login', { method:'POST', body:{ email:user.email, password:'long-test-password' } })
    return { result, cookie:result.headers['Set-Cookie']?.split(';')[0] }
  }
  return { api, calls, invoke, login, setClock:value => { clock=value } }
}

;(async () => {
  await test('unconfigured backend fails closed', async () => {
    const app = harness({ env:{ SUPABASE_SERVICE_ROLE_KEY:'' } })
    assert.equal((await app.invoke('/api/config')).body.configured,false)
    assert.equal((await app.invoke('/api/admin/delivery?orderId='+ORDER)).status,503)
    assert.equal(app.calls.length,0)
  })
  await test('cross-origin mutations rejected before provider calls', async () => {
    const app=harness()
    const result=await app.invoke('/api/auth/login',{method:'POST',body:{},headers:{origin:'https://evil.example'}})
    assert.equal(result.status,403); assert.equal(app.calls.length,0)
  })
  await test('email verification is mandatory, even for configured administrator',async()=>{
    const app=harness({user:{id:USER,email:env.ADMIN_EMAIL,email_confirmed_at:null}})
    const {result,cookie}=await app.login()
    assert.equal(result.status,403); assert.equal(cookie,undefined)
  })
  await test('public registration cannot claim reserved administrator address',async()=>{
    const app=harness()
    const result=await app.invoke('/api/auth/signup',{method:'POST',body:{email:env.ADMIN_EMAIL,password:'long-password-test',name:'Pretend admin',role:'admin'}})
    assert.equal(result.status,200);assert.equal(app.calls.length,0)
    assert.equal(result.headers['Set-Cookie'],undefined)
  })
  await test('opaque HttpOnly cookie and no provider token in response',async()=>{
    const {result,cookie}=await harness().login()
    assert.equal(result.status,200); assert.match(result.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/)
    assert.ok(cookie); assert.ok(!JSON.stringify(result.body).includes(providerToken))
  })
  await test('forged browser session cannot authenticate',async()=>{
    const result=await harness().invoke('/api/account',{cookie:'rv30_session=forged'})
    assert.equal(result.status,401)
  })
  await test('student metadata role and requested user identifier do not grant admin',async()=>{
    const app=harness(); const {cookie}=await app.login()
    const result=await app.invoke('/api/admin/delivery?orderId='+ORDER+'&userId='+OTHER,{cookie})
    assert.equal(result.status,403)
  })
  await test('administrator remains blocked when ADMIN_EMAIL is empty',async()=>{
    const app=harness({env:{ADMIN_EMAIL:''},user:{id:USER,email:'owner@example.test',email_confirmed_at:'2026-01-01'}})
    const {cookie}=await app.login()
    assert.equal((await app.invoke('/api/admin/delivery?orderId='+ORDER,{cookie})).status,403)
  })
  await test('matching verified administrator can diagnose but diagnostic never writes',async()=>{
    const app=harness({user:{id:USER,email:'OWNER@example.test',email_confirmed_at:'2026-01-01'}})
    const {cookie}=await app.login(); app.calls.length=0
    const result=await app.invoke('/api/admin/delivery?orderId='+ORDER,{cookie})
    assert.equal(result.status,200); assert.equal(result.body.result,'pending'); assert.equal(result.body.lessons.missingDays.length,30)
    assert.ok(app.calls.every(call=>!call.method || call.method==='GET' || call.method==='POST' && call.url.pathname==='/rest/v1/rpc/rv30_session_active'))
  })
  await test('student purchase and video access never trust supplied account identifier',async()=>{
    const app=harness({access:false}); const {cookie}=await app.login()
    assert.equal((await app.invoke('/api/courses/rv30/days/1/video?userId='+OTHER,{cookie})).status,403)
    assert.ok(app.calls.some(call=>call.url.pathname.endsWith('rv30_entitlements') && call.url.searchParams.get('user_id')==='eq.'+USER))
  })
  await test('test entitlements are explicitly separated from production',async()=>{
    const app=harness(); const {cookie}=await app.login()
    await app.invoke('/api/courses/rv30',{cookie})
    assert.ok(app.calls.filter(call=>call.url.pathname.endsWith('rv30_entitlements')).every(call=>call.url.searchParams.get('environment')==='eq.test'))
  })
  await test('missing lesson returns a clear pending response without storage request',async()=>{
    const app=harness();const {cookie}=await app.login()
    const result=await app.invoke('/api/courses/rv30/days/12/video',{cookie})
    assert.equal(result.status,404); assert.equal(result.body.code,'VIDEO_PENDING')
    assert.ok(!app.calls.some(call=>call.url.pathname.includes('/storage/')))
  })
  await test('private video signed URL keeps Storage API prefix and contains no service token',async()=>{
    const app=harness({fetch:(url,request)=>{
      if(url.pathname.endsWith('rv30_lessons'))return response([{day:12,is_published:true,storage_path:'aulas/dia12.mp4'}])
      if(url.pathname.includes('/storage/v1/object/sign/'))return response({signedURL:'/object/sign/rv30-videos/aulas/dia12.mp4?token=temporary-signature'})
    }})
    const {cookie}=await app.login()
    const result=await app.invoke('/api/courses/rv30/days/12/video',{cookie})
    assert.equal(result.status,200)
    assert.match(result.body.url,/^https:\/\/unit\.supabase\.co\/storage\/v1\/object\/sign\//)
    assert.ok(!JSON.stringify(result.body).includes('service-secret-test'))
  })
  await test('another student order is hidden by server ownership filter',async()=>{
    const app=harness({fetch:url=>url.pathname.endsWith('rv30_orders') ? response([]) : undefined});const {cookie}=await app.login()
    assert.equal((await app.invoke('/api/orders/'+ORDER+'?userId='+OTHER,{cookie})).status,404)
    assert.equal(app.calls.find(call=>call.url.pathname.endsWith('rv30_orders')).url.searchParams.get('user_id'),'eq.'+USER)
    assert.equal(app.calls.find(call=>call.url.pathname.endsWith('rv30_orders')).url.searchParams.get('environment'),'eq.test')
  })
  await test('sales stay disabled by default with existing provider credentials',async()=>{
    const app=harness();const {cookie}=await app.login()
    assert.equal((await app.invoke('/api/config')).body.salesEnabled,false)
    assert.equal((await app.invoke('/api/orders',{method:'POST',body:{productId:'rv30',amountCents:1,userId:OTHER},cookie})).status,503)
  })
  await test('sales config requires approved active commercial product in protected database',async()=>{
    for(const product of [null,{price_cents:39900,currency:'BRL',commercial_approved:false},{price_cents:null,currency:'BRL',commercial_approved:true},{price_cents:39900,currency:'USD',commercial_approved:true}]){
      const app=harness({env:{RV30_SALES_ENABLED:'true'},fetch:url=>url.pathname.endsWith('rv30_products')?response(product?[product]:[]):undefined})
      const result=await app.invoke('/api/config')
      assert.equal(result.body.salesEnabled,false);assert.equal(result.body.product.priceCents,39900)
      assert.equal(app.calls.find(call=>call.url.pathname.endsWith('rv30_products')).url.searchParams.get('status'),'eq.active')
    }
    const app=harness({env:{RV30_SALES_ENABLED:'true'},fetch:url=>url.pathname.endsWith('rv30_products')?response([{price_cents:39900,currency:'BRL',provider:'asaas',access_days:365,commercial_approved:true}]):undefined})
    const result=await app.invoke('/api/config')
    assert.equal(result.body.salesEnabled,true);assert.equal(result.body.product.priceCents,39900)
  })
  await test('commercial database outage keeps config honest and does not expose internal error',async()=>{
    const app=harness({env:{RV30_SALES_ENABLED:'true'},fetch:url=>url.pathname.endsWith('rv30_products')?response({message:'private database diagnostic'},503):undefined})
    const result=await app.invoke('/api/config')
    assert.equal(result.status,200);assert.equal(result.body.configured,true);assert.equal(result.body.salesEnabled,false)
    assert.ok(!JSON.stringify(result.body).includes('private database diagnostic'))
  })
  await test('session expiry is enforced on server',async()=>{
    const app=harness();const {cookie}=await app.login();app.setClock(timestamp+3601000)
    assert.equal((await app.invoke('/api/account',{cookie})).status,401)
  })
  await test('logout removes server session and clears cookie',async()=>{
    const app=harness();const {cookie}=await app.login()
    const result=await app.invoke('/api/auth/logout',{method:'POST',body:{},cookie})
    assert.match(result.headers['Set-Cookie'],/Max-Age=0/)
    assert.equal((await app.invoke('/api/account',{cookie})).status,401)
  })
  await test('revoked upstream identity invalidates local session',async()=>{
    let revoked=false
    const app=harness({fetch:url=>revoked&&url.pathname==='/auth/v1/user' ? response({message:'secret diagnostic'},401):undefined})
    const {cookie}=await app.login(); revoked=true
    const result=await app.invoke('/api/account',{cookie})
    assert.equal(result.status,401);assert.ok(!JSON.stringify(result.body).includes('secret diagnostic'))
  })
  await test('revoked Auth session is rejected even when getUser still accepts the access token',async()=>{
    let revoked=false
    const app=harness({fetch:url=>revoked&&url.pathname==='/rest/v1/rpc/rv30_session_active'?response(false):undefined})
    const {cookie}=await app.login();revoked=true
    const result=await app.invoke('/api/account',{cookie})
    assert.equal(result.status,401);assert.equal(result.body.code,'SESSION_INVALID')
    const lookup=app.calls.filter(call=>call.url.pathname==='/rest/v1/rpc/rv30_session_active').at(-1)
    assert.deepEqual(JSON.parse(lookup.body),{p_session_id:PROVIDER_SESSION,p_user_id:USER})
    assert.equal((await app.invoke('/api/account',{cookie})).status,401)
  })
  await test('provider-validated JWT without session claim cannot create a session',async()=>{
    const app=harness({fetch:url=>url.pathname==='/auth/v1/token'?response({access_token:`e30.${Buffer.from(JSON.stringify({sub:USER})).toString('base64url')}.test`,expires_in:3600}):undefined})
    const {result,cookie}=await app.login()
    assert.equal(result.status,401);assert.equal(cookie,undefined)
  })
  await test('authentication rate limit stops repeated sensitive requests',async()=>{
    const app=harness()
    let result
    for(let i=0;i<11;i++)result=await app.invoke('/api/auth/login',{method:'POST',body:{email:'bad'}})
    assert.equal(result.status,429)
  })
  await test('GET email previews cannot consume confirmation or recovery credentials',async()=>{
    const app=harness()
    await app.invoke('/api/auth/verify?tokenHash=never-consume&type=recovery')
    assert.ok(!app.calls.some(call=>call.url.pathname==='/auth/v1/verify'))
  })
  await test('old provider route cannot approve an order',async()=>{
    const app=harness()
    const result=await app.invoke('/api/webhooks/mercado-pago',{method:'POST',body:{status:'approved'},headers:{origin:'https://evil.example'}})
    assert.equal(result.status,403);assert.equal(app.calls.length,0)
  })
  await test('Asaas webhook looks up current provider state and calls only payment transaction',async()=>{
    const app=harness()
    const result=await app.invoke('/api/webhooks/asaas',{method:'POST',body:notification,headers:{'asaas-access-token':env.ASAAS_WEBHOOK_TOKEN}})
    assert.equal(result.status,200)
    const writes=app.calls.filter(call=>call.method==='POST')
    assert.equal(writes.length,1);assert.equal(writes[0].url.pathname,'/rest/v1/rpc/rv30_apply_payment')
    const body=JSON.parse(writes[0].body);assert.equal(body.p_order_id,ORDER);assert.equal(body.p_refund_policy,'revoke');assert.equal(body.p_approved_at,date)
    assert.ok(app.calls.some(call=>call.url.pathname==='/v3/payments/'+payment.id))
  })
  await test('malformed Asaas notification never consults the provider or grants access',async()=>{
    const app=harness()
    assert.equal((await app.invoke('/api/webhooks/asaas',{method:'POST',body:{...notification,account:{id:OTHER}},headers:{'asaas-access-token':env.ASAAS_WEBHOOK_TOKEN}})).status,401)
    assert.equal(app.calls.length,0)
  })
  await test('client webhook approval cannot replace pending provider state',async()=>{
    const app=harness({fetch:url=>url.pathname==='/v3/payments/'+payment.id?response({...payment,status:'PENDING'}):undefined})
    const result=await app.invoke('/api/webhooks/asaas',{method:'POST',body:{...notification,payment:{id:payment.id,status:'CONFIRMED',value:1}},headers:{'asaas-access-token':env.ASAAS_WEBHOOK_TOKEN}})
    assert.equal(result.status,200)
    const rpc=app.calls.find(call=>call.url.pathname==='/rest/v1/rpc/rv30_apply_payment')
    assert.equal(JSON.parse(rpc.body).p_status,'pending')
  })
  await test('delivery cannot report correct without confirmed payment matching entitlement and all videos',async()=>{
    const args={order,profile:{user_id:USER},entitlement:{status:'active',order_id:ORDER,expires_at:new Date(timestamp+86400000).toISOString()},lessons:Array.from({length:30},(_,i)=>({day:i+1,is_published:true,storage_path:`${i+1}.mp4`})),provider:{available:true,confirmed:true,status:'approved'}}
    assert.equal(deliveryResult(args).result,'correct')
    assert.equal(deliveryResult({...args,entitlement:{status:'active',order_id:OTHER}}).result,'error')
    assert.equal(deliveryResult({...args,profile:{user_id:USER,status:'blocked'}}).result,'error')
    assert.equal(deliveryResult({...args,lessons:args.lessons.map(row=>({...row,storage_verified:false}))}).result,'pending')
    assert.equal(deliveryResult({...args,provider:{available:false,confirmed:false}}).result,'pending')
  })
  await test('migration exposes no payment grant or write to browser roles and locks updates atomically',async()=>{
    const sql=fs.readFileSync(path.join(__dirname,'../backend/migrations/20261025_rv30_secure_foundation.sql'),'utf8')
    assert.match(sql,/for update;/);assert.match(sql,/event_result:='stale'/);assert.match(sql,/terminal_ignored/)
    assert.match(sql,/revoke all on function public\.rv30_apply_payment[^;]+from public,anon,authenticated/)
    assert.match(sql,/revoke all on function public\.rv30_session_active\(uuid,uuid\) from public,anon,authenticated/)
    assert.match(sql,/from auth.sessions where id=p_session_id and user_id=p_user_id/)
    assert.match(sql,/and \(not_after is null or not_after > now\(\)\)/, 'Auth rows may remain after the time-box expires; existence alone must not authorize them')
    assert.match(sql,/primary key\(user_id,product_id,environment\)/)
    assert.match(sql,/unique\(user_id,idempotency_key,environment\)/)
    assert.match(sql,/p_provider_updated_at<o.provider_updated_at/)
    assert.match(sql,/rv30_private_objects_guard on storage.objects as restrictive for all to anon,authenticated/)
    assert.match(sql,/rv30_private_bucket_guard on storage.buckets as restrictive for all to anon,authenticated/)
    assert.ok(!/grant (insert|update|delete|all) [^;]+to authenticated/i.test(sql))
    for(const table of ['products','profiles','lessons','orders','entitlements','progress','payment_events'])assert.ok(sql.includes(`alter table public.rv30_${table} enable row level security`))
  })
  await test('365-day boundary removes account entitlement and blocks course video and progress',async()=>{
    const expiry=new Date(timestamp+1000).toISOString()
    const app=harness({fetch:url=>url.pathname.endsWith('rv30_entitlements')?response([{product_id:'rv30',status:'active',order_id:ORDER,expires_at:expiry}]):undefined})
    const {cookie}=await app.login();app.setClock(timestamp+1000)
    assert.deepEqual((await app.invoke('/api/account',{cookie})).body.account.entitlements,[])
    for(const route of ['/api/courses/rv30','/api/courses/rv30/days/12/video'])assert.equal((await app.invoke(route,{cookie})).status,403)
    assert.equal((await app.invoke('/api/courses/rv30/progress/12',{method:'PUT',cookie,body:{complete:true}})).status,403)
    assert.ok(!app.calls.some(call=>call.url.pathname.includes('/storage/')))
  })
  await test('missing expiry fails closed instead of granting indefinite legacy access',async()=>{
    const app=harness({fetch:url=>url.pathname.endsWith('rv30_entitlements')?response([{product_id:'rv30',status:'active',order_id:ORDER}]):undefined})
    const {cookie}=await app.login()
    assert.equal((await app.invoke('/api/courses/rv30',{cookie})).status,403)
  })
  await test('requested playback URL TTL is capped by the remaining access period',async()=>{
    const app=harness({fetch:url=>{
      if(url.pathname.endsWith('rv30_entitlements'))return response([{product_id:'rv30',status:'active',order_id:ORDER,expires_at:new Date(timestamp+2000).toISOString()}])
      if(url.pathname.endsWith('rv30_lessons'))return response([{day:12,is_published:true,storage_path:'12.mp4'}])
      if(url.pathname.includes('/storage/v1/object/sign/'))return response({signedURL:'/object/sign/rv30-videos/12.mp4?token=fixture'})
    }})
    const {cookie}=await app.login()
    const result=await app.invoke('/api/courses/rv30/days/12/video',{cookie})
    assert.equal(result.status,200);assert.equal(result.body.expiresIn,2)
    assert.equal(JSON.parse(app.calls.find(call=>call.url.pathname.includes('/storage/')).body).expiresIn,2)
  })
  const product={id:'rv30',price_cents:39900,currency:'BRL',provider:'asaas',access_days:365,commercial_approved:true}
  await test('active access prevents a second checkout before any Asaas request',async()=>{
    const app=harness({env:{RV30_SALES_ENABLED:'true'},fetch:url=>url.pathname.endsWith('rv30_products')?response([product]):undefined})
    const {cookie}=await app.login()
    assert.equal((await app.invoke('/api/orders',{method:'POST',cookie,body:{productId:'rv30'},headers:{'idempotency-key':'fixture-idempotent-request'}})).status,409)
    assert.ok(!app.calls.some(call=>call.url.hostname.endsWith('asaas.com')))
  })
  await test('Asaas checkout is created once for the authenticated buyer and redirects through an owned order',async()=>{
    let saved={...order,status:'pending',payment_id:null,checkout_url:null,preference_id:null}
    let claimed=false
    const app=harness({access:false,env:{RV30_SALES_ENABLED:'true'},fetch:(url,request)=>{
      if(url.pathname.endsWith('rv30_products'))return response([product])
      if(url.pathname.endsWith('rv30_orders')){
        if(request.method==='PATCH')saved={...saved,...JSON.parse(request.body)}
        return response([saved])
      }
      if(url.pathname.endsWith('rpc/rv30_claim_checkout')){const value=!claimed;claimed=true;return response(value)}
      if(url.pathname==='/v3/checkouts')return response({id:CHECKOUT,link:'https://sandbox.asaas.com/checkoutSession/show?id='+CHECKOUT})
    }})
    const {cookie}=await app.login()
    const request={method:'POST',cookie,body:{productId:'rv30',amountCents:1,userId:OTHER},headers:{'idempotency-key':'fixture-idempotent-request'}}
    const first=await app.invoke('/api/orders',request)
    assert.equal(first.status,200);assert.equal(first.body.order.amountCents,39900)
    assert.equal(first.body.order.checkoutUrl,`/api/orders/${ORDER}/checkout`)
    assert.equal((await app.invoke('/api/orders',request)).status,200)
    assert.equal(app.calls.filter(call=>call.url.pathname==='/v3/checkouts').length,1)
    const checkout=await app.invoke(`/api/orders/${ORDER}/checkout`,{cookie})
    assert.equal(checkout.status,303);assert.equal(checkout.headers.Location,'https://sandbox.asaas.com/checkoutSession/show?id='+CHECKOUT)
    saved.checkout_url='https://evil.example/checkout'
    assert.equal((await app.invoke(`/api/orders/${ORDER}/checkout`,{cookie})).status,409)
  })
  await test('uncertain provider creation cannot issue a second link on retry',async()=>{
    let claimed=false
    const app=harness({access:false,env:{RV30_SALES_ENABLED:'true'},fetch:(url)=>{
      if(url.pathname.endsWith('rv30_products'))return response([product])
      if(url.pathname.endsWith('rv30_orders'))return response([{...order,status:'pending',payment_id:null,checkout_url:null}])
      if(url.pathname.endsWith('rpc/rv30_claim_checkout')){const value=!claimed;claimed=true;return response(value)}
      if(url.pathname==='/v3/checkouts')throw new Error('private provider diagnostic')
    }})
    const {cookie}=await app.login()
    const request={method:'POST',cookie,body:{productId:'rv30'},headers:{'idempotency-key':'fixture-idempotent-request'}}
    const first=await app.invoke('/api/orders',request)
    assert.equal(first.status,503);assert.ok(!JSON.stringify(first.body).includes('private provider diagnostic'))
    assert.equal((await app.invoke('/api/orders',request)).status,409)
    assert.equal(app.calls.filter(call=>call.url.pathname==='/v3/checkouts').length,1)
  })
  await test('a stale active entitlement cannot override an unpaid refunded or mismatched purchase',async()=>{
    for(const patch of [{status:'pending'},{status:'refunded'},{status:'chargeback'},{user_id:OTHER},{environment:'production'},{amount_cents:1},{manual_review:true},{approved_at:null}]){
      const app=harness({fetch:url=>url.pathname.endsWith('rv30_orders')?response([{...order,...patch}]):undefined})
      const {cookie}=await app.login()
      const account=await app.invoke('/api/account',{cookie})
      assert.deepEqual(account.body.account.entitlements,[])
      assert.equal(account.body.account.access[0].status,'pending_review')
      for(const path of ['/api/courses/rv30','/api/courses/rv30/days/1/video'])assert.equal((await app.invoke(path,{cookie})).status,403)
      assert(!app.calls.some(call=>call.url.pathname.includes('/storage/v1/')))
    }
  })
  await test('a paid buyer receives only a short-lived verified R2 object URL and no catalog storage keys',async()=>{
    const lesson={day:1,title:'Test',description:'Test',is_published:true,storage_provider:'r2',storage_path:'rv30/dia-01/'+'b'.repeat(64)+'.mp4',storage_bytes:100,storage_etag:'c'.repeat(32)}
    const r2Env={R2_ACCOUNT_ID:'a'.repeat(32),R2_BUCKET_NAME:'rv30-videos-private',R2_ACCESS_KEY_ID:'fixtureAccessKey123456',R2_SECRET_ACCESS_KEY:'fixtureSecretKeyNotReal12345678901234567890'}
    const app=harness({env:r2Env,fetch:(url,req)=>{
      if(url.pathname.endsWith('rv30_lessons'))return response([lesson])
      if(url.hostname.endsWith('.r2.cloudflarestorage.com')){assert.equal(req.method,'HEAD');return{ok:true,headers:new Headers({'Content-Type':'video/mp4','Content-Length':'100',ETag:'"'+lesson.storage_etag+'"'})}}
    }})
    assert.equal((await app.invoke('/api/courses/rv30/days/1/video')).status,401)
    const {cookie}=await app.login()
    const catalog=await app.invoke('/api/courses/rv30',{cookie})
    assert.equal(catalog.body.lessons[0].available,true);assert(!JSON.stringify(catalog.body).includes(lesson.storage_path));assert(!JSON.stringify(catalog.body).includes(lesson.storage_etag))
    const video=await app.invoke('/api/courses/rv30/days/1/video',{cookie})
    assert.equal(video.status,200);assert.equal(video.body.expiresIn,120)
    const url=new URL(video.body.url);assert.equal(url.searchParams.get('X-Amz-Expires'),'120');assert.equal(url.hostname,r2Env.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com')
    assert(!JSON.stringify(video.body).includes(r2Env.R2_SECRET_ACCESS_KEY))
    assert.equal(app.calls.filter(call=>call.url.hostname.endsWith('.r2.cloudflarestorage.com')).length,1)
    const unavailable=harness({env:r2Env,fetch:url=>url.pathname.endsWith('rv30_lessons')?response([{...lesson,storage_path:lesson.storage_path.replace('dia-01','dia-02')}]):undefined})
    const auth=await unavailable.login();assert.equal((await unavailable.invoke('/api/courses/rv30/days/1/video',{cookie:auth.cookie})).status,503)
    let refunded=false
    const revoked=harness({env:r2Env,fetch:(url)=>{
      if(url.pathname.endsWith('rv30_lessons'))return response([lesson])
      if(url.pathname.endsWith('rv30_orders'))return response([{...order,status:refunded?'refunded':'approved'}])
      if(url.hostname.endsWith('.r2.cloudflarestorage.com')){refunded=true;return{ok:true,headers:new Headers({'Content-Type':'video/mp4','Content-Length':'100',ETag:'"'+lesson.storage_etag+'"'})}}
    }})
    const session=await revoked.login();const refused=await revoked.invoke('/api/courses/rv30/days/1/video',{cookie:session.cookie});assert.equal(refused.status,403);assert(!refused.body.url)
  })
  console.log(`Backend: ${passed} verificações passaram. Supabase, R2 e Asaas reais não foram acessados nesta suíte.`)
})().catch(error=>{ console.error(error);process.exitCode=1 })
