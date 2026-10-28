// Frontend integration tests with MOCKED APIs. These do not validate live
// Supabase, RLS, e-mail delivery, signed media or a real payment provider.
const { test, expect } = require('@playwright/test')

const USER = '11111111-1111-4111-8111-111111111111'
const ORDER = '33333333-3333-4333-8333-333333333333'

async function mockApi(page, options = {}) {
  const state = {
    authenticated: false, role: 'student', loginAs: 'student', purchased: false,
    salesEnabled: false, orderStatus: 'pending', videoAvailable: false,
    videoError: 'A aula está temporariamente indisponível. Tente novamente.',
    verifyUsed: false, ...options
  }
  const calls = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    let body
    try { body = request.postDataJSON() } catch {}
    calls.push({ path: url.pathname, search: url.search, method: request.method(), body, headers: await request.allHeaders() })
    const json = (value, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(value) })
    if (url.pathname === '/api/config') return json({ ok: true, configured: true, salesEnabled: state.salesEnabled, environment: 'test', product: { id: 'rv30', title: 'RV 30', totalDays: 30, ...(state.priceCents === undefined ? {} : { priceCents: state.priceCents, currency: 'BRL' }) } })
    if (url.pathname === '/api/account') {
      if (!state.authenticated) return json({ ok: false, code: 'AUTH_REQUIRED', message: 'Entre novamente para continuar.' }, 401)
      return json({ ok: true, account: { id: USER, name: 'Conta de teste', email: state.role === 'admin' ? 'responsavel@example.test' : 'novo@example.test', status: 'active', entitlements: state.purchased ? ['rv30'] : [] }, isAdmin: state.role === 'admin' })
    }
    if (url.pathname === '/api/auth/login') {
      state.authenticated = true
      state.role = state.loginAs
      return json({ ok: true, user: { id: USER }, isAdmin: state.role === 'admin' }, 200, { 'Set-Cookie': 'rv30_session=opaque-mocked-session; Path=/; HttpOnly; SameSite=Strict' })
    }
    if (url.pathname === '/api/auth/logout') {
      if (state.logoutError) return json({ ok: false, code: 'UPSTREAM_UNAVAILABLE', message: 'Não foi possível encerrar a sessão. Tente novamente.' }, 503)
      state.authenticated = false
      return json({ ok: true }, 200, { 'Set-Cookie': 'rv30_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' })
    }
    if (url.pathname === '/api/auth/signup') return json({ ok: true, message: 'Confira seu e-mail para confirmar o cadastro.' })
    if (url.pathname === '/api/auth/recover') return json({ ok: true, message: 'Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.' })
    if (url.pathname === '/api/auth/verify') {
      if (state.verifyUsed || state.verifyExpired) return json({ ok: false, code: 'INVALID_TOKEN', message: 'Link inválido, expirado ou já utilizado.' }, 400)
      state.verifyUsed = true
      state.authenticated = true
      return json({ ok: true, user: { id: USER } }, 200, { 'Set-Cookie': 'rv30_session=opaque-mocked-session; Path=/; HttpOnly; SameSite=Strict' })
    }
    if (url.pathname === '/api/courses/rv30') {
      if (!state.authenticated || !state.purchased) return json({ ok: false, code: 'PURCHASE_REQUIRED', message: 'Seu acesso ao RV 30 ainda não foi confirmado.' }, 403)
      return json({ ok: true, courseId: 'rv30', progress: [], lessons: [{ day: 1, title: 'Aula de teste autorizada', description: 'Conteúdo retornado pela API simulada.', is_published: state.videoAvailable, available: state.videoAvailable }] })
    }
    if (/\/api\/courses\/rv30\/days\/\d+\/video$/.test(url.pathname)) {
      return json({ ok: false, code: 'VIDEO_UNAVAILABLE', message: state.videoError }, 503)
    }
    if (url.pathname === `/api/orders/${ORDER}`) {
      if (!state.authenticated) return json({ ok: false, code: 'AUTH_REQUIRED', message: 'Entre novamente para continuar.' }, 401)
      return json({ ok: true, order: { id: ORDER, courseId: 'rv30', status: state.orderStatus, amountCents: 39900, currency: 'BRL', environment: 'test' } })
    }
    if (url.pathname === '/api/orders' && request.method() === 'POST') {
      if (!state.authenticated || !state.salesEnabled) return json({ ok: false, message: 'As inscrições ainda não estão disponíveis.' }, 503)
      return json({ ok: true, order: { id: ORDER, courseId: 'rv30', status: 'pending', amountCents: state.priceCents, currency: 'BRL', checkoutUrl: 'https://sandbox.mercadopago.com.br/checkout/rv30-mocked-only' } })
    }
    if (url.pathname === '/api/admin/delivery') {
      if (!state.authenticated || state.role !== 'admin') return json({ ok: false, message: 'Acesso administrativo não autorizado.' }, 403)
      return json({ ok: true, result: 'pending', reasons: ['O dia 30 ainda não tem vídeo privado publicado.'], order: { id: ORDER, courseId: 'rv30', status: 'approved' }, product: { id: 'rv30', title: 'RV 30' }, account: { id: USER, email: 'comprador@example.test' }, provider: { available: true, confirmed: true, status: 'approved' }, entitlement: { exists: true, status: 'active' }, lessons: { expected: 30, available: 29, missingDays: [30] } })
    }
    return json({ ok: false, code: 'API_NOT_FOUND', message: 'Rota simulada não encontrada.' }, 404)
  })
  return { state, calls }
}

async function login(page, admin = false) {
  await page.goto(admin ? '/admin/entrar' : '/entrar')
  await page.getByLabel(admin ? 'E-mail administrativo' : 'E-mail', { exact: true }).fill(admin ? 'responsavel@example.test' : 'novo@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('SenhaApenasDeTeste123')
  await page.getByRole('button', { name: admin ? 'Entrar no painel RV 30' : 'Entrar', exact: true }).click()
}

test('API simulada: falha no logout mantém a tela e permite tentar novamente', async ({ page }) => {
  const { state } = await mockApi(page, { authenticated: true, role: 'admin', logoutError: true })
  await page.goto('/admin/videos')
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.locator('[data-video-environment-note]')).toContainText('Não foi possível encerrar a sessão')
  await expect(page).toHaveURL(/\/admin\/videos$/)
  state.logoutError = false
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByLabel('E-mail administrativo')).toBeVisible()
})

async function demoKeys(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('rv-cursos-demo-')))
}

test('API simulada: cadastro e login não liberam RV 30 antes da confirmação do servidor', async ({ page, context }) => {
  const { state, calls } = await mockApi(page)
  await page.goto('/entrar')
  await page.getByText('Criar minha conta', { exact: true }).click()
  const signup = page.locator('[data-signup-form]')
  await signup.getByLabel('Nome completo').fill('Pessoa de teste')
  await signup.getByLabel('E-mail da nova conta').fill('novo@example.test')
  await signup.getByLabel('Crie uma senha de pelo menos 12 caracteres').fill('SenhaApenasDeTeste123')
  await signup.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(signup.getByRole('status')).toHaveText('Confira seu e-mail para confirmar o cadastro.')
  expect(state.authenticated).toBe(false)
  expect(await demoKeys(page)).toEqual([])

  await login(page)
  await expect(page.getByRole('heading', { name: 'Meus cursos', exact: true })).toBeVisible()
  await expect(page.getByText(/Nenhum curso está liberado para esta conta/)).toBeVisible()
  const cookie = (await context.cookies()).find((item) => item.name === 'rv30_session')
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict' })
  expect(await demoKeys(page)).toEqual([])

  await page.goto(`/pagamento/sucesso?pedido=${ORDER}&status=approved&demo=1`)
  await expect(page.getByRole('heading', { name: 'Acompanhando sua inscrição.' })).toBeVisible()
  await expect(page.locator('[data-create-access-form]')).toBeHidden()
  await expect(page.locator('[data-confirm-copy]')).toContainText('pendente')
  expect(calls.some((call) => /grant|claim|simulate/.test(call.path))).toBe(false)

  await page.goto('/meus-cursos')
  await expect(page.getByText(/Nenhum curso está liberado para esta conta/)).toBeVisible()
  state.purchased = true
  await page.reload()
  await expect(page.locator('.my-course-card')).toContainText('RV 30')
  expect(await demoKeys(page)).toEqual([])
})

test('API simulada: armazenamento local forjado não abre administração nem vídeos', async ({ page }) => {
  const { calls } = await mockApi(page)
  await page.addInitScript(() => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString()
    localStorage.setItem('rv-cursos-demo-admin-session-v6', JSON.stringify({ email: 'admin@rvfisiologia.test', expiresAt }))
    localStorage.setItem('rv-cursos-demo-session-v6', JSON.stringify({ userId: 'usr_forged', expiresAt }))
    localStorage.setItem('rv-cursos-demo-db-v6', JSON.stringify({ version: 6, users: [{ id: 'usr_forged', status: 'active', entitlements: ['rv30'] }], orders: [], audit: [] }))
  })
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/entrar(?:[?#]|$)/)
  await expect(page.getByLabel('E-mail administrativo')).toBeVisible()
  await expect(page.locator('[data-delivery-form]')).toHaveCount(0)
  expect(calls.some((call) => call.path === '/api/admin/delivery')).toBe(false)
  await page.goto('/curso/rv30?demo=1')
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  expect(calls.some((call) => call.path.endsWith('/video'))).toBe(false)
})

test('API simulada: conta de aluno sem compra recebe estado claro e não solicita reprodução', async ({ page }) => {
  const { calls } = await mockApi(page, { authenticated: true })
  await page.goto('/curso/rv30/dia/1')
  await expect(page).toHaveURL(/(?:\/meus-cursos|\/aluno\.html)(?:[?#]|$)/)
  await expect(page.getByText(/Nenhum curso está liberado para esta conta/)).toBeVisible()
  expect(calls.some((call) => call.path.endsWith('/video'))).toBe(false)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/entrar(?:[?#]|$)/)
  await expect(page.locator('[data-admin-login-form]')).toBeVisible()
})

test('API simulada: senha válida de aluno não concede autorização administrativa', async ({ page }) => {
  const { state, calls } = await mockApi(page, { loginAs: 'student' })
  await login(page, true)
  await expect(page.locator('[data-form-error]')).toHaveText('Esta conta não tem autorização administrativa.')
  await expect(page.locator('[data-admin-login-form]')).toBeVisible()
  expect(state.authenticated).toBe(false)
  expect(calls.filter((call) => call.path === '/api/auth/logout' && call.method === 'POST')).toHaveLength(1)
  expect(calls.some((call) => call.path === '/api/admin/delivery')).toBe(false)
  expect(await demoKeys(page)).toEqual([])
})

test('API simulada: recuperação informa o envio sem expor a existência da conta', async ({ page }) => {
  const { calls } = await mockApi(page)
  await page.goto('/entrar#recuperar')
  const form = page.locator('[data-recover-form]')
  await expect(form).toBeVisible()
  await form.getByLabel('E-mail de recuperação').fill('desconhecido@example.test')
  await form.getByRole('button', { name: 'Enviar instruções' }).click()
  await expect(form.getByRole('status')).toHaveText('Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.')
  expect(calls.filter((call) => call.path === '/api/auth/recover')).toEqual([expect.objectContaining({ method: 'POST', body: { email: 'desconhecido@example.test' } })])
  expect(calls.some((call) => call.path === '/api/auth/verify')).toBe(false)
})

test('API simulada: checkout exige conta autenticada antes de criar o pedido', async ({ page }) => {
  const { calls } = await mockApi(page, { salesEnabled: true, priceCents: 50000 })
  await page.goto('/checkout/rv30')
  await expect(page.getByRole('link', { name: 'Entrar ou criar minha conta', exact: true })).toBeVisible()
  await expect(page.locator('[data-checkout-form]')).toBeHidden()
  await expect(page.locator('[data-simulate-payment]')).toBeHidden()
  expect(calls.some((call) => call.path === '/api/orders')).toBe(false)
})

test('API simulada: avisos da inscrição acompanham a disponibilidade confirmada pelo servidor', async ({ page }) => {
  const { state, calls } = await mockApi(page)
  await page.goto('/')
  await expect(page.locator('[data-sales-label]')).toHaveText('Inscrições em preparação')
  await expect(page.locator('[data-sales-summary]')).toContainText('Inscrições em preparação')
  await expect(page.locator('.hero-actions [data-buy]')).toBeDisabled()
  state.salesEnabled = true
  state.priceCents = 50000 // Isolated fixture, not a commercial definition.
  await page.reload()
  await expect(page.locator('[data-sales-label]')).toHaveText('Inscrições disponíveis')
  await expect(page.locator('[data-sales-summary]')).toContainText('Inscrições disponíveis')
  await expect(page.locator('[data-sales-detail]')).not.toContainText('ainda não está disponível')
  await expect(page.locator('.hero-actions [data-buy]')).toBeEnabled()
  const faq = page.locator('details').filter({ has: page.locator('[data-sales-faq]') })
  await faq.locator('summary').click()
  await expect(page.locator('[data-sales-faq]')).toContainText('Você pode iniciar sua inscrição')
  expect(calls.some((call) => call.path === '/api/orders')).toBe(false)
})

test('demonstração local: falha na simulação aparece em alerta e não confirma compra', async ({ page }) => {
  await page.route('**/api/config', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, configured: false, salesEnabled: false }) }))
  await page.goto('/checkout/rv30')
  await page.getByLabel('Nome completo').fill('Aluno de Teste')
  await page.getByLabel('E-mail', { exact: true }).fill('teste.simulacao@example.test')
  await page.getByLabel('WhatsApp').fill('11999999999')
  await page.locator('[name=terms]').check()
  await page.getByRole('button', { name: 'Continuar para o pagamento', exact: true }).click()
  await expect(page.locator('[data-test-payment]')).toBeVisible()
  await page.evaluate(() => {
    window.RVCourseStore.createDemoOrder = () => ({ ok: false, message: 'Não foi possível iniciar esta simulação.' })
  })
  await page.getByRole('button', { name: 'Simular pagamento aprovado', exact: true }).click()
  const error = page.locator('[data-test-payment-error]')
  await expect(error).toHaveText('Não foi possível iniciar esta simulação.')
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toHaveAttribute('aria-live', 'polite')
  await page.evaluate(() => {
    window.RVCourseStore.createDemoOrder = () => { throw new Error('Detalhe interno de armazenamento') }
  })
  await page.getByRole('button', { name: 'Simular pagamento aprovado', exact: true }).click()
  await expect(error).toHaveText('Não foi possível criar o pedido de teste. Tente novamente.')
  await expect(error).not.toContainText('Detalhe interno')
  expect(new URL(page.url()).pathname).toMatch(/(?:\/checkout\/rv30|\/checkout\.html)$/)
  const purchases = await page.evaluate(() => (window.dataLayer || []).filter(event => event.event === 'Purchase'))
  expect(purchases).toEqual([])
})

test('API simulada: preço vem do servidor e checkout envia somente produto e idempotência', async ({ page }) => {
  // R$ 500,00 is an isolated fixture value, not an RV 30 commercial definition.
  const { state, calls } = await mockApi(page, { authenticated: true })
  await page.route('https://sandbox.mercadopago.com.br/checkout/rv30-mocked-only', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>Gateway simulado</title><h1>Checkout simulado pelo teste</h1></html>' }))
  await page.goto('/checkout/rv30')
  await expect(page.locator('[data-checkout-config-error]')).toContainText('Inscrições em preparação')
  expect(await page.locator('body').innerText()).not.toMatch(/R\$\s*399,00|R\$\s*13,30/)
  state.salesEnabled = true
  state.priceCents = 50000
  await page.reload()
  await expect(page.locator('[data-order-total]').last()).toHaveText(/R\$\s*500,00/)
  // A changed browser price must not be included in the order request.
  await page.evaluate(() => { window.RV_COURSE_CONFIG.courses.find((course) => course.id === 'rv30').priceCents = 1 })
  await page.getByRole('button', { name: 'Continuar para o pagamento', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Checkout simulado pelo teste' })).toBeVisible()
  const orders = calls.filter((call) => call.path === '/api/orders')
  expect(orders).toHaveLength(1)
  expect(orders[0]).toMatchObject({ method: 'POST', body: { productId: 'rv30' } })
  expect(Object.keys(orders[0].body)).toEqual(['productId'])
  expect(orders[0].headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i)
})

test('API simulada: administrador consulta entrega somente por GET e dados locais ficam ocultos', async ({ page }) => {
  const { calls } = await mockApi(page, { loginAs: 'admin' })
  await login(page, true)
  await expect(page.getByRole('heading', { name: 'Gestão do RV 30', exact: true })).toBeVisible()
  await expect(page.locator('[data-demo-admin]').first()).toBeHidden()
  await expect(page.locator('[data-open-create]')).toBeHidden()
  await page.getByLabel('Identificador do pedido').fill(ORDER)
  const before = calls.length
  await page.getByRole('button', { name: 'Verificar entrega do RV 30', exact: true }).click()
  const result = page.locator('[data-delivery-result]')
  await expect(result.getByRole('heading', { name: 'Pendente', exact: true })).toBeVisible()
  await expect(result).toContainText('comprador@example.test')
  await expect(result).toContainText('Encontrado e ativo')
  await expect(result).toContainText('29 de 30')
  await expect(result).toContainText('O dia 30 ainda não tem vídeo privado publicado.')
  const diagnostic = calls.slice(before)
  expect(diagnostic).toHaveLength(1)
  expect(diagnostic[0]).toMatchObject({ method: 'GET', path: '/api/admin/delivery', search: `?orderId=${ORDER}` })
  expect(diagnostic[0].headers.cookie).toContain('rv30_session=opaque-mocked-session')
  expect(await demoKeys(page)).toEqual([])
})

test('API simulada: revisão privada não usa editor local e sair encerra a sessão', async ({ page }) => {
  const { state, calls } = await mockApi(page, { authenticated: true, role: 'admin' })
  await page.goto('/admin/videos')
  await expect(page.locator('[data-video-environment-note]')).toContainText('O editor de demonstração não altera aulas reais.')
  await expect(page.locator('[data-files]')).toBeHidden()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page.getByLabel('E-mail administrativo')).toBeVisible()
  expect(calls.filter((call) => call.path === '/api/auth/logout' && call.method === 'POST')).toHaveLength(1)
  expect(state.authenticated).toBe(false)
})

test('API simulada: aula ausente não cria player e erro de aula publicada permanece compreensível', async ({ page }) => {
  const { state, calls } = await mockApi(page, { authenticated: true, purchased: true })
  await page.goto('/curso/rv30/dia/1')
  await expect(page.locator('[data-content-status]')).toHaveText('Vídeo em preparação')
  await expect(page.locator('[data-course-video]')).toContainText('Vídeo em preparação pela equipe RV.')
  await expect(page.locator('[data-course-video] video, [data-course-video] iframe')).toHaveCount(0)
  await expect(page.locator('[data-complete]')).toBeDisabled()
  expect(calls.some((call) => call.path.endsWith('/video'))).toBe(false)
  state.videoAvailable = true
  await page.reload()
  await expect(page.locator('[data-course-video]')).toContainText(state.videoError)
  await expect(page.locator('[data-course-video] video, [data-course-video] iframe')).toHaveCount(0)
  expect(calls.some((call) => call.path === '/api/courses/rv30/days/1/video')).toBe(true)
})

for (const type of ['email', 'recovery']) {
  test(`API simulada: link ${type} só consome credencial após confirmação explícita`, async ({ page }) => {
    const { state, calls } = await mockApi(page)
    const tokenHash = `token_de_teste_${type}_com_mais_de_vinte_caracteres`
    await page.goto(`/entrar#token_hash=${tokenHash}&type=${type}`)
    const form = page.locator('[data-verify-form]')
    await expect(form).toBeVisible()
    await expect(page).not.toHaveURL(/token_hash/)
    expect(calls.some((call) => call.path === '/api/auth/verify')).toBe(false)
    if (type === 'recovery') await form.getByLabel('Nova senha').fill('UmaNovaSenhaDeTeste123')
    await form.getByRole('button', { name: 'Confirmar e continuar' }).click()
    await expect(page.getByText(/Nenhum curso está liberado para esta conta/)).toBeVisible()
    const submitted = calls.filter((call) => call.path === '/api/auth/verify')
    expect(submitted).toHaveLength(1)
    expect(submitted[0]).toMatchObject({ method: 'POST', body: { tokenHash, type } })
    expect(state.verifyUsed).toBe(true)

    // The API mock rejects reuse. This verifies only the displayed UI state.
    await page.goto(`/entrar#token_hash=${tokenHash}&type=${type}`)
    await expect(page.locator('[data-verify-form]')).toBeVisible()
    if (type === 'recovery') await page.locator('[data-verify-form]').getByLabel('Nova senha').fill('UmaNovaSenhaDeTeste123')
    await page.locator('[data-verify-form]').getByRole('button', { name: 'Confirmar e continuar' }).click()
    await expect(page.locator('[data-verify-form]').getByRole('status')).toHaveText('Link inválido, expirado ou já utilizado.')
  })
}
