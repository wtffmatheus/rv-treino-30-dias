const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const widths = [320, 360, 375, 390, 414, 768, 1024, 1280, 1366, 1440, 1920]

async function adminLogin(page) {
  await page.goto('/admin/entrar')
  await page.getByLabel('E-mail administrativo').fill('admin@rvfisiologia.test')
  await page.getByLabel('Senha', { exact: true }).fill('rv30admin')
  await page.getByRole('button', { name: 'Entrar no painel RV 30' }).click()
  await expect(page.getByRole('heading', { name: 'Gestão de alunos', exact: true }).first()).toBeVisible()
}
async function studentLogin(page) {
  await page.goto('/entrar')
  await page.getByLabel('E-mail', { exact: true }).fill('qa.aluno@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('SenhaTeste123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Meus cursos', exact: true })).toBeVisible()
}
async function buy(page) {
  await page.goto('/')
  await page.locator('.hero-actions [data-buy]').click()
  await expect(page.getByRole('heading', { name: 'Entre para o RV 30.' })).toBeVisible()
  await page.getByLabel('Nome completo').fill('Aluno de Teste')
  await page.getByLabel('E-mail', { exact: true }).fill('qa.aluno@example.test')
  await page.getByLabel('WhatsApp').fill('11999999999')
  await page.locator('[name=terms]').check()
  await page.getByRole('button', { name: 'Continuar para o pagamento', exact: true }).click()
  await page.getByRole('button', { name: 'Simular pagamento aprovado', exact: true }).click()
  await page.getByLabel('Crie sua senha').fill('SenhaTeste123')
  await page.getByLabel('Repita sua senha').fill('SenhaTeste123')
  await page.getByRole('button', { name: 'Criar meu acesso' }).click()
  await studentLogin(page)
}
async function openSupport(page) {
  await page.goto('/suporte')
  await page.getByRole('button', { name: 'Nova conversa' }).click()
  await page.getByLabel('Assunto', { exact: true }).fill('Dúvida sobre meu acesso')
  await page.getByLabel('Mensagem', { exact: true }).fill('Como acompanho meu progresso? <img src=x onerror=alert(1)>')
  await page.getByRole('button', { name: 'Iniciar conversa' }).click()
  await expect(page.getByRole('heading', { name: 'Dúvida sobre meu acesso' })).toBeVisible()
}

test('compra demo, progresso, comentario e conversa aluno-admin persistem', async ({ page, context }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  await buy(page)
  await page.goto('/curso/rv30/dia/0')
  await page.getByRole('button', { name: 'Marcar como concluído' }).click()
  await page.getByLabel('Comentário', { exact: true }).fill('Comentário persistente do teste E2E.')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await page.reload()
  await expect(page.getByText('Comentário persistente do teste E2E.', { exact: true })).toBeVisible()
  await expect(page.locator('[data-complete]')).toHaveAttribute('aria-pressed', 'true')
  await openSupport(page)
  await expect(page.locator('.chat-message img')).toHaveCount(0)
  const admin = await context.newPage()
  await adminLogin(admin)
  await admin.getByRole('link', { name: 'Central de suporte' }).click()
  await admin.getByRole('button', { name: /Dúvida sobre meu acesso/ }).click()
  await admin.getByLabel('Sua mensagem').fill('Você encontra o progresso em Meus cursos.')
  await admin.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByText('Você encontra o progresso em Meus cursos.', { exact: true })).toBeVisible()
  await admin.getByRole('button', { name: 'Resolver conversa' }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await studentLogin(page)
  await page.goto('/suporte')
  await page.getByRole('button', { name: /Dúvida sobre meu acesso/ }).click()
  await expect(page.getByText('Você encontra o progresso em Meus cursos.', { exact: true })).toBeVisible()
  await expect(page.locator('[data-status]')).toHaveText('Resolvida')
  fs.mkdirSync('output/playwright', { recursive: true })
  await page.screenshot({ path: 'output/playwright/suporte-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'output/playwright/suporte-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})

test('visitante e aluno nao entram no admin; query nao confirma pagamento', async ({ page }) => {
  for (const route of ['/curso/rv30', '/admin', '/admin/suporte', '/admin/videos', '/suporte']) {
    await page.goto(route)
    await expect(page.locator('form input[type=password]')).toBeVisible()
    expect(await page.locator('.chat-message').count()).toBe(0)
  }
  await page.goto('/pagamento/sucesso?status=approved')
  await expect(page.locator('[data-create-access-form]')).toBeHidden()
  await buy(page)
  await page.goto('/admin/suporte')
  await expect(page.getByLabel('E-mail administrativo')).toBeVisible()
})

test('revisao exige links, todos os dias e aceite; nao publica aulas', async ({ page }) => {
  await adminLogin(page)
  await page.getByRole('link', { name: 'Revisão de vídeos' }).click()
  await expect(page.getByRole('button', { name: 'Aprovar lote' })).toBeDisabled()
  const manifest = { schemaVersion: 1, courseId: 'rv30', items: Array.from({ length: 31 }, (_, day) => ({ name: `video aula ${String(day).padStart(2, '0')}.mp4`, driveUrl: `https://drive.google.com/file/d/test_${day}/view` })).reverse() }
  await page.locator('[data-manifest]').setInputFiles({ name: 'rv30.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(manifest)) })
  await expect(page.locator('.media-row')).toHaveCount(31)
  await expect(page.locator('.media-day').first()).toHaveText('00')
  for (let day = 0; day <= 30; day++) await page.getByLabel(`Aprovar aula ${String(day).padStart(2, '0')}`, { exact: true }).check()
  await expect(page.getByRole('button', { name: 'Aprovar lote' })).toBeDisabled()
  await page.locator('[data-confirm]').check()
  await page.getByRole('button', { name: 'Aprovar lote' }).click()
  await expect(page.getByText(/Nenhuma aula foi publicada/)).toBeVisible()
  await page.getByRole('heading', { name: 'Revisão de vídeos' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'output/playwright/videos-desktop.png', fullPage: false })
  await page.reload()
  await expect(page.getByLabel('Aprovar aula 00', { exact: true })).toBeChecked()
})

test('responsividade nas 11 larguras e assets sem quebra', async ({ page }) => {
  test.setTimeout(180000)
  await buy(page)
  await openSupport(page)
  await adminLogin(page)
  const measurements = []
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/', '/checkout/rv30', '/meus-cursos', '/curso/rv30/dia/0', '/admin', '/admin/videos', '/suporte', '/admin/suporte']) {
      await page.goto(route)
      if (route.includes('suporte')) await page.getByRole('button', { name: /Dúvida sobre meu acesso/ }).click()
      const result = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        broken: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src) }))
      measurements.push({ width, route, ...result })
      expect(result.scroll, `${width} ${route}`).toBeLessThanOrEqual(result.width)
      expect(result.broken, `${width} ${route}`).toEqual([])
      if (route === '/' && [390, 1440].includes(width)) await page.screenshot({ path: `output/playwright/landing-${width}.png`, fullPage: false })
    }
  }
  fs.writeFileSync('output/playwright/responsividade.json', JSON.stringify(measurements, null, 2))
})

test('menu mobile, formulario invalido, FAQ e navegacao de aula', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await expect(page.locator('[data-menu-toggle]')).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-menu-toggle]')).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.locator('[data-menu]').getByRole('link', { name: 'Já sou aluno' }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
  await page.goto('/')
  await page.locator('summary').filter({ hasText: 'Como tiro dúvidas durante o curso?' }).click()
  await expect(page.locator('details[open]')).toHaveCount(1)
  await page.goto('/checkout/rv30')
  await page.getByRole('button', { name: 'Continuar para o pagamento', exact: true }).click()
  await expect(page.locator('[data-test-payment]')).toBeHidden()
  await buy(page)
  await page.goto('/curso/rv30')
  await page.getByLabel('Selecionar dia').selectOption('8')
  await expect(page.locator('[data-day-pill]')).toHaveText('DIA 08')
  await page.getByRole('button', { name: 'Próximo' }).click()
  await expect(page.locator('[data-day-pill]')).toHaveText('DIA 09')
})
