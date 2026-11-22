'use strict'
const path = require('node:path')
const { chromium } = require('playwright-core')
const { spawn } = require('node:child_process')
const PORT = 8097
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.resolve(__dirname, '../output/qa-previews')
const args = process.argv.slice(2)
const selector = args[0] || '#experiencia'
const name = args[1] || 'section'
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
    for (const vp of [{ w: 1440, h: 900, label: 'desktop' }, { w: 390, h: 844, label: 'mobile' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } })
      await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' })
      await page.locator(selector).scrollIntoViewIfNeeded()
      await page.waitForTimeout(150)
      await page.locator(selector).screenshot({ path: path.join(OUT, `${name}-${vp.label}.png`) })
      await page.close()
    }
    await browser.close()
    console.log('done')
  } finally { server.kill() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
