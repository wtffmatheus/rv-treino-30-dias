'use strict'
const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')

test('gera capturas desktop e mobile para revisão visual por comparação', async ({ page }) => {
  const folder = path.resolve(__dirname, '../../output/qa-previews')
  fs.mkdirSync(folder, { recursive: true })
  const configs = [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'mobile', width: 390, height: 844 }
  ]
  for (const view of configs) {
    await page.setViewportSize({ width: view.width, height: view.height })
    for (const screen of [
      { name: 'landing', url: '/', ready: '#hero-title' },
      { name: 'checkout', url: '/checkout/rv30', ready: '[data-checkout-form]' },
      { name: 'aluno', url: '/curso/rv30?demo=1', ready: '[data-course-video]' }
    ]) {
      await page.goto(screen.url)
      await expect(page.locator(screen.ready)).toBeVisible()
      if (screen.name === 'checkout') {
        const nameColor = await page.locator('.portal-header .course-brand strong').evaluate(e => getComputedStyle(e).color)
        expect(nameColor).toBe('rgb(243, 247, 252)')
        const contrasts = await page.locator('.checkout-card h1 em, .order-product strong, .order-lines p span, .order-lines p strong, .order-daily-note, .order-card .tiny-note, .secure-note strong').evaluateAll(elements => {
          const luminance = rgb => rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0)
          const surface = luminance([23, 47, 73])
          return elements.filter(el => el.getClientRects().length).map(el => {
            const rgb = getComputedStyle(el).color.match(/[\d.]+/g).slice(0, 3).map(Number)
            const text = luminance(rgb)
            return { label: el.textContent.trim().slice(0, 45), ratio: (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05) }
          })
        })
        expect(contrasts.length).toBeGreaterThan(4)
        for (const item of contrasts) expect(item.ratio, item.label).toBeGreaterThanOrEqual(4.5)
      }
      await page.locator('body').evaluate(() => document.fonts?.ready)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      expect(overflow, screen.name + '-' + view.label).toBeLessThanOrEqual(1)
      await page.screenshot({
        path: path.join(folder, screen.name + '-' + view.label + '.png'),
        fullPage: false,
        animations: 'disabled'
      })
    }
  }
})
