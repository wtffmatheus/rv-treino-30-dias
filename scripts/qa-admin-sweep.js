'use strict'
const path = require('node:path')
const { chromium } = require('playwright-core')
const { spawn } = require('node:child_process')

const PORT = 8094
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../output/qa-previews')

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockAdmin(page) {
  await page.route('**/api/**', (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname
    const q = new URL(req.url()).search
    if (p === '/api/config') return json(route, { ok: true, configured: true, platformMode: true, platformAdmin: true, salesEnabled: false, qaOnly: true })
    if (p === '/api/account') return json(route, { ok: true, account: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', roles: ['admin'], entitlements: [], testAccount: true }, isAdmin: true })
    if (p === '/api/admin/content') return json(route, {
      ok: true,
      course: { revision: 3, draft: { title: 'RV 30', description: 'Programa guiado de 30 dias com vídeos, orientação diária e acompanhamento de progresso.', priceCents: 49900, accessDurationDays: 365 } },
      lessons: Array.from({ length: 30 }, (_, i) => ({ day: i + 1, revision: 1, published: i < 15, draft: { title: `Dia ${i + 1}`, description: 'Treino do dia', objective: 'Objetivo do dia', instructions: 'Orientações', materials: [], warnings: [], durationLabel: '', order: i + 1, mediaId: i < 15 ? 'media-1' : null, coverId: null, editorialReviewed: i < 15 } }))
    })
    if (p === '/api/admin/media') return json(route, { ok: true, media: [
      { id: 'media-1', label: 'Dia 01 - treino completo.mp4', kind: 'video', state: 'ready', bytes: 184000000, width: 1920, height: 1080, duration: 612.4, format: 'video/mp4' },
      { id: 'media-2', label: 'Capa dia 02.png', kind: 'image', state: 'review', bytes: 2100000, width: 1200, height: 1500, format: 'image/png' },
      { id: 'media-3', label: 'Dia 03 - treino.mp4', kind: 'video', state: 'rejected', bytes: 95000000, width: 1280, height: 720, duration: 480, format: 'video/mp4' }
    ] })
    if (p === '/api/admin/uploads') return json(route, { ok: true, uploads: [], partBytes: 5242880 })
    if (p.startsWith('/api/admin/content/') && p.endsWith('/versions')) return json(route, { ok: true, versions: [{ revision: 2, action: 'Publicação', at: Date.now() - 86400000, actor: 'admin@example.test', id: 'v2' }, { revision: 1, action: 'Rascunho salvo', at: Date.now() - 172800000, actor: 'admin@example.test', id: 'v1' }] })
    if (p === '/api/admin/support') return json(route, { ok: true, threads: [
      { id: 't1', subject: 'Dúvida sobre o dia 12', student_name: 'Maria Silva', status: 'open', updated_at: Date.now() - 3600000, unread: 1 },
      { id: 't2', subject: 'Não consigo acessar o vídeo', student_name: 'Joao Souza', status: 'answered', updated_at: Date.now() - 7200000, unread: 0 },
      { id: 't3', subject: 'Como funciona a calculadora', student_name: 'Ana Paula', status: 'resolved', updated_at: Date.now() - 90000000, unread: 0 }
    ] })
    if (p === '/api/admin/support/t1') return json(route, { ok: true, thread: { subject: 'Dúvida sobre o dia 12', day: 12 }, messages: [{ sender_role: 'student', body: 'Não entendi a orientação do dia 12, pode explicar melhor?', at: Date.now() - 3600000 }] })
    if (p === '/api/admin/orders') return json(route, { ok: true, message: 'Gateway Mercado Pago em preparação. Nenhum pedido real foi confirmado ainda.', orders: [] })
    if (p === '/api/admin/audit') return json(route, { ok: true, events: [
      { at: Date.now() - 1000, actor: 'admin@example.test', entity: 'student', action: 'student_created', subject_id: 'aluno-1' },
      { at: Date.now() - 500000, actor: 'admin@example.test', entity: 'lesson', action: 'content_publish', subject_id: 'dia-12' },
      { at: Date.now() - 900000, actor: 'sistema', entity: 'identity', action: 'login', subject_id: null }
    ] })
    return json(route, { ok: false }, 404)
  })
}

const VIEWS = [
  { name: 'admin-content', url: '/admin?view=content' },
  { name: 'admin-media', url: '/admin?view=media' },
  { name: 'admin-support', url: '/admin?view=support' },
  { name: 'admin-orders', url: '/admin?view=orders' },
  { name: 'admin-audit', url: '/admin?view=audit' }
]

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'))
        setTimeout(tick, 300)
      })
    }
    tick()
  })
}

async function main() {
  const server = spawn(process.execPath, [path.resolve(__dirname, 'dev-server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stderr.on('data', (c) => process.stderr.write(c))
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    for (const vp of [{ w: 1440, h: 1200, label: 'desktop' }, { w: 390, h: 1200, label: 'mobile' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
      await mockAdmin(page)
      for (const view of VIEWS) {
        await page.goto(BASE + view.url, { waitUntil: 'networkidle' }).catch((e) => console.log('goto fail', view.name, e.message))
        if (view.name === 'admin-support') {
          await page.locator('.platform-thread').first().click().catch(() => {})
          await page.waitForTimeout(300)
        }
        await page.waitForTimeout(150)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        if (overflow > 1) console.log('OVERFLOW', view.name, vp.label, overflow)
        await page.screenshot({ path: path.join(OUT, `${view.name}-${vp.label}.png`), fullPage: true }).catch((e) => console.log('shot fail', view.name, e.message))
      }
      await page.close()
    }
    await browser.close()
    console.log('done')
  } finally {
    server.kill()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
