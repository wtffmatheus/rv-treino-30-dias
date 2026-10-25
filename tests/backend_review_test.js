'use strict'
// Independent regression checks discovered during security review.
const assert = require('node:assert/strict')
const { Readable } = require('node:stream')
const { createApi } = require('../backend/server/api')
const USER = '11111111-1111-4111-8111-111111111111'
const ORDER = '33333333-3333-4333-8333-333333333333'
const providerToken=`e30.${Buffer.from(JSON.stringify({sub:USER,session_id:'44444444-4444-4444-8444-444444444444'})).toString('base64url')}.test-provider-signature`
const origin = 'http://127.0.0.1:8081'
const env = { PUBLIC_SITE_URL: origin, SUPABASE_URL: 'https://review.supabase.co', SUPABASE_ANON_KEY: 'test-public', SUPABASE_SERVICE_ROLE_KEY: 'test-private', ADMIN_EMAIL: 'reserved@example.test', PAYMENT_PROVIDER: 'mercado_pago', PAYMENT_ENVIRONMENT: 'production', MERCADO_PAGO_ACCESS_TOKEN: 'test-private-provider', MERCADO_PAGO_WEBHOOK_SECRET: 'test-private-hook', MERCADO_PAGO_COLLECTOR_ID: '55', RV30_SALES_ENABLED: 'true' }

function app() {
  const calls = []
  const testOrder = { id: ORDER, user_id: USER, product_id: 'rv30', amount_cents: 39900, currency: 'BRL', environment: 'test', status: 'pending', checkout_url: 'https://sandbox.mercadopago.com.br/test' }
  const response = (body) => ({ ok: true, json: async () => body })
  const api = createApi({ env, fetchImpl: async (raw, options = {}) => {
    const url = new URL(raw)
    calls.push({ url, ...options })
    if (url.pathname === '/auth/v1/token') return response({ access_token: providerToken, expires_in: 3600 })
    if (url.pathname === '/auth/v1/user') return response({ id: USER, email: 'student@example.test', email_confirmed_at: '2026-01-01' })
    if (url.pathname === '/rest/v1/rpc/rv30_session_active') return response(true)
    if (url.pathname === '/rest/v1/rv30_profiles') return response(options.method === 'POST' ? null : [{ user_id: USER, name: 'Teste', status: 'active' }])
    if (url.pathname === '/rest/v1/rv30_products') return response([{ id: 'rv30', status: 'active', title: 'RV 30', price_cents: 39900, currency: 'BRL', commercial_approved: true }])
    if (url.pathname === '/rest/v1/rv30_orders') {
      if (options.method === 'POST') return response([])
      return response(url.searchParams.get('environment') === 'eq.production' ? [] : [testOrder])
    }
    return response({})
  } })
  async function invoke(route, { method = 'GET', body, cookie } = {}) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    Object.assign(req, { url: route, method, socket: { remoteAddress: '127.0.0.1' }, headers: { origin, 'content-type': 'application/json', 'idempotency-key': 'same-browser-request-key', ...(cookie ? { cookie } : {}) } })
    const result = { headers: {} }
    await api(req, { setHeader: (key, value) => { result.headers[key] = value }, writeHead: (status) => { result.status = status }, end: (value) => { result.body = JSON.parse(value) } })
    return result
  }
  async function login() {
    const result = await invoke('/api/auth/login', { method: 'POST', body: { email: 'student@example.test', password: 'test-password-123' } })
    assert.equal(result.status, 200)
    return result.headers['Set-Cookie'].split(';')[0]
  }
  return { calls, invoke, login }
}

;(async () => {
  const reserved = app()
  const signup = await reserved.invoke('/api/auth/signup', { method: 'POST', body: { email: 'RESERVED@example.test', password: 'test-password-123', name: 'Teste' } })
  assert.equal(signup.status, 200, 'a resposta não revela se o e-mail pertence ao administrador')
  assert.equal(reserved.calls.some((call) => call.url.pathname === '/auth/v1/signup'), false, 'e-mail administrativo não pode ser reivindicado no cadastro público')

  const confirmation = app()
  const cookie = await confirmation.login()
  const result = await confirmation.invoke(`/api/orders/${ORDER}`, { cookie })
  assert.equal(result.status, 404, 'uma compra de teste não aparece na confirmação em produção')
  const query = confirmation.calls.find((call) => call.url.pathname.endsWith('/rv30_orders')).url.searchParams
  assert.equal(query.get('user_id'), `eq.${USER}`)
  assert.equal(query.get('environment'), 'eq.production')

  const checkout = app()
  const checkoutCookie = await checkout.login()
  const purchase = await checkout.invoke('/api/orders', { method: 'POST', cookie: checkoutCookie, body: { productId: 'rv30' } })
  assert.equal(purchase.status, 503, 'sem pedido novo em produção a API falha fechada, sem reaproveitar a compra de teste')
  assert.equal(JSON.stringify(purchase.body).includes('sandbox.mercadopago'), false)
  const lookups = checkout.calls.filter((call) => call.url.pathname.endsWith('/rv30_orders') && (!call.method || call.method === 'GET'))
  assert.ok(lookups.length > 0)
  assert.ok(lookups.every((call) => call.url.searchParams.get('environment') === 'eq.production'), 'a idempotência do checkout é isolada por ambiente')
  console.log('OK: revisão independente confirmou reserva do e-mail administrativo e isolamento dos pedidos por ambiente.')
})().catch((error) => { console.error(error); process.exitCode = 1 })
