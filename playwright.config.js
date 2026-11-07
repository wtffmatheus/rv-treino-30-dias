'use strict'
const { defineConfig } = require('@playwright/test')
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8081'
const remote = Boolean(process.env.BASE_URL)
module.exports = defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 1,
  outputDir: 'output/playwright/results', reporter: [['list'], ['json', { outputFile: 'output/playwright/results.json' }]],
  use: { baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'off', ...(process.env.QA_STORAGE_STATE ? {storageState:process.env.QA_STORAGE_STATE} : {}) },
  ...(!remote ? {webServer: { command: 'node scripts/dev-server.js', url: baseURL, reuseExistingServer: true, timeout: 10000 }} : {})
})
