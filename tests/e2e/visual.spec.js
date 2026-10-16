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
        expect(nameColor).toBe('rgb(245, 252, 252)')
      }
      if (screen.name === 'landing') {
        await expect(page.locator('#investimento [data-price-total]').first()).toHaveText('R$ 399,00')
        await expect(page.locator('.mobile-buybar strong [data-price-total]')).toHaveText('R$ 399,00')
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
