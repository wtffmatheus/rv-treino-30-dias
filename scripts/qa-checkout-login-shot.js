'use strict'
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')
const { spawn } = require('node:child_process')

const PORT = 8103
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../output/rv30-redesign-final')

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => { fetch(url).then(() => resolve()).catch(() => { if (Date.now() - start > timeoutMs) return reject(new Error('timeout')); setTimeout(tick, 300) }) }
    tick()
  })
}

async function main() {
  const server = spawn(process.execPath, [path.resolve(__dirname, 'dev-server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stderr.on('data', (c) => process.stderr.write(c))
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    for (const target of [
      { path: '/checkout/rv30', ready: '[data-checkout-form]', name: 'checkout' },
      { path: '/entrar', ready: '[data-login-form]', name: 'login' }
    ]) {
      for (const vp of [{ w: 1440, h: 1000, label: 'desktop' }, { w: 390, h: 1400, label: 'mobile' }]) {
        const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
        await page.goto(BASE + target.path, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForSelector(target.ready, { state: 'visible', timeout: 15000 })
        await page.waitForTimeout(400)
        const dir = path.join(OUT, 'screenshots', vp.label)
        fs.mkdirSync(dir, { recursive: true })
        await page.screenshot({ path: path.join(dir, `${target.name}-full.png`), fullPage: true })
        await page.close()
      }
    }
    await browser.close()
    console.log('done')
  } finally {
    server.kill()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
