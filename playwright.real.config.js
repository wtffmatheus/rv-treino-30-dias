'use strict'
const { defineConfig } = require('@playwright/test')
const baseURL = 'http://127.0.0.1:8093'
module.exports = defineConfig({
  testDir: './tests/e2e-real', timeout: 60000, workers: 1,
  outputDir: 'output/playwright-real/results', reporter: [['list']],
  use: { baseURL, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', trace: 'off' },
  webServer: { command: 'node scripts/qa-platform-repro-server.js', url: baseURL, reuseExistingServer: false, timeout: 15000 }
})
