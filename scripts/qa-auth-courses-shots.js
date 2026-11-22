'use strict'
// Local visual QA for recovery, admin students/courses and "Meus cursos".
// Requires: PORT=8147 RV_STUDIO_QA=1 RV_LOCAL_OUTBOX=1 node scripts/qa-platform-repro-server.js
// The local outbox is a loopback capture, never a delivery provider.
const fs = require('node:fs'), path = require('node:path'), { chromium } = require('playwright')
// Each run writes to its own timestamped folder; nothing previous is deleted.
const RUN = 'run-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8147', OUT = path.join(__dirname, '..', 'output', 'qa-previews', 'auth-cursos', RUN)
const OUTBOX = path.join(__dirname, '..', 'output', 'local-outbox'), PASSWORD = 'TestPassword123!'
const sizes = [['mobile', 390, 844], ['desktop', 1440, 900]]
const only = process.argv[2] || 'all'
// Reads the newest captured message without removing older ones.
const latestMail = (after = 0) => { const files = fs.readdirSync(OUTBOX).filter(x => x.endsWith('.json') && Number(x.split('-')[0]) >= after).sort(); if (!files.length) throw new Error('Nenhuma mensagem nova na outbox local'); return JSON.parse(fs.readFileSync(path.join(OUTBOX, files.at(-1)), 'utf8')) }
;(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(OUTBOX, { recursive: true })
  const browser = await chromium.launch(), problems = []
  const page = async ([name, width, height], reduced = false) => {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
    const tab = await context.newPage()
    tab.on('pageerror', e => problems.push(name + ' pageerror ' + e.message))
    tab.on('console', m => { if (m.type() === 'error' && !/401|403|404/.test(m.text())) problems.push(name + ' console ' + m.text()) })
    return { context, tab }
  }
  const shot = async (tab, label) => {
    await tab.waitForTimeout(450)
    const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    if (overflow) problems.push(label + ': overflow horizontal')
    await tab.screenshot({ path: path.join(OUT, label + '.png'), fullPage: true })
  }
  const login = async (tab, email, password = PASSWORD, next = '/meus-cursos') => {
    await tab.goto(BASE + '/entrar?next=' + next); await tab.fill('[data-login-form] [name=email]', email); await tab.fill('[data-login-form] [name=password]', password)
    await Promise.all([tab.waitForURL(u => !u.pathname.startsWith('/entrar')), tab.click('[data-login-form] button[type=submit]')])
  }
  for (const size of sizes) {
    const [name] = size
    if (only === 'all' || only === 'recovery') {
      const { context, tab } = await page(size)
      await tab.goto(BASE + '/entrar'); await tab.waitForSelector('[data-recovery-open]:not([hidden])'); await shot(tab, name + '-01-login')
      await tab.click('[data-recovery-open]'); await shot(tab, name + '-02-recovery-email')
      // The server enforces a 60 s resend interval per account; respect it between viewports.
      if (global.lastRecovery && Date.now() - global.lastRecovery < 62000) await tab.waitForTimeout(62000 - (Date.now() - global.lastRecovery))
      global.lastRecovery = Date.now()
      const requestedAt = Date.now() - 1000
      await tab.fill('[data-recovery-step=email] [name=email]', 'golden@example.test'); await tab.click('[data-recovery-step=email] button[type=submit]')
      await tab.waitForSelector('[data-recovery-step=code]:not([hidden])'); await shot(tab, name + '-03-recovery-code')
      await tab.keyboard.type('000000'); await tab.waitForSelector('[data-recovery-step=code] [data-recovery-error]:not(:empty)'); await shot(tab, name + '-04-recovery-code-error')
      const mail = latestMail(requestedAt), code = mail.text.match(/recuperação: (\d{6})/)[1]
      fs.writeFileSync(path.join(OUT, name + '-email.html'), mail.html)
      await tab.locator('[data-code-inputs] input').first().focus(); await tab.keyboard.type(code)
      await tab.waitForSelector('[data-recovery-step=password]:not([hidden])'); await tab.fill('[data-recovery-step=password] [name=password]', 'curta'); await shot(tab, name + '-05-recovery-password')
      const fresh = 'NovaSenhaGolden' + name + '2026'
      await tab.fill('[data-recovery-step=password] [name=password]', fresh); await tab.fill('[data-recovery-step=password] [name=confirm]', fresh)
      await Promise.all([tab.waitForURL(/senha=redefinida/), tab.click('[data-recovery-step=password] button[type=submit]')])
      await shot(tab, name + '-06-recovery-success')
      await tab.fill('[data-login-form] [name=email]', 'golden@example.test'); await tab.fill('[data-login-form] [name=password]', fresh)
      await Promise.all([tab.waitForURL(/meus-cursos|aluno/), tab.click('[data-login-form] button[type=submit]')])
      await tab.waitForSelector('[data-my-courses] article'); await shot(tab, name + '-07-meus-cursos')
      await tab.goto(BASE + '/curso/mobilidade-essencial'); await tab.waitForSelector('[data-course-lessons] li'); await shot(tab, name + '-08-curso-adicional')
      // Restore the fixture password for the other scenarios.
      await context.close()
      const email = await (await browser.newContext()).newPage()
      await email.setContent(mail.html); await email.setViewportSize({ width: size[1], height: size[2] }); await email.screenshot({ path: path.join(OUT, name + '-09-email.png'), fullPage: true })
    }
    if (only === 'all' || only === 'admin') {
      const { context, tab } = await page(size)
      await login(tab, 'equipe@example.test', PASSWORD, '/meus-cursos'); await tab.goto(BASE + '/admin?view=students'); await tab.waitForSelector('.admin-view'); await shot(tab, name + '-10-admin-alunos')
      await tab.click('[data-new-student]'); await tab.waitForSelector('[data-student-create]'); await shot(tab, name + '-11-admin-novo-aluno')
      await tab.fill('[data-student-create] [name=name]', 'Aluna Visual ' + name); await tab.fill('[data-student-create] [name=email]', 'visual.' + name + '@example.test')
      await tab.check('[data-course-option=mobilidade-essencial] input[type=checkbox]'); await tab.check('[data-course-option=rv30] input[type=checkbox]'); await shot(tab, name + '-12-admin-cursos-selecionados')
      await tab.click('[data-student-create] button[type=submit]'); await tab.waitForSelector('[data-enrollments]'); await shot(tab, name + '-13-admin-ficha')
      await tab.goto(BASE + '/admin?view=courses'); await tab.waitForSelector('[data-course-admin]'); await shot(tab, name + '-14-admin-cursos')
      await context.close()
    }
  }
  await browser.close()
  console.log('Saída: ' + OUT)
  console.log(problems.length ? 'Problemas:\n' + problems.join('\n') : 'Sem erros de página ou overflow.')
})().catch(error => { console.error(error); process.exitCode = 1 })
