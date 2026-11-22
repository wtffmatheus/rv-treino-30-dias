'use strict'
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')
const { spawn } = require('node:child_process')

const PORT = 8099
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../output/rv30-redesign-final')

const SECTIONS = ['#inicio', '.benefits-strip', '#proposta', '#experiencia', '#rosangela', '#investimento', '#duvidas']

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => { fetch(url).then(() => resolve()).catch(() => { if (Date.now() - start > timeoutMs) return reject(new Error('timeout')); setTimeout(tick, 300) }) }
    tick()
  })
}

async function shootViewport(browser, vp) {
  const videoDir = path.join(OUT, 'animacoes', vp.label)
  fs.mkdirSync(videoDir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    recordVideo: { dir: videoDir, size: { width: vp.w, height: vp.h } }
  })
  const page = await context.newPage()
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const shotDir = path.join(OUT, 'screenshots', vp.label)
  fs.mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: path.join(shotDir, 'landing-full.png'), fullPage: true })

  for (const sel of SECTIONS) {
    const locator = page.locator(sel).first()
    if (await locator.count() === 0) continue
    await locator.scrollIntoViewIfNeeded()
    await page.waitForTimeout(650)
    const safe = sel.replace(/[^a-z0-9]/gi, '')
    await locator.screenshot({ path: path.join(shotDir, `${safe}.png`) }).catch(() => {})
  }

  const firstFaq = page.locator('.faq-list details').first()
  if (await firstFaq.count()) {
    await firstFaq.scrollIntoViewIfNeeded()
    await firstFaq.locator('summary').click()
    await page.waitForTimeout(500)
    await page.locator('.rv30-faq .faq-columns').first().screenshot({ path: path.join(shotDir, 'faq-open.png') }).catch(() => {})
  }

  await page.evaluate(async () => {
    const step = async (y, delay) => { window.scrollTo({ top: y, behavior: 'smooth' }); await new Promise((r) => setTimeout(r, delay)) }
    const max = document.body.scrollHeight
    for (let y = 0; y <= max; y += Math.round(window.innerHeight * 0.65)) await step(y, 550)
    await step(0, 600)
  })
  await page.waitForTimeout(400)

  await context.close()
  const files = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'))
  if (files.length) fs.renameSync(path.join(videoDir, files[0]), path.join(videoDir, `landing-scroll-${vp.label}.webm`))
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const server = spawn(process.execPath, [path.resolve(__dirname, 'dev-server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stderr.on('data', (c) => process.stderr.write(c))
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    await shootViewport(browser, { w: 1440, h: 900, label: 'desktop' })
    await shootViewport(browser, { w: 390, h: 844, label: 'mobile' })
    await browser.close()
    console.log('done')
  } finally {
    server.kill()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
