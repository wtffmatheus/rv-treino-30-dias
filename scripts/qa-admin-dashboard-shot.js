'use strict'
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')
const { spawn } = require('node:child_process')

const PORT = 8102
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
    const p = new URL(route.request().url()).pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (p === '/api/config') return json({ ok: true, configured: true, qaOnly: true, platformMode: true, platformIdentity: true, platformAdmin: true, salesEnabled: false })
    if (p === '/api/account') return json({ ok: true, account: { id: 'fixture', name: 'Matheus Trindade', email: 'admin@rvfisiologia.test', status: 'active', entitlements: [], roles: ['admin'] }, isAdmin: true })
    if (p === '/api/admin/metrics') return json({
      ok: true,
      totals: { students: 48, blocked: 1, activeEnrollments: 36, expiredEnrollments: 3, newStudents: 9, activeStudents: 22, lessonsStarted: 61, lessonsCompleted: 44, averageProgress: 38, completionRate: 17, averageActivitySeconds: 812, pendingSupport: 2 },
      activity: Array.from({ length: 14 }, (_, i) => ({ date_utc: `2026-11-${String(i + 7).padStart(2, '0')}`, seconds: Math.round(600 + Math.random() * 1800) })),
      lessons: Array.from({ length: 10 }, (_, i) => ({ day: i + 1, started: Math.round(20 - i * 1.3), completed: Math.round(14 - i), notCompleted: Math.round(6 - i * 0.3) })),
      orders: [],
      definitions: { activity: 'Reprodução visível validada pelo servidor; não comprova exercício ou atenção.', notCompleted: 'Aula iniciada sem conclusão marcada. Não é prova de abandono.', period: 'Período de 30 dias.' }
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
    for (const vp of [{ w: 1440, h: 1600, label: 'desktop' }, { w: 390, h: 2400, label: 'mobile' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
      page.on('console', (m) => console.log('[console]', m.type(), m.text()))
      page.on('pageerror', (e) => console.log('[pageerror]', e.message))
      await mockRoutes(page)
      await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded', timeout: 15000 })
      try {
        await page.waitForSelector('.platform-metrics--featured', { timeout: 15000 })
      } catch (e) {
        console.log('[body html]', (await page.content()).slice(0, 2000))
        throw e
      }
      await page.waitForTimeout(500)
      const dir = path.join(OUT, 'screenshots', vp.label)
      fs.mkdirSync(dir, { recursive: true })
      await page.screenshot({ path: path.join(dir, 'admin-dashboard-full.png'), fullPage: true })
      await page.close()
    }
    await browser.close()
    console.log('done')
  } finally {
    server.kill()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
