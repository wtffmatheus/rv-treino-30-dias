'use strict'
const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './tests/e2e', timeout: 60000, workers: 1,
  outputDir: 'output/playwright/results', reporter: [['list'], ['json', { outputFile: 'output/playwright/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:8081', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'off' },
  webServer: { command: 'node scripts/dev-server.js', url: 'http://127.0.0.1:8081', reuseExistingServer: true, timeout: 10000 }
})
