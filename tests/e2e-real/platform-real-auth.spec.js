'use strict'
// REAL backend, zero API mocking: drives a real Chromium browser against
// scripts/qa-platform-repro-server.js, which wraps the ACTUAL
// backend/platform/worker.mjs (createPlatformHandler) + real backend/platform/auth.mjs
// access-control logic, backed by a local throwaway Miniflare D1/R2 (no production
// data, no real Supabase/Cloudflare account). Every assertion here is against a real
// HTTP response from real server code, not a fulfilled page.route().
const { test, expect } = require('@playwright/test')
const { SCENARIOS, PASSWORD } = require('../../scripts/qa-platform-repro-server')

async function login(page, email, password) {
  await page.goto('/entrar')
  await page.locator('[data-login-form] [name=email]').fill(email)
  await page.locator('[data-login-form] [name=password]').fill(password)
  await page.locator('[data-login-form] button[type=submit]').click()
}

for (const scenario of SCENARIOS) {
  test(`dashboard real (${scenario.id}): ${scenario.label}`, async ({ page }) => {
    const consoleErrors = []
    page.on('pageerror', (e) => consoleErrors.push(String(e)))
    const dashboardResponse = page.waitForResponse((r) => r.url().includes('/api/student/dashboard'))
    await login(page, scenario.email, PASSWORD)
    await expect(page).toHaveURL(/\/(meus-cursos|aluno\.html)/)
    const response = await dashboardResponse
    const data = await response.json()
    expect(response.status(), `dashboard HTTP status for ${scenario.id}`).toBe(200)
    console.log(`[${scenario.id}] enrollment.status real = ${data.enrollment.status}`)
    await page.locator('body').waitFor({ state: 'visible' })
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length, `${scenario.id} rendered no visible text`).toBeGreaterThan(0)
    await page.screenshot({ path: `output/qa-previews/real-auth-${scenario.id}.png`, fullPage: true })
    expect(consoleErrors, `uncaught JS error for ${scenario.id}: ${consoleErrors[0]}`).toEqual([])
  })
}

test('golden: vídeo do dia 1 entrega bytes reais via Range (sem mock)', async ({ page, request }) => {
  await login(page, 'golden@example.test', PASSWORD)
  await expect(page).toHaveURL(/\/(meus-cursos|aluno\.html)/)
  const cookie = (await page.context().cookies()).find((c) => c.name === '__Host-rv30_session')
  expect(cookie, 'sessão real não emitiu cookie __Host-rv30_session').toBeTruthy()
  const media = await request.fetch('/api/courses/rv30/days/1/media', { headers: { Range: 'bytes=0-4', cookie: `${cookie.name}=${cookie.value}` } })
  expect(media.status()).toBe(206)
  expect(await media.text()).toBe('01234')
  const day30 = await request.fetch('/api/courses/rv30/days/30/video', { headers: { cookie: `${cookie.name}=${cookie.value}` } })
  expect(day30.status(), 'dia 30 deveria seguir pendente (404), nunca inventado').toBe(404)
})

test('senha incorreta real: backend rejeita e UI mostra erro sem criar sessão', async ({ page }) => {
  await login(page, 'golden@example.test', 'SenhaErradaDeProposito123')
  await expect(page.getByRole('alert')).toBeVisible()
  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === '__Host-rv30_session')).toBeFalsy()
})

test('logout real: encerra sessão no servidor, dashboard volta a exigir login', async ({ page, request }) => {
  await login(page, 'golden@example.test', PASSWORD)
  await expect(page).toHaveURL(/\/(meus-cursos|aluno\.html)/)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/(entrar|login\.html)$|\/$/)
  const cookies = await page.context().cookies()
  const stale = cookies.find((c) => c.name === '__Host-rv30_session')
  const check = await request.fetch('/api/student/dashboard', { headers: stale ? { cookie: `${stale.name}=${stale.value}` } : {} })
  expect(check.status(), 'dashboard deveria exigir login após logout real').toBe(401)
})
