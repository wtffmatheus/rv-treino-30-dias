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
  await expect(page.getByRole('heading', { name: 'Finalize sua inscrição.' })).toBeVisible()
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
  await page.bringToFront()
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
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
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


test('aluno configura FC de reserva, compara leitura e apaga dados locais', async ({ page }) => {
  await buy(page)
  await page.goto('/curso/rv30/dia/0')
  const section = page.locator('[data-cardio-section]')
  await expect(section.getByRole('heading', { name: 'Sua faixa cardíaca de treino' })).toBeVisible()
  await section.getByLabel('Idade (anos)').fill('30')
  await section.getByLabel('FC de repouso (bpm)').fill('86')
  await section.getByLabel('FC máxima medida em teste (bpm) — opcional').fill('187')
  await section.getByLabel('Condicionamento físico').selectOption('sedentario')
  await section.locator('[data-cardio-save]').check()
  await section.getByRole('button', { name: 'Calcular minha faixa' }).click()
  await expect(section.locator('[data-cardio-limits]')).toContainText('137 a 157 bpm')
  await section.locator('[data-cardio-current]').fill('150')
  await section.getByRole('button', { name: 'Comparar leitura' }).click()
  await expect(section.locator('[data-cardio-comparison]')).toContainText('dentro da faixa estimada')

  await page.reload()
  await expect(section.locator('[data-cardio-limits]')).toContainText('137 a 157 bpm')
  await expect(section.locator('[name=age]')).toHaveValue('30')
  await section.getByRole('button', { name: 'Apagar dados salvos' }).click()
  await expect(section.locator('[data-cardio-results]')).toBeHidden()
  await page.reload()
  await expect(section.locator('[data-cardio-results]')).toBeHidden()
  await expect(section.locator('[name=age]')).toHaveValue('')
})

test('modelo JSON do Google Drive cobre 30 aulas MOV sem links inventados', async ({ request }) => {
  const response = await request.get('/assets/data/rv30-videos-template.json')
  expect(response.ok()).toBeTruthy()
  const model = await response.json()
  expect(model.schemaVersion).toBe(1)
  expect(model.courseId).toBe('rv30')
  expect(model.items).toHaveLength(30)
  expect(model.items[0].name).toBe('1.mov')
  expect(model.items[29].name).toBe('30.mov')
  for (const item of model.items) expect(item.driveUrl).toBe('')
})


test('identidade RV 30: marca do pacote, fotos fornecidas e resumo do checkout', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.hero-visual .hero-portrait')).toHaveAttribute('src', '/assets/brand/rv-rosangela-clinica.webp')
  await expect(page.locator('#investimento .price-total [data-price-daily]')).toContainText('R$ 13,30')
  await expect(page.locator('#investimento .price-main [data-price-total]')).toContainText('R$ 399,00')
  await expect(page.locator('.hero h1')).toContainText('RV 30')
  await expect(page.locator('.rv30-program-signature .rv30-package-logo')).toHaveAttribute('src', '/assets/brand/rv30-logo.png')
  await expect(page.locator('.site-header .brand img')).toHaveAttribute('src', '/public/logo-rv.png')
  const accent = await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())
  expect(accent).toBe('#00bbb1')
  const navyPalette = await page.evaluate(() => {
    const background = selector => getComputedStyle(document.querySelector(selector)).backgroundColor
    return {
      page: background('.rv30-landing'),
      hero: background('.hero'),
      program: background('#proposta'),
      professional: background('#rosangela'),
      faq: background('.rv30-faq'),
      panel: background('.price-card')
    }
  })
  expect(navyPalette).toEqual({
    page: 'rgb(8, 21, 30)',
    hero: 'rgb(8, 21, 30)',
    program: 'rgb(16, 30, 40)',
    professional: 'rgb(16, 30, 40)',
    faq: 'rgb(16, 30, 40)',
    panel: 'rgb(20, 39, 50)'
  })
  const heroLayout = await page.locator('.hero-grid').evaluate(el => getComputedStyle(el).display)
  expect(heroLayout).toBe('grid')
  await page.locator('.hero-actions [data-buy]').click()
  await expect(page.getByRole('heading', { name: 'Finalize sua inscrição.' })).toBeVisible()
  await expect(page.locator('.rv-checkout .order-total [data-order-total]')).toHaveText('R$ 399,00')
  await expect(page.locator('.rv-checkout .check-row a')).toHaveCount(2)
  const bodyColor = await page.locator('.rv-checkout').evaluate(el => getComputedStyle(el).backgroundColor)
  expect(bodyColor).toBe('rgb(237, 242, 241)')
})

test('design RV em telas pequenas: sem rolagem horizontal na landing e no checkout', async ({ page }) => {
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of ['/', '/checkout/rv30']) {
      await page.goto(route)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, route + ' / ' + width).toBeLessThanOrEqual(1)
      await expect(page.locator('link[href*="rv-performance.css"]')).toHaveCount(1)
    }
  }
})

test('area do aluno: video permanece antes da calculadora e o progresso funciona', async ({ page }) => {
  await buy(page)
  await page.goto('/curso/rv30/dia/0')
  await expect(page.locator('[data-course-video]')).toBeVisible()
  await expect(page.locator('[data-cardio-section]')).toBeVisible()
  const order = await page.evaluate(() => {
    const a = document.querySelector('[data-course-video]')
    const b = document.querySelector('[data-cardio-section]')
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(order).toBe(true)
  await page.getByRole('button', { name: 'Marcar como concluído' }).click()
  await expect(page.locator('[data-complete]')).toHaveAttribute('aria-pressed', 'true')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('[data-day-picker]')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})


test('admin importa 30 arquivos MOV numéricos sem introdução obrigatória', async ({ page }) => {
  await adminLogin(page)
  await page.goto('/admin/videos')
  const model = await page.request.get('/assets/data/rv30-videos-template.json').then(r => r.json())
  const manifest = {
    ...model,
    items: model.items.map((item, i) => ({ ...item, driveUrl: 'https://drive.google.com/file/d/mov_day_' + (i + 1) + '/view' }))
  }
  await page.locator('[data-manifest]').setInputFiles({
    name: '30-mov.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(manifest))
  })
  await expect(page.locator('.media-row')).toHaveCount(30)
  await expect(page.locator('.media-day').first()).toHaveText('01')
  await expect(page.locator('.media-day').last()).toHaveText('30')
  for (let i = 1; i <= 30; i++) await page.getByLabel('Aprovar aula ' + String(i).padStart(2,'0'), { exact: true }).check()
  await page.locator('[data-confirm]').check()
  await expect(page.getByRole('button', { name: 'Aprovar lote' })).toBeEnabled()
  await page.getByRole('button', { name: 'Aprovar lote' }).click()
  await expect(page.locator('[data-feedback]')).toContainText('Nenhuma aula foi publicada')
})


test('novo aluno recebe convite cardíaco no primeiro acesso e pode pular sem bloqueio', async ({ page }) => {
  await buy(page)
  await page.goto('/curso/rv30/dia/0')
  const welcome = page.locator('[data-first-start]')
  await expect(welcome).toBeVisible()
  await expect(welcome).toContainText('Conheça sua faixa cardíaca')
  await expect(page.locator('[data-cardio-navigation]')).toHaveAttribute('href', '#calculadora-cardiaca')
  await welcome.getByRole('button', { name: 'Calcular minha faixa' }).click()
  await expect(welcome).toBeHidden()
  await expect(page.locator('[data-cardio-section] [name=age]')).toBeFocused()
  await page.reload()
  await expect(welcome).toBeHidden()
  await expect(page.locator('[data-course-video]')).toBeVisible()
})

test('novo aluno pode dispensar avaliacao sem salvar dados de saude', async ({ page }) => {
  await buy(page)
  await page.goto('/curso/rv30/dia/1')
  const welcome = page.locator('[data-first-start]')
  await expect(welcome).toBeVisible()
  await welcome.getByRole('button', { name: 'Continuar sem calcular' }).click()
  await expect(welcome).toBeHidden()
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('rv30-cardio-demo-v1:')))
  expect(keys).toHaveLength(0)
  await page.getByRole('button', { name: 'Marcar como concluído' }).click()
  await expect(page.locator('[data-complete]')).toHaveAttribute('aria-pressed', 'true')
})


test('composição RV 30 desktop e mobile mantém fotos, inscrição e checkout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const heading = page.locator('#hero-title')
  await expect(heading).toContainText('RV 30')
  await expect(page.locator('.hero-visual')).toBeVisible()
  await expect(page.locator('.hero-proof span')).toHaveCount(4)
  const desktop = await page.locator('.hero-grid').evaluate(e => getComputedStyle(e).display)
  expect(desktop).toBe('grid')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const heroPhotoPosition = await page.locator('.hero-visual').evaluate(e => getComputedStyle(e).position)
  expect(heroPhotoPosition).toBe('relative')
  const heroGeometry = await page.locator('.hero-grid').evaluate(el => {
    const copy = el.querySelector('.hero-copy').getBoundingClientRect()
    const photo = el.querySelector('.hero-visual').getBoundingClientRect()
    return { copyBottom: copy.bottom, photoTop: photo.top }
  })
  expect(heroGeometry.photoTop).toBeGreaterThanOrEqual(heroGeometry.copyBottom)
  await expect(page.locator('.hero-actions [data-buy]')).toBeVisible()
  await page.locator('.hero-actions [data-buy]').click()
  await expect(page.locator('.rv-checkout .checkout-card')).toBeVisible()
  const formPosition = await page.locator('.checkout-card').evaluate(e => e.getBoundingClientRect().top)
  const orderPosition = await page.locator('.order-card').evaluate(e => e.getBoundingClientRect().top)
  expect(formPosition).toBeLessThan(orderPosition)
})

test('menu RV de aluno e painel lateral da aula aparecem conforme tamanho de tela', async ({ page }) => {
  await buy(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/curso/rv30/dia/1')
  await expect(page.locator('.rv-student-nav')).toBeVisible()
  await expect(page.locator('.rv-lesson-grid .course-video')).toBeVisible()
  await expect(page.locator('.rv-lesson-details .daily-info article')).toHaveCount(4)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.rv-mobile-course-nav')).toBeVisible()
  await expect(page.locator('.rv-mobile-course-nav a')).toHaveCount(5)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await page.locator('.rv-mobile-course-nav a[href="#calculadora-cardiaca"]').click()
  await expect(page.locator('[data-cardio-section]')).toBeVisible()
})


test('retratos reais da Rosangela estão carregados e sem distorção em desktop e mobile', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    for (const selector of ['.hero-portrait', '.professional-photo img']) {
      const image = page.locator(selector)
      await image.scrollIntoViewIfNeeded()
      await expect(image).toBeVisible()
      await expect.poll(async () => image.evaluate(el => el.complete && el.naturalWidth > 1000 && el.naturalHeight > 1000)).toBe(true)
    }
    const heroFit = await page.locator('.hero-portrait').evaluate(el => getComputedStyle(el).objectFit)
    expect(heroFit).toBe('cover')
    if (width === 390) {
      const buybar = page.locator('.mobile-buybar')
      await expect(buybar).toContainText('R$ 399,00')
      await expect(buybar.locator('strong')).toContainText('RV 30')
      await expect(buybar.locator('small')).toContainText('R$ 399,00')
    }
    await page.goto('/checkout/rv30')
    const checkoutImg = page.locator('.rv-checkout-expert img')
    await checkoutImg.scrollIntoViewIfNeeded()
    await expect(checkoutImg).toBeVisible()
    await expect.poll(async () => checkoutImg.evaluate(el => el.complete && el.naturalWidth > 1000)).toBe(true)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  }
})


test('marca institucional RV Fisiologia e pacote RV 30 sem textos quebrados no catálogo', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.site-header .brand strong')).toHaveText('RV Fisiologia')
  await expect(page.locator('#hero-title')).toContainText('RV 30')
  await expect(page.locator('.hero-tagline')).toHaveText('Seu corpo. Seu ritmo. Sua evolução.')
  await expect(page.locator('.catalog-card')).toHaveCount(2)
  await expect(page.locator('.catalog-card').first()).toContainText('RV 30')
  await expect(page.locator('.catalog-card').last()).toContainText('Treinamento personalizado')
  const catalog = await page.locator('[data-catalog-grid]').innerText()
  expect(catalog).not.toMatch(/vÃ|orientaÃ|diÃ|ForÃ|EspaÃ|comentÃ|�/)
})

test('valor total em destaque e equivalência diária identificada sem inventar prazo de acesso', async ({ page }) => {
  await page.goto('/')
  const price = page.locator('#investimento')
  await expect(price.locator('.price-main')).toContainText('R$ 399,00')
  await expect(price.locator('.price-total')).toContainText('R$ 13,30')
  await expect(price.locator('.price-total')).toContainText('Não é cobrança diária')
  await expect(price.locator('.rv30-availability')).toContainText('Inscrições em preparação')
  const accessFaq = page.locator('details').filter({ hasText: 'Os 30 dias são o prazo de acesso?' })
  await accessFaq.locator('summary').click()
  await expect(accessFaq.locator('p')).toContainText('Os 30 dias descrevem a sequência do programa')
  await expect(page.locator('.mobile-buybar')).toContainText('R$ 399,00')
  await page.goto('/checkout/rv30')
  await expect(page.locator('.order-total')).toContainText('R$ 399,00')
  await expect(page.locator('.order-product')).toContainText('30 dias')
})

test('RV 30 conserva disposição mobile e bloqueia vendas públicas sem backend', async ({ page }) => {
  await page.route('**/assets/js/config.js*', async route => {
    const response = await route.fetch()
    const content = (await response.text())
      .replace('testMode: localHosts.includes(host)', 'testMode: false')
      .replace('enablePaymentSimulation: localHosts.includes(host)', 'enablePaymentSimulation: false')
    await route.fulfill({response, body:content})
  })
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:844})
    await page.goto('/')
    await expect(page.locator('#hero-title')).toContainText('RV 30')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow, 'RV 30 @ ' + width + 'px').toBeLessThanOrEqual(1)
    await expect(page.locator('.hero-actions [data-buy]')).toBeDisabled()
  }
})
