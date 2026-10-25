'use strict'

// No secrets, provider tokens or session identifiers are returned to JavaScript.
const crypto = require('node:crypto')
/** @typedef {'pending'|'approved'|'declined'|'canceled'|'refunded'|'chargeback'} PaymentStatus */
/** @typedef {'test'|'production'} PaymentEnvironment */
/**
 * @typedef {object} Order
 * @property {string} id
 * @property {string} user_id
 * @property {string} buyer_email
 * @property {string} product_id
 * @property {number} amount_cents
 * @property {string} currency
 * @property {PaymentEnvironment} environment
 * @property {PaymentStatus} status
 * @property {string|null} [payment_id]
 * @property {string|null} [checkout_url]
 * @property {boolean} [manual_review]
 */
/**
 * @typedef {object} ProviderPayment
 * @property {number|string} id
 * @property {string} external_reference
 * @property {{order_id?:string,product_id?:string,user_id?:string}} [metadata]
 * @property {number|string} transaction_amount
 * @property {string} currency_id
 * @property {boolean} live_mode
 * @property {number|string} collector_id
 * @property {string} status
 * @property {string} date_last_updated
 */
/** @typedef {{user_id:string,name?:string,status?:'active'|'blocked'|'pending'}} Profile */
/** @typedef {{order_id:string,status:'active'|'revoked'|'expired'}} Entitlement */
/** @typedef {{day:number,title?:string,description?:string,is_published:boolean,storage_path?:string|null,storage_verified?:boolean}} Lesson */
/** @typedef {{available:boolean,confirmed:boolean,status:PaymentStatus|null,mismatch?:boolean}} ProviderDiagnostic */
/** @typedef {{token:string,userId:string,expiresAt:number}} Session */
/** @typedef {{id:string,email:string,email_confirmed_at:string|null,banned_until?:string|null,user_metadata?:{name?:string}}} AuthUser */
/** @typedef {import('node:http').IncomingMessage} IncomingRequest */
/** @typedef {import('node:http').ServerResponse} OutgoingResponse */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const emailOf = value => String(value || '').trim().toLowerCase()
/** @type {Record<string,PaymentStatus>} */
const paymentStates = { pending:'pending', in_process:'pending', authorized:'pending', approved:'approved', rejected:'declined', cancelled:'canceled', refunded:'refunded', charged_back:'chargeback' }
class ApiError extends Error {
  /** @param {number} status @param {string} code @param {string} message */
  constructor(status, code, message) { super(message); this.status=status; this.code=code }
}
/** @param {number} status @param {string} code @param {string} message @returns {never} */
const fail = (status, code, message) => { throw new ApiError(status, code, message) }

/** @param {{signature:string,requestId:string,dataId:string,secret:string,now?:number}} input */
function verifySignature({ signature, requestId, dataId, secret, now = Date.now() }) {
  if (!secret || !requestId || !/^[a-zA-Z0-9_-]{1,120}$/.test(String(dataId || ''))) return false
  const fields = Object.fromEntries(String(signature || '').split(',').map(part => part.trim().split('=')))
  if (!/^\d{10,13}$/.test(fields.ts || '') || !/^[a-f0-9]{64}$/i.test(fields.v1 || '')) return false
  const milliseconds = fields.ts.length === 13 ? Number(fields.ts) : Number(fields.ts) * 1000
  if (Math.abs(now - milliseconds) > 5 * 60 * 1000) return false
  const canonical = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${fields.ts};`
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest()
  return crypto.timingSafeEqual(expected, Buffer.from(fields.v1, 'hex'))
}

/** @param {ProviderPayment} payment @param {Order} order @param {PaymentEnvironment} environment @param {string} collectorId */
function validatePayment(payment, order, environment, collectorId) {
  const status = Object.hasOwn(paymentStates,payment.status) ? paymentStates[payment.status] : undefined
  const amount = Number(payment.transaction_amount)
  const checks = [
    status,
    String(payment.external_reference) === order.id,
    payment.metadata?.order_id === order.id,
    payment.metadata?.product_id === order.product_id,
    payment.metadata?.user_id === order.user_id,
    payment.currency_id === order.currency,
    Number.isFinite(amount) && Math.abs(amount * 100 - order.amount_cents) < 0.00001,
    payment.live_mode === (environment === 'production'),
    order.environment === environment,
    String(payment.collector_id) === String(collectorId),
    (!order.payment_id || String(payment.id) === order.payment_id || ['pending','declined','canceled'].includes(order.status)),
    Number.isFinite(Date.parse(payment.date_last_updated))
  ]
  if (checks.some(check => !check)) fail(422, 'PAYMENT_MISMATCH', 'O pagamento não corresponde ao pedido, comprador, produto, valor ou ambiente esperado.')
  return { status, paymentId: String(payment.id), updatedAt: payment.date_last_updated }
}

/** @param {{order:Order,profile:Profile|null,entitlement:Entitlement|null,lessons:Lesson[],provider:ProviderDiagnostic}} input */
function deliveryResult({ order, profile, entitlement, lessons, provider }) {
  const availableDays = new Set(lessons.filter(row => row.is_published && row.storage_path && row.storage_verified !== false && Number.isInteger(row.day) && row.day >= 1 && row.day <= 30).map(row => row.day))
  const missingDays = Array.from({ length:30 }, (_, i) => i + 1).filter(day => !availableDays.has(day))
  const reasons = []
  if (order.product_id !== 'rv30') reasons.push('O pedido não pertence ao RV 30.')
  if (!profile || profile.user_id !== order.user_id) reasons.push('A conta vinculada ao pedido não foi localizada.')
  else if (profile.status && profile.status !== 'active') reasons.push('A conta vinculada ao pedido está bloqueada ou pendente.')
  if (!provider.available) reasons.push('Confirmação atual do provedor indisponível; o status local não substitui esta consulta.')
  else if (!provider.confirmed) reasons.push('O provedor não confirmou um pagamento aprovado correspondente ao pedido.')
  if (order.status !== 'approved') reasons.push(`Pedido com status ${order.status}.`)
  if (order.manual_review) reasons.push('Reembolso ou contestação aguardando definição da política comercial de acesso.')
  if (!entitlement || entitlement.status !== 'active' || entitlement.order_id !== order.id) reasons.push('Direito de acesso ativo e vinculado a este pedido não encontrado.')
  if (missingDays.length) reasons.push(`${missingDays.length} dia(s) ainda sem vídeo privado publicado.`)
  const error = order.product_id !== 'rv30' || !profile || profile.user_id !== order.user_id || profile.status && profile.status !== 'active' || provider.mismatch || (order.status === 'approved' && (!entitlement || entitlement.status !== 'active' || entitlement.order_id !== order.id))
  return { ok:true, result:reasons.length ? (error ? 'error' : 'pending') : 'correct', reasons,
    order:{ id:order.id, courseId:order.product_id, status:order.status, amountCents:order.amount_cents, currency:order.currency, environment:order.environment },
    product:{ id:'rv30', title:'RV 30' }, account:profile ? { id:order.user_id, email:order.buyer_email } : null,
    provider, entitlement:{ exists:Boolean(entitlement), status:entitlement?.status || 'missing' },
    lessons:{ expected:30, available:availableDays.size, missingDays }
  }
}

/** @param {{env?:Record<string,string|undefined>,fetchImpl?:typeof fetch,now?:()=>number}} [options] */
function createApi({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let origin = ''
  try { origin = new URL(env.PUBLIC_SITE_URL).origin } catch {}
  const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY && /^https?:\/\//.test(origin))
  const production = env.NODE_ENV === 'production'
  /** @type {PaymentEnvironment} */
  const environment = env.PAYMENT_ENVIRONMENT === 'production' ? 'production' : 'test'
  /** @type {Map<string,Session>} */
  const sessions = new Map()
  /** @type {Map<string,{count:number,until:number}>} */
  const attempts = new Map()
  const cookieName = production ? '__Host-rv30_session' : 'rv30_session'
  const adminEmail = emailOf(env.ADMIN_EMAIL)
  const paymentReady = () => configured && env.PAYMENT_PROVIDER === 'mercado_pago' && Boolean(env.MERCADO_PAGO_ACCESS_TOKEN && env.MERCADO_PAGO_WEBHOOK_SECRET && env.MERCADO_PAGO_COLLECTOR_ID) && env.RV30_SALES_ENABLED === 'true'

  /** @param {OutgoingResponse} res @param {number} status @param {unknown} body */
  function send(res, status, body) {
    res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY' })
    res.end(JSON.stringify(body))
  }
  /** @param {IncomingRequest} req @param {string} category @param {number} maximum */
  function limit(req, category, maximum) {
    // Trust the socket only. Do not accept an arbitrary X-Forwarded-For as identity.
    const key = `${category}:${req.socket?.remoteAddress || 'unknown'}`
    const current = now()
    for (const [item, row] of attempts) if (row.until <= current) attempts.delete(item)
    let entry = attempts.get(key)
    if (!entry) { entry = { count:0, until:current + 60000 }; attempts.set(key, entry) }
    if (++entry.count > maximum || attempts.size > 10000) fail(429, 'RATE_LIMIT', 'Muitas tentativas. Aguarde um minuto.')
  }
  /** @param {IncomingRequest} req @returns {Promise<Record<string, any>>} Parsed JSON is validated at each route boundary. */
  async function readBody(req) {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'JSON_REQUIRED', 'Envie um formulário válido.')
    let size = 0
    const chunks = []
    for await (const chunk of req) {
      size += chunk.length
      if (size > 16384) fail(413, 'BODY_TOO_LARGE', 'Solicitação muito extensa.')
      chunks.push(chunk)
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error()
      return result
    } catch { fail(400, 'INVALID_JSON', 'Solicitação inválida.') }
  }
  /** @param {string} url @param {RequestInit} [options] @returns {Promise<any>} External JSON is validated by the consuming route. */
  async function request(url, options = {}) {
    let response
    try { response = await fetchImpl(url, { ...options, signal:AbortSignal.timeout(10000), redirect:'error' }) }
    catch { fail(503, 'UPSTREAM_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.') }
    let data
    try { data = await response.json() } catch { data = null }
    if (!response.ok) fail(503, 'UPSTREAM_REJECTED', 'Não foi possível concluir a operação no serviço configurado.')
    return data
  }
  /** @param {string} route @param {RequestInit} [options] @param {string} [token] */
  async function authRequest(route, options = {}, token) {
    return request(`${env.SUPABASE_URL}/auth/v1/${route}`, { ...options, headers:{ apikey:env.SUPABASE_ANON_KEY, 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...options.headers } })
  }
  /** @param {string} table @param {Record<string,string>} [query] @param {{method?:string,body?:unknown,prefer?:string}} [options] */
  async function db(table, query = {}, { method = 'GET', body, prefer } = {}) {
    return request(`${env.SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      method, headers:{ apikey:env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', Prefer:prefer || 'return=representation' },
      ...(body === undefined ? {} : { body:JSON.stringify(body) })
    })
  }
  const first = rows => Array.isArray(rows) ? rows[0] : null
  /**
   * Read the session claim only AFTER Supabase Auth has validated this provider token.
   * This is not local verification of a browser-supplied JWT.
   * @param {string} token @param {string} userId
   */
  async function confirmProviderSession(token, userId) {
    let claims
    try {
      const segments = token.split('.')
      if (segments.length !== 3) throw new Error()
      claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))
    } catch { fail(401, 'SESSION_INVALID', 'Sua sessão expirou ou foi revogada. Entre novamente.') }
    if (!UUID.test(claims?.session_id || '') || claims.sub !== userId) fail(401, 'SESSION_INVALID', 'Sua sessão expirou ou foi revogada. Entre novamente.')
    const active = await db('rpc/rv30_session_active', {}, { method:'POST', body:{ p_session_id:claims.session_id, p_user_id:userId } })
    if (active !== true) fail(401, 'SESSION_INVALID', 'Sua sessão expirou ou foi revogada. Entre novamente.')
  }
  /** @param {IncomingRequest} req @param {boolean} [requireAdmin] */
  async function userFor(req, requireAdmin = false) {
    const cookies = String(req.headers.cookie || '').split(';').map(item => item.trim().split('='))
    const sessionId = cookies.find(([key]) => key === cookieName)?.[1]
    const session = sessions.get(sessionId)
    if (!session || session.expiresAt <= now()) { sessions.delete(sessionId); fail(401, 'AUTH_REQUIRED', 'Entre novamente para continuar.') }
    /** @type {AuthUser} */
    let user
    try { user = await authRequest('user', {}, session.token) } catch { sessions.delete(sessionId); fail(401, 'SESSION_INVALID', 'Sua sessão expirou ou foi revogada. Entre novamente.') }
    if (!user?.id || user.id !== session.userId || !user.email_confirmed_at || user.banned_until && Date.parse(user.banned_until) > now()) fail(403, 'EMAIL_UNVERIFIED', 'Confirme seu e-mail antes de continuar.')
    try { await confirmProviderSession(session.token,user.id) } catch { sessions.delete(sessionId); fail(401, 'SESSION_INVALID', 'Sua sessão expirou ou foi revogada. Entre novamente.') }
    /** @type {Profile|null} */
    const profile = first(await db('rv30_profiles', { user_id:`eq.${user.id}`, select:'user_id,name,status' }))
    if (!profile || profile.status !== 'active') fail(403, 'ACCOUNT_BLOCKED', 'Esta conta não está ativa. Entre em contato com o suporte.')
    const isAdmin = Boolean(adminEmail && emailOf(user.email) === adminEmail)
    if (requireAdmin && !isAdmin) fail(403, 'ADMIN_REQUIRED', 'Acesso administrativo não autorizado.')
    return { user, profile, isAdmin, session, sessionId }
  }
  /** @param {OutgoingResponse} res @param {{access_token?:string,expires_in?:number}} tokenResponse */
  async function establish(res, tokenResponse) {
    if (!tokenResponse?.access_token) fail(401, 'LOGIN_FAILED', 'E-mail ou senha inválidos, ou e-mail ainda não confirmado.')
    /** @type {AuthUser} */
    const user = await authRequest('user', {}, tokenResponse.access_token)
    if (!user.email_confirmed_at) fail(403, 'EMAIL_UNVERIFIED', 'Confirme seu e-mail antes de entrar.')
    await confirmProviderSession(tokenResponse.access_token,user.id)
    await db('rv30_profiles', { on_conflict:'user_id' }, { method:'POST', body:{ user_id:user.id, name:String(user.user_metadata?.name || 'Aluno').slice(0,100) }, prefer:'resolution=ignore-duplicates,return=minimal' })
    for (const [id, item] of sessions) if (item.expiresAt <= now()) sessions.delete(id)
    if (sessions.size >= 10000) fail(503, 'SESSION_CAPACITY', 'Acesso temporariamente indisponível.')
    const sessionId = crypto.randomBytes(32).toString('base64url')
    const duration = Math.min(Number(tokenResponse.expires_in) || 3600, 3600)
    sessions.set(sessionId, { token:tokenResponse.access_token, userId:user.id, expiresAt:now() + duration * 1000 })
    res.setHeader('Set-Cookie', `${cookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${duration}${production ? '; Secure' : ''}`)
    return { ok:true, user:{ id:user.id, email:user.email }, isAdmin:Boolean(adminEmail && emailOf(user.email) === adminEmail) }
  }
  /** @param {string} userId */
  async function access(userId) {
    /** @type {Entitlement|null} */
    const entitlement = first(await db('rv30_entitlements', { user_id:`eq.${userId}`, product_id:'eq.rv30', environment:`eq.${environment}`, status:'eq.active', select:'user_id,product_id,status,order_id' }))
    if (!entitlement) fail(403, 'PURCHASE_REQUIRED', 'Seu acesso ao RV 30 ainda não foi confirmado.')
    return entitlement
  }
  /** @param {string} paymentId @returns {Promise<ProviderPayment>} */
  const mp = paymentId => request(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers:{ Authorization:`Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}` } })
  /** @param {Order} order */
  const safeOrder = order => ({ id:order.id, courseId:order.product_id, status:order.status, amountCents:order.amount_cents, currency:order.currency, environment:order.environment, checkoutUrl:order.checkout_url || null })

  /** @param {IncomingRequest} req @param {OutgoingResponse} res @returns {Promise<boolean>} */
  return async function handleApi(req, res) {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return false
    try {
      if (production && (!origin.startsWith('https://') || String(req.headers['x-forwarded-proto'] || '').split(',')[0] !== 'https' && !('encrypted' in req.socket && req.socket.encrypted))) fail(400, 'HTTPS_REQUIRED', 'Conexão segura necessária.')
      limit(req, 'api', 180)
      const webhook = url.pathname === '/api/webhooks/mercado-pago'
      if (!['GET','HEAD'].includes(req.method) && !webhook && req.headers.origin !== origin) fail(403, 'ORIGIN_REJECTED', 'Origem da solicitação não autorizada.')
      if (req.method === 'GET' && url.pathname === '/api/config') {
        let product = null
        if (paymentReady()) {
          try { product = first(await db('rv30_products', { id:'eq.rv30',status:'eq.active',select:'id,price_cents,currency,commercial_approved' })) } catch {}
        }
        const salesEnabled = Boolean(paymentReady() && product?.commercial_approved === true && Number.isInteger(product?.price_cents) && product.price_cents > 0 && product.currency === 'BRL')
        send(res, 200, { ok:true, configured, salesEnabled, environment, product:{ id:'rv30', title:'RV 30', totalDays:30, ...(salesEnabled ? {priceCents:product.price_cents,currency:product.currency} : {}) } }); return true
      }
      if (!configured || !origin) fail(503, 'BACKEND_NOT_CONFIGURED', 'O acesso seguro ainda está em configuração. As inscrições permanecem indisponíveis.')
      if (req.method === 'POST' && url.pathname.startsWith('/api/auth/')) {
        limit(req, 'auth', 10)
        const body = await readBody(req)
        if (url.pathname === '/api/auth/logout') {
          const { sessionId, session } = await userFor(req)
          sessions.delete(sessionId)
          try { await authRequest('logout?scope=local', { method:'POST' }, session.token) } catch {}
          res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}`)
          send(res, 200, { ok:true }); return true
        }
        if (url.pathname === '/api/auth/verify') {
          if (!['email','recovery'].includes(body.type) || !/^[a-zA-Z0-9_-]{20,200}$/.test(body.tokenHash || '')) fail(400, 'INVALID_TOKEN', 'Link inválido ou expirado.')
          if (body.type === 'recovery' && (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128)) fail(400, 'INVALID_PASSWORD', 'Use uma senha de 12 a 128 caracteres.')
          let token
          try { token = await authRequest('verify', { method:'POST', body:JSON.stringify({ token_hash:body.tokenHash, type:body.type }) }) } catch { fail(400, 'INVALID_TOKEN', 'Link inválido, expirado ou já utilizado.') }
          if (body.type === 'recovery') {
            await authRequest('user', { method:'PUT', body:JSON.stringify({ password:body.password }) }, token.access_token)
            for (const [id, item] of sessions) if (item.userId === token.user?.id) sessions.delete(id)
          }
          send(res, 200, await establish(res, token)); return true
        }
        const email = emailOf(body.email)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(400, 'INVALID_EMAIL', 'Informe um e-mail válido.')
        if (url.pathname === '/api/auth/recover') {
          try { await authRequest(`recover?redirect_to=${encodeURIComponent(`${origin}/entrar`)}`, { method:'POST', body:JSON.stringify({ email }) }) } catch {}
          send(res, 200, { ok:true, message:'Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.' }); return true
        }
        if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) fail(400, 'INVALID_PASSWORD', 'Informe uma senha válida.')
        if (url.pathname === '/api/auth/signup') {
          if (body.password.length < 12) fail(400, 'INVALID_PASSWORD', 'Use uma senha de pelo menos 12 caracteres.')
          // The reserved administrator is provisioned through trusted Auth setup,
          // never claimed through public registration (even if Auth auto-confirm was misconfigured).
          if (!adminEmail || email !== adminEmail) {
            try { await authRequest('signup', { method:'POST', body:JSON.stringify({ email, password:body.password, data:{ name:String(body.name || 'Aluno').trim().slice(0,100) } }) }) } catch {}
          }
          send(res, 200, { ok:true, message:'Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, use a recuperação de acesso.' }); return true
        }
        if (url.pathname === '/api/auth/login') {
          let token
          try { token = await authRequest('token?grant_type=password', { method:'POST', body:JSON.stringify({ email, password:body.password }) }) } catch { fail(401, 'LOGIN_FAILED', 'E-mail ou senha inválidos, ou e-mail ainda não confirmado.') }
          send(res, 200, await establish(res, token)); return true
        }
      }
      if (req.method === 'POST' && webhook) {
        limit(req, 'webhook', 100)
        if (!env.MERCADO_PAGO_WEBHOOK_SECRET || !env.MERCADO_PAGO_ACCESS_TOKEN || !env.MERCADO_PAGO_COLLECTOR_ID) fail(503, 'PAYMENT_NOT_CONFIGURED', 'Integração de pagamento indisponível.')
        const body = await readBody(req)
        const dataId = url.searchParams.get('data.id')
        if (!dataId || String(body.data?.id) !== dataId || body.type !== 'payment' || !verifySignature({ signature:String(req.headers['x-signature'] || ''), requestId:String(req.headers['x-request-id'] || ''), dataId, secret:env.MERCADO_PAGO_WEBHOOK_SECRET, now:now() })) fail(401, 'INVALID_SIGNATURE', 'Notificação não autenticada.')
        const payment = await mp(dataId)
        if (String(payment.id) !== dataId) fail(422, 'PAYMENT_MISMATCH', 'Identificador de pagamento divergente.')
        if (!UUID.test(String(payment.external_reference || ''))) fail(422, 'UNKNOWN_ORDER', 'Pedido não reconhecido.')
        const order = first(await db('rv30_orders', { id:`eq.${payment.external_reference}`, select:'*' }))
        if (!order) fail(422, 'UNKNOWN_ORDER', 'Pedido não reconhecido.')
        const valid = validatePayment(payment, order, environment, env.MERCADO_PAGO_COLLECTOR_ID)
        // Transactional function locks the order and ignores stale/repeated provider versions.
        await db('rpc/rv30_apply_payment', {}, { method:'POST', body:{ p_order_id:order.id, p_payment_id:valid.paymentId, p_status:valid.status, p_provider_updated_at:valid.updatedAt, p_event_key:crypto.createHash('sha256').update(`${dataId}:${valid.updatedAt}:${valid.status}`).digest('hex'), p_refund_policy:env.RV30_REFUND_ACCESS_POLICY || 'review' } })
        send(res, 200, { ok:true }); return true
      }
      const context = await userFor(req, url.pathname.startsWith('/api/admin/'))
      const { user, profile, isAdmin } = context
      if (req.method === 'GET' && url.pathname === '/api/account') {
        const entitlements = await db('rv30_entitlements', { user_id:`eq.${user.id}`, environment:`eq.${environment}`, select:'product_id,status' })
        send(res, 200, { ok:true, account:{ id:user.id, email:user.email, name:profile.name, status:profile.status, entitlements:entitlements.filter(item => item.status === 'active').map(item => item.product_id) }, isAdmin }); return true
      }
      if (req.method === 'GET' && url.pathname === '/api/courses/rv30') {
        await access(user.id)
        const lessons = await db('rv30_lessons', { product_id:'eq.rv30', order:'day.asc', select:'day,title,description,is_published,storage_path' })
        const progress = await db('rv30_progress', { user_id:`eq.${user.id}`, product_id:'eq.rv30', environment:`eq.${environment}`, select:'day' })
        send(res, 200, { ok:true, courseId:'rv30', lessons:lessons.map(({ storage_path,...row }) => ({ ...row, available:Boolean(row.is_published && storage_path) })), progress:progress.map(row => row.day) }); return true
      }
      const videoDay = url.pathname.match(/^\/api\/courses\/rv30\/days\/(\d+)\/video$/)?.[1]
      if (req.method === 'GET' && videoDay !== undefined) {
        await access(user.id)
        const day = Number(videoDay)
        if (!Number.isInteger(day) || day < 1 || day > 30) fail(400, 'INVALID_DAY', 'Dia inválido.')
        const lesson = first(await db('rv30_lessons', { product_id:'eq.rv30', day:`eq.${day}`, select:'day,is_published,storage_path' }))
        if (!lesson?.is_published || !lesson.storage_path) fail(404, 'VIDEO_PENDING', 'A aula deste dia ainda não está disponível.')
        const storagePath = lesson.storage_path.split('/').map(encodeURIComponent).join('/')
        const signed = await request(`${env.SUPABASE_URL}/storage/v1/object/sign/rv30-videos/${storagePath}`, { method:'POST', headers:{ apikey:env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ expiresIn:120 }) })
        if (typeof signed?.signedURL !== 'string') fail(503, 'VIDEO_UNAVAILABLE', 'Vídeo temporariamente indisponível.')
        const signedUrl = new URL(signed.signedURL.startsWith('/object/') ? `${env.SUPABASE_URL}/storage/v1${signed.signedURL}` : signed.signedURL, `${env.SUPABASE_URL}/storage/v1/`)
        if (signedUrl.origin !== new URL(env.SUPABASE_URL).origin) fail(503, 'VIDEO_UNAVAILABLE', 'Vídeo temporariamente indisponível.')
        send(res, 200, { ok:true, url:signedUrl.toString(), expiresIn:120 }); return true
      }
      const progressDay = url.pathname.match(/^\/api\/courses\/rv30\/progress\/(\d+)$/)?.[1]
      if (req.method === 'PUT' && progressDay !== undefined) {
        await access(user.id)
        const day = Number(progressDay)
        const body = await readBody(req)
        if (!Number.isInteger(day) || day < 1 || day > 30 || typeof body.complete !== 'boolean') fail(400, 'INVALID_DAY', 'Progresso inválido.')
        const lesson = first(await db('rv30_lessons', { product_id:'eq.rv30', day:`eq.${day}`, is_published:'eq.true', select:'day,storage_path' }))
        if (!lesson?.storage_path) fail(409, 'LESSON_PENDING', 'A aula ainda não está disponível para conclusão.')
        if (body.complete) await db('rv30_progress', { on_conflict:'user_id,product_id,environment,day' }, { method:'POST', body:{ user_id:user.id, product_id:'rv30', environment, day }, prefer:'resolution=ignore-duplicates,return=minimal' })
        else await db('rv30_progress', { user_id:`eq.${user.id}`, product_id:'eq.rv30', environment:`eq.${environment}`, day:`eq.${day}` }, { method:'DELETE' })
        send(res, 200, { ok:true }); return true
      }
      if (req.method === 'POST' && url.pathname === '/api/orders') {
        limit(req, 'orders', 10)
        if (!paymentReady()) fail(503, 'SALES_DISABLED', 'As inscrições ainda não estão disponíveis.')
        const body = await readBody(req)
        if (body.productId !== 'rv30') fail(400, 'INVALID_PRODUCT', 'Produto inválido.')
        const product = first(await db('rv30_products', { id:'eq.rv30', status:'eq.active', select:'id,title,price_cents,currency,commercial_approved' }))
        if (!product?.commercial_approved || !Number.isInteger(product.price_cents) || product.price_cents <= 0 || product.currency !== 'BRL') fail(503, 'PRODUCT_PENDING', 'As condições comerciais ainda precisam de confirmação.')
        const key = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : ''
        if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key || '')) fail(400, 'IDEMPOTENCY_REQUIRED', 'Identificador de compra inválido.')
        let order = first(await db('rv30_orders', { user_id:`eq.${user.id}`, environment:`eq.${environment}`, idempotency_key:`eq.${key}`, select:'*' }))
        if (!order) {
          const orderId = crypto.randomUUID()
          order = first(await db('rv30_orders', { on_conflict:'user_id,idempotency_key,environment' }, { method:'POST', body:{ id:orderId, user_id:user.id, buyer_email:emailOf(user.email), product_id:'rv30', amount_cents:product.price_cents, currency:product.currency, environment, idempotency_key:key }, prefer:'resolution=ignore-duplicates,return=representation' }))
          if (!order) order = first(await db('rv30_orders', { user_id:`eq.${user.id}`, environment:`eq.${environment}`, idempotency_key:`eq.${key}`, select:'*' }))
        }
        if (!order) fail(503, 'ORDER_PENDING', 'Não foi possível preparar seu pedido. Tente novamente.')
        if (order.status !== 'pending') { send(res, 200, { ok:true, order:{ ...safeOrder(order), checkoutUrl:null } }); return true }
        if (!order.checkout_url) {
          const preference = await request('https://api.mercadopago.com/checkout/preferences', { method:'POST', headers:{ Authorization:`Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`, 'Content-Type':'application/json', 'X-Idempotency-Key':order.id }, body:JSON.stringify({ items:[{ id:'rv30', title:'RV 30', quantity:1, currency_id:order.currency, unit_price:order.amount_cents / 100 }], external_reference:order.id, metadata:{ order_id:order.id, product_id:'rv30', user_id:user.id }, notification_url:`${origin}/api/webhooks/mercado-pago`, back_urls:{ success:`${origin}/pagamento/sucesso?pedido=${order.id}`, pending:`${origin}/pagamento/sucesso?pedido=${order.id}`, failure:`${origin}/checkout/rv30` } }) })
          const checkoutUrl = environment === 'test' ? preference.sandbox_init_point : preference.init_point
          let checkout
          try { checkout = new URL(checkoutUrl) } catch { fail(503, 'CHECKOUT_UNAVAILABLE', 'Checkout temporariamente indisponível.') }
          if (checkout.protocol !== 'https:' || !['mercadopago.com','mercadopago.com.br'].some(host => checkout.hostname === host || checkout.hostname.endsWith(`.${host}`))) fail(503, 'CHECKOUT_UNAVAILABLE', 'Checkout temporariamente indisponível.')
          await db('rv30_orders', { id:`eq.${order.id}`, user_id:`eq.${user.id}` }, { method:'PATCH', body:{ checkout_url:checkoutUrl, preference_id:String(preference.id) } })
          order.checkout_url = checkoutUrl
        }
        send(res, 200, { ok:true, order:safeOrder(order) }); return true
      }
      const orderId = url.pathname.match(/^\/api\/orders\/([a-f0-9-]+)$/i)?.[1]
      if (req.method === 'GET' && orderId && UUID.test(orderId)) {
        const order = first(await db('rv30_orders', { id:`eq.${orderId}`, user_id:`eq.${user.id}`, environment:`eq.${environment}`, select:'*' }))
        if (!order) fail(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
        send(res, 200, { ok:true, order:safeOrder(order) }); return true
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/delivery') {
        const id = url.searchParams.get('orderId')
        if (!UUID.test(id || '')) fail(400, 'INVALID_ORDER', 'Informe o identificador completo do pedido.')
        const order = first(await db('rv30_orders', { id:`eq.${id}`, environment:`eq.${environment}`, select:'*' }))
        if (!order) fail(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
        const [profileRows, entitlementRows, lessons] = await Promise.all([
          db('rv30_profiles', { user_id:`eq.${order.user_id}`, select:'user_id,status' }),
          db('rv30_entitlements', { user_id:`eq.${order.user_id}`, product_id:'eq.rv30', environment:`eq.${order.environment}`, select:'order_id,status' }),
          db('rv30_lessons', { product_id:'eq.rv30', select:'day,is_published,storage_path' })
        ])
        /** @type {ProviderDiagnostic} */
        let provider = { available:false, confirmed:false, status:null }
        if (order.payment_id && env.MERCADO_PAGO_ACCESS_TOKEN && env.MERCADO_PAGO_COLLECTOR_ID) {
          try {
            const payment = await mp(order.payment_id)
            const validation = validatePayment(payment, order, environment, env.MERCADO_PAGO_COLLECTOR_ID)
            provider = { available:true, confirmed:validation.status === 'approved', status:validation.status }
          } catch (error) { provider = { available:false, confirmed:false, status:null, mismatch:error.code === 'PAYMENT_MISMATCH' } }
        }
        await Promise.all(lessons.filter(lesson => lesson.is_published && lesson.storage_path).slice(0,30).map(async lesson => {
          const storagePath = lesson.storage_path.split('/').map(encodeURIComponent).join('/')
          try {
            await request(`${env.SUPABASE_URL}/storage/v1/object/info/rv30-videos/${storagePath}`, { headers:{ apikey:env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })
            lesson.storage_verified = true
          } catch { lesson.storage_verified = false }
        }))
        send(res, 200, deliveryResult({ order, profile:first(profileRows), entitlement:first(entitlementRows), lessons, provider })); return true
      }
      fail(404, 'API_NOT_FOUND', 'Operação não encontrada.')
    } catch (error) {
      send(res, error instanceof ApiError ? error.status : 500, { ok:false, code:error instanceof ApiError ? error.code : 'INTERNAL_ERROR', message:error instanceof ApiError ? error.message : 'Não foi possível concluir a operação. Tente novamente.' })
      return true
    }
  }
}

module.exports = { createApi, verifySignature, validatePayment, deliveryResult, ApiError }
