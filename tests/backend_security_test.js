'use strict'
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { Readable } = require('node:stream')
const fs = require('node:fs')
const path = require('node:path')
const { createApi, verifySignature, validatePayment, deliveryResult } = require('../backend/server/api')
const USER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const ORDER = '33333333-3333-4333-8333-333333333333'
const PROVIDER_SESSION = '44444444-4444-4444-8444-444444444444'
// Signature validation is the mocked Auth provider's responsibility, not local decoding.
const providerToken = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:USER,session_id:PROVIDER_SESSION})).toString('base64url')}.test-provider-signature`
const origin = 'http://127.0.0.1:8081'
const timestamp = Date.now()
const env = { PUBLIC_SITE_URL:origin, SUPABASE_URL:'https://unit.supabase.co', SUPABASE_ANON_KEY:'public-test', SUPABASE_SERVICE_ROLE_KEY:'service-secret-test', ADMIN_EMAIL:'owner@example.test', MERCADO_PAGO_ACCESS_TOKEN:'provider-secret-test', MERCADO_PAGO_WEBHOOK_SECRET:'webhook-secret-test', MERCADO_PAGO_COLLECTOR_ID:'555', PAYMENT_ENVIRONMENT:'test', PAYMENT_PROVIDER:'mercado_pago' }
const order = { id:ORDER, user_id:USER, buyer_email:'student@example.test', product_id:'rv30', amount_cents:39900, currency:'BRL', environment:'test', status:'approved', payment_id:'123' }
const payment = { id:123, external_reference:ORDER, metadata:{ order_id:ORDER, product_id:'rv30', user_id:USER }, transaction_amount:399, currency_id:'BRL', live_mode:false, collector_id:555, status:'approved', date_last_updated:new Date(timestamp).toISOString() }
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
    if (url.pathname === '/rest/v1/rv30_entitlements') return response(options.access === false ? [] : [{ user_id:USER, product_id:'rv30', status:'active', order_id:ORDER }])
    if (url.pathname === '/rest/v1/rv30_orders') return response([order])
    if (url.pathname === '/rest/v1/rv30_lessons') return response([])
    if (url.pathname === '/rest/v1/rv30_progress') return response([])
    if (url.pathname === '/v1/payments/123') return response(payment)
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
      assert.equal(result.body.salesEnabled,false);assert.equal(result.body.product.priceCents,undefined)
      assert.equal(app.calls.find(call=>call.url.pathname.endsWith('rv30_products')).url.searchParams.get('status'),'eq.active')
    }
    const app=harness({env:{RV30_SALES_ENABLED:'true'},fetch:url=>url.pathname.endsWith('rv30_products')?response([{price_cents:39900,currency:'BRL',commercial_approved:true}]):undefined})
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
  const ts=String(Math.floor(timestamp/1000))
  const signature='ts='+ts+',v1='+crypto.createHmac('sha256',env.MERCADO_PAGO_WEBHOOK_SECRET).update(`id:123;request-id:request-1;ts:${ts};`).digest('hex')
  await test('provider HMAC validates signature, timestamp and request id',async()=>{
    const fields={signature,requestId:'request-1',dataId:'123',secret:env.MERCADO_PAGO_WEBHOOK_SECRET,now:timestamp}
    assert.equal(verifySignature(fields),true)
    assert.equal(verifySignature({...fields,requestId:'forged'}),false)
    assert.equal(verifySignature({...fields,now:timestamp+600000}),false)
    assert.equal(verifySignature({...fields,signature:'ts=1,v1=00'}),false)
  })
  await test('forged webhooks and query/body substitution never query provider',async()=>{
    const app=harness()
    const result=await app.invoke('/api/webhooks/mercado-pago?data.id=123',{method:'POST',body:{type:'payment',data:{id:'456'}},headers:{'x-signature':signature,'x-request-id':'request-1'}})
    assert.equal(result.status,401);assert.equal(app.calls.length,0)
  })
  await test('authentic webhook fetches provider and calls only transactional payment RPC',async()=>{
    const app=harness()
    const result=await app.invoke('/api/webhooks/mercado-pago?data.id=123',{method:'POST',body:{type:'payment',data:{id:'123'}},headers:{'x-signature':signature,'x-request-id':'request-1'}})
    assert.equal(result.status,200)
    const writes=app.calls.filter(call=>call.method==='POST')
    assert.equal(writes.length,1);assert.equal(writes[0].url.pathname,'/rest/v1/rpc/rv30_apply_payment')
    const body=JSON.parse(writes[0].body);assert.equal(body.p_order_id,ORDER);assert.equal(body.p_refund_policy,'review')
  })
  await test('payment validation rejects altered price product buyer environment merchant and currency',async()=>{
    assert.equal(validatePayment(payment,order,'test','555').status,'approved')
    for(const patch of [{transaction_amount:1},{currency_id:'USD'},{live_mode:true},{collector_id:999},{external_reference:OTHER},{metadata:{...payment.metadata,user_id:OTHER}},{metadata:{...payment.metadata,product_id:'other'}},{date_last_updated:'invalid'},{status:'unknown'},{status:'constructor'},{status:'__proto__'},{id:999}]) {
      assert.throws(()=>validatePayment({...payment,...patch},order,'test','555'),/pagamento/)
    }
  })
  await test('provider states include declined canceled refunded and chargeback',async()=>{
    for(const [source,result]of Object.entries({rejected:'declined',cancelled:'canceled',refunded:'refunded',charged_back:'chargeback',in_process:'pending'}))assert.equal(validatePayment({...payment,status:source},order,'test','555').status,result)
  })
  await test('new payment attempt allowed before approval, never replaces a paid or refunded binding',async()=>{
    for(const status of ['pending','declined','canceled'])assert.equal(validatePayment({...payment,id:456},{...order,status},'test','555').paymentId,'456')
    for(const status of ['approved','refunded','chargeback'])assert.throws(()=>validatePayment({...payment,id:456},{...order,status},'test','555'))
  })
  await test('delivery cannot report correct without confirmed payment matching entitlement and all videos',async()=>{
    const args={order,profile:{user_id:USER},entitlement:{status:'active',order_id:ORDER},lessons:Array.from({length:30},(_,i)=>({day:i+1,is_published:true,storage_path:`${i+1}.mp4`})),provider:{available:true,confirmed:true,status:'approved'}}
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
    assert.match(sql,/primary key\(user_id,product_id,environment\)/)
    assert.match(sql,/unique\(user_id,idempotency_key,environment\)/)
    assert.match(sql,/p_provider_updated_at<o.provider_updated_at/)
    assert.match(sql,/rv30_private_objects_guard on storage.objects as restrictive for all to anon,authenticated/)
    assert.match(sql,/rv30_private_bucket_guard on storage.buckets as restrictive for all to anon,authenticated/)
    assert.ok(!/grant (insert|update|delete|all) [^;]+to authenticated/i.test(sql))
    for(const table of ['products','profiles','lessons','orders','entitlements','progress','payment_events'])assert.ok(sql.includes(`alter table public.rv30_${table} enable row level security`))
  })
  console.log(`Backend: ${passed} verificações passaram. Supabase/Postgres e Mercado Pago reais não foram acessados.`)
})().catch(error=>{ console.error(error);process.exitCode=1 })
