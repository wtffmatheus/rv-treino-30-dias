'use strict'
// QA visual sweep: captures every main page at the breakpoints required by AGENTS.md
// using the same fixture-API pattern as tests/e2e/*.spec.js (no real credentials/backends).
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright-core')

const PORT = Number(process.env.PORT || 8081)
const BASE_URL = `http://127.0.0.1:${PORT}`
const OUT_DIR = path.resolve(__dirname, '../output/qa-previews')

const BREAKPOINTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 }
]

const studentAccount = { ok: true, account: { id: 'fixture-student', name: 'Aluno Fixture', email: 'student@example.test', status: 'active', roles: ['student'], entitlements: ['rv30'], testAccount: true }, isAdmin: false }
const adminAccount = { ok: true, account: { id: 'fixture-admin', name: 'Admin Fixture', email: 'admin@example.test', status: 'active', roles: ['admin'], entitlements: [], testAccount: true }, isAdmin: true }

const configFixture = { ok: true, configured: true, qaOnly: true, platformMode: true, platformIdentity: true, platformAdmin: true, salesEnabled: false }

const dashboardFixture = { ok: true, course: { title: 'RV 30', totalDays: 30 }, enrollment: { status: 'active', source: 'owner_validation', startsAt: '2026-11-07T15:00:00Z', expiresAt: '2027-11-07T15:00:00Z' }, progress: { completedDays: 2, percent: 7 }, activity: { validatedSeconds: 75, lastLessonDay: 15, lastActivityAt: '2026-11-07T16:00:00Z' }, resume: { day: 15, positionSeconds: 45 }, history: [{ day: 15, completed: false, lastOpenedAt: '2026-11-07T16:00:00Z' }], upcoming: [16, 17, 18], messages: [{ kind: 'pending', text: 'O dia 30 aguarda o arquivo.' }] }

const adminMetricsFixture = { ok: true, totals: { students: 2, blocked: 0, activeEnrollments: 1, expiredEnrollments: 0, newStudents: 2, activeStudents: 1, lessonsStarted: 3, lessonsCompleted: 1, averageProgress: 2, completionRate: 0, averageActivitySeconds: 21, pendingSupport: 0 }, activity: [], lessons: [], orders: [], definitions: { activity: 'Atividade de fixture', period: 'Período de fixture', notCompleted: 'Sem conclusão' } }

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockStudent(page) {
  await page.route('**/api/**', (route) => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/config') return json(route, configFixture)
    if (p === '/api/account') return json(route, studentAccount)
    if (p === '/api/student/dashboard') return json(route, dashboardFixture)
    if (p === '/api/courses/rv30') return json(route, { ok: true, courseId: 'rv30', lessons: [{ day: 1, title: 'Dia 01', available: true }] })
    if (p === '/api/support') return json(route, { ok: true, threads: [] })
    return json(route, { ok: false }, 404)
  })
}

async function mockAdmin(page) {
  await page.route('**/api/**', (route) => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/config') return json(route, configFixture)
    if (p === '/api/account') return json(route, adminAccount)
    if (p === '/api/admin/metrics') return json(route, adminMetricsFixture)
    if (p === '/api/admin/students') return json(route, { ok: true, students: [], total: 0, page: 1 })
    if (p === '/api/admin/orders') return json(route, { ok: true, orders: [], message: 'Gateway não homologado.' })
    if (p === '/api/admin/content') return json(route, { ok: true, course: { revision: 1, draft: { title: 'RV 30', description: '', priceCents: 49900, accessDurationDays: 365 } }, lessons: [] })
    if (p === '/api/admin/media') return json(route, { ok: true, media: [] })
    if (p === '/api/admin/uploads') return json(route, { ok: true, uploads: [] })
    if (p === '/api/support') return json(route, { ok: true, threads: [] })
    return json(route, { ok: false }, 404)
  })
}

const PAGES = [
  { name: 'landing', url: '/', ready: '#hero-title', mock: null },
  { name: 'login-aluno', url: '/entrar', ready: '[data-login-form]', mock: null },
  { name: 'login-admin', url: '/admin/entrar', ready: '[data-admin-login-form]', mock: null },
  { name: 'checkout', url: '/checkout/rv30', ready: '[data-checkout-form]', mock: null },
  { name: 'dashboard-aluno', url: '/meus-cursos', ready: '[data-course-list]', mock: mockStudent },
  { name: 'aula-player', url: '/curso/rv30?demo=1', ready: '[data-course-video]', mock: null },
  { name: 'admin-dashboard', url: '/admin', ready: '.platform-metric', mock: mockAdmin },
  { name: 'admin-alunos', url: '/admin?view=students', ready: 'h1,h2', mock: mockAdmin },
  { name: 'admin-videos', url: '/admin?view=media', ready: 'h1,h2', mock: mockAdmin },
  { name: 'suporte', url: '/suporte', ready: 'h1,h2', mock: mockStudent },
  { name: 'privacidade', url: '/privacidade', ready: 'h1', mock: null },
  { name: 'termos', url: '/termos', ready: 'h1', mock: null },
  { name: 'pagamento-confirmado', url: '/pagamento/sucesso', ready: 'h1', mock: null },
  { name: '404', url: '/isto-nao-existe-qa', ready: 'h1', mock: null }
]

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() - start > timeoutMs) return reject(new Error('dev server did not start in time'))
        setTimeout(tick, 300)
      })
    }
    tick()
  })
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const server = spawn(process.execPath, [path.resolve(__dirname, 'dev-server.js')], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  server.stdout.on('data', () => {})
  server.stderr.on('data', (chunk) => process.stderr.write(chunk))
  try {
    await waitForServer(BASE_URL)
    const browser = await chromium.launch()
    const consoleIssues = []
    const failedRequests = []
    try {
      for (const bp of BREAKPOINTS) {
        const context = await browser.newContext({ viewport: { width: bp.width, height: bp.height }, reducedMotion: 'reduce', baseURL: BASE_URL })
        const page = await context.newPage()
        page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) consoleIssues.push(`${bp.label} ${msg.type()} — ${msg.text()}`) })
        page.on('requestfailed', (request) => { failedRequests.push(`${bp.label} ${request.method()} ${request.url()} — ${request.failure()?.errorText}`) })
        page.on('response', (response) => { if (response.status() >= 400 && !response.url().includes('/isto-nao-existe-qa')) failedRequests.push(`${bp.label} ${response.status()} ${response.url()}`) })
        for (const entry of PAGES) {
          if (entry.mock) await entry.mock(page)
          else await page.unroute('**/api/**').catch(() => {})
          await page.goto(entry.url, { waitUntil: 'domcontentloaded' }).catch((error) => { consoleIssues.push(`${bp.label} ${entry.name} goto-error — ${error.message}`) })
          await page.locator(entry.ready).first().waitFor({ state: 'visible', timeout: 8000 }).catch((error) => { consoleIssues.push(`${bp.label} ${entry.name} ready-timeout — ${error.message}`) })
          await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {})
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => null)
          if (overflow !== null && overflow > 1) consoleIssues.push(`${bp.label} ${entry.name} horizontal-overflow — ${overflow}px`)
          await page.screenshot({ path: path.join(OUT_DIR, `${entry.name}-${bp.label}.png`), fullPage: true, animations: 'disabled' }).catch((error) => { consoleIssues.push(`${bp.label} ${entry.name} screenshot-error — ${error.message}`) })
        }
        await context.close()
      }
    } finally {
      await browser.close()
    }
    fs.writeFileSync(path.join(OUT_DIR, 'console-and-network-report.json'), JSON.stringify({ consoleIssues, failedRequests }, null, 2))
    console.log(`Screenshots salvos em ${OUT_DIR}`)
    console.log(`Problemas de console/rede: ${consoleIssues.length + failedRequests.length} (ver console-and-network-report.json)`)
  } finally {
    server.kill()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
