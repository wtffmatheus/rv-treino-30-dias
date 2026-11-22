'use strict'
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')
const { spawn } = require('node:child_process')

const PORT = 8100
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../output/rv30-redesign-final')

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => { fetch(url).then(() => resolve()).catch(() => { if (Date.now() - start > timeoutMs) return reject(new Error('timeout')); setTimeout(tick, 300) }) }
    tick()
  })
}

async function mockRoutes(page) {
  await page.route('**/api/**', (route) => {
    const path_ = new URL(route.request().url()).pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path_ === '/api/config') return json({ ok: true, configured: true, qaOnly: true, platformMode: true, salesEnabled: false })
    if (path_ === '/api/account') return json({ ok: true, account: { id: 'fixture', name: 'Matheus Trindade', email: 'fixture@example.test', status: 'active', entitlements: ['rv30'], testAccount: true }, isAdmin: false })
    if (path_ === '/api/student/dashboard') return json({
      ok: true,
      course: { id: 'rv30', title: 'RV 30 — Treinos com Rosangela', totalDays: 30, availableDays: Array.from({ length: 24 }, (_, i) => i + 1) },
      enrollment: { status: 'active', source: null, startsAt: '2026-10-01T15:00:00Z', expiresAt: '2027-10-01T15:00:00Z' },
      progress: { completedDays: 12, percent: 40 },
      activity: { validatedSeconds: 920, lastLessonDay: 12, lastActivityAt: '2026-11-20T18:00:00Z' },
      resume: { day: 13, positionSeconds: 45 },
      history: Array.from({ length: 12 }, (_, i) => ({ day: i + 1, firstOpenedAt: '2026-11-01T15:00:00Z', lastOpenedAt: '2026-11-20T18:00:00Z', positionSeconds: 10, completed: true })),
      upcoming: [13, 14, 15],
      messages: [{ kind: 'pending', text: '24 vídeos disponíveis. Os dias 25 a 30 aguardam o arquivo e a aprovação do conteúdo.' }, { kind: 'privacy', text: 'O tempo de atividade considera intervalos de reprodução em uma página visível, limitados pelo servidor.' }],
      generatedAt: new Date().toISOString()
    })
    return json({ ok: false }, 404)
  })
}

async function main() {
  const server = spawn(process.execPath, [path.resolve(__dirname, 'dev-server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stderr.on('data', (c) => process.stderr.write(c))
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    for (const vp of [{ w: 1440, h: 1400, label: 'desktop' }, { w: 390, h: 2200, label: 'mobile' }]) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
      const page = await context.newPage()
      await mockRoutes(page)
      await page.goto(BASE + '/meus-cursos', { waitUntil: 'networkidle' })
      await page.waitForSelector('.student-plan', { timeout: 10000 })
      await page.waitForTimeout(500)
      const dir = path.join(OUT, 'screenshots', vp.label)
      fs.mkdirSync(dir, { recursive: true })
      await page.screenshot({ path: path.join(dir, 'aluno-dashboard-full.png'), fullPage: true })
      await context.close()
    }
    await browser.close()
    console.log('done')
  } finally {
    server.kill()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
