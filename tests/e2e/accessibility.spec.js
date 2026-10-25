// Focused accessibility regressions only. This is not a complete WCAG audit
// and does not replace assistive-technology or human accessibility testing.
const { test, expect } = require('@playwright/test')

async function mockRuntime(page, serverMode = false) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path === '/api/config'
      ? { ok: true, configured: serverMode, salesEnabled: false, product: { id: 'rv30', title: 'RV 30', totalDays: 30 } }
      : path === '/api/auth/login'
        ? { ok: false, code: 'LOGIN_FAILED', message: 'E-mail ou senha inválidos, ou e-mail ainda não confirmado.' }
        : { ok: false, code: 'AUTH_REQUIRED', message: 'Entre novamente para continuar.' }
    await route.fulfill({ status: path === '/api/config' ? 200 : 401, contentType: 'application/json', body: JSON.stringify(data) })
  })
}

test('teclado e movimento reduzido: atalho aparece no foco e pula a navegação', async ({ page }) => {
  await mockRuntime(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo', exact: true })
  const before = await skip.boundingBox()
  expect(before).not.toBeNull()
  expect(before.y + before.height).toBeLessThanOrEqual(0)

  await page.keyboard.press('Tab')
  await expect(skip).toBeFocused()
  const focused = await skip.boundingBox()
  expect(focused.y).toBeGreaterThanOrEqual(0)
  expect(focused.y + focused.height).toBeLessThanOrEqual(900)
  const outline = await skip.evaluate((element) => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }))
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThan(0)

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#conteudo$/)
  await expect(page.locator('main#conteudo')).toBeInViewport()
  // Native fragment navigation may move the sequential focus start rather
  // than activeElement. The next Tab must reach content, not the header.
  const targetFocused = await page.evaluate(() => document.querySelector('main#conteudo').contains(document.activeElement))
  if (!targetFocused) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.querySelector('main#conteudo').contains(document.activeElement))).toBe(true)
})

test('menu mobile: abre pelo teclado e Escape devolve foco ao botão', async ({ page }) => {
  await mockRuntime(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.site-header .brand')).toBeFocused()
  await page.keyboard.press('Tab')
  const toggle = page.getByRole('button', { name: 'Abrir menu', exact: true })
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'O programa', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()
  await expect(page.locator('[data-menu]')).toBeHidden()
})

for (const admin of [false, true]) {
  test(`formulário ${admin ? 'profissional' : 'do aluno'}: erro de acesso tem região viva e o campo mantém foco visível`, async ({ page }) => {
    await mockRuntime(page, true)
    await page.goto(admin ? '/admin/entrar' : '/entrar')
    const form = page.locator(admin ? '[data-admin-login-form]' : '[data-login-form]')
    const email = form.getByLabel(admin ? 'E-mail administrativo' : 'E-mail', { exact: true })
    await email.fill('acessibilidade@example.test')
    await email.focus()
    await page.keyboard.press('Tab')
    const password = form.getByLabel('Senha', { exact: true })
    await expect(password).toBeFocused()
    const outline = await password.evaluate((element) => ({ style: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }))
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThan(0)
    await page.keyboard.type('SenhaDeTesteIncorreta123')
    await page.keyboard.press('Enter')
    const error = form.locator('[data-form-error]')
    await expect(error).toHaveText('E-mail ou senha inválidos, ou e-mail ainda não confirmado.')
    await expect(error).toHaveAttribute('role', 'alert')
    await expect(error).toHaveAttribute('aria-live', /polite|assertive/)
    await expect(form.getByRole('button', { name: admin ? 'Entrar no painel RV 30' : 'Entrar', exact: true })).toBeEnabled()
  })
}

test('páginas principais: imagens locais têm alt e campos expostos têm rótulo', async ({ page }) => {
  await mockRuntime(page)
  const pages = [
    { path: '/', ready: '#hero-title' },
    { path: '/entrar', ready: '[data-login-form]' },
    { path: '/admin/entrar', ready: '[data-admin-login-form]' },
    { path: '/checkout/rv30', ready: '[data-checkout-form]' },
    { path: '/curso/rv30?demo=1', ready: '[data-course-video]' }
  ]
  for (const screen of pages) {
    await page.goto(screen.path)
    await expect(page.locator(screen.ready)).toBeVisible()
    const issues = await page.evaluate(() => {
      const localImages = [...document.images].filter((image) => new URL(image.currentSrc || image.src, location.href).origin === location.origin)
      const imagesWithoutAlt = localImages.filter((image) => !image.hasAttribute('alt')).map((image) => image.getAttribute('src'))
      const visible = (element) => {
        const style = getComputedStyle(element)
        return element.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[hidden], [inert], [aria-hidden="true"]')
      }
      const fieldsWithoutLabel = [...document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')]
        .filter(visible)
        .filter((field) => {
          const label = [...(field.labels || [])].some((element) => element.textContent.trim())
          const ariaLabel = field.getAttribute('aria-label')?.trim()
          const referenced = String(field.getAttribute('aria-labelledby') || '').split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim())
          return !label && !ariaLabel && !referenced
        }).map((field) => ({ tag: field.tagName, name: field.getAttribute('name'), id: field.id }))
      return { localImages: localImages.length, imagesWithoutAlt, fieldsWithoutLabel }
    })
    expect(issues.localImages, screen.path).toBeGreaterThan(0)
    expect(issues.imagesWithoutAlt, screen.path).toEqual([])
    expect(issues.fieldsWithoutLabel, screen.path).toEqual([])
  }
})
