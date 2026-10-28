'use strict'
// Integration check against wrangler dev --local, never against production.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = 'http://127.0.0.1:8787'
const root = path.resolve(__dirname, '..')
const routes = [
  ['/', 'index.html'], ['/entrar', 'login.html'], ['/meus-cursos', 'aluno.html'],
  ['/checkout/rv30', 'checkout.html'], ['/curso/rv30', 'area.html'],
  ['/curso/rv30/dia/2', 'area.html'], ['/curso/rv30/dia/12', 'area.html'],
  ['/curso/rv30/dia/30', 'area.html'], ['/admin', 'admin.html'],
  ['/admin/entrar', 'admin-login.html'], ['/admin/videos', 'admin-videos.html'],
  ['/admin/suporte', 'suporte.html'], ['/pagamento/sucesso', 'pagamento-confirmado.html'],
  ['/privacidade', 'privacidade.html'], ['/termos', 'termos.html']
]
async function run() {
  const checks = []
  for (const [route, file] of routes) {
    const response = await fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
    assert.equal(response.status, 200, `${route}: resposta deve ser o HTML, sem redirecionamento circular`)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route)
    assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/, route)
    const body = await response.text()
    assert.equal(body, fs.readFileSync(path.join(root, 'dist', file), 'utf8'), `${route}: conteúdo diferente do destino esperado`)
    checks.push({ route, status: response.status, file })
  }
  for (const file of ['/assets/brand/rv30-logo.png', '/assets/brand/rv-rosangela-clinica.webp', '/assets/css/rv30.css']) {
    const response = await fetch(base + file, { signal: AbortSignal.timeout(10000) })
    assert.equal(response.status, 200, file)
    assert.ok((await response.arrayBuffer()).byteLength > 0, file)
    checks.push({ route: file, status: response.status })
  }
  for (const route of ['/rota-inexistente', '/api/config', '/api/orders', '/.env', '/backend/server/api.js', '/wrangler.jsonc', '/package.json', '/_headers', '/_redirects']) {
    const response = await fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
    assert.equal(response.status, 404, `${route}: arquivo ausente/privado não pode servir a landing como sucesso`)
    checks.push({ route, status: response.status })
  }
  fs.mkdirSync(path.join(root, 'output'), { recursive: true })
  fs.writeFileSync(path.join(root, 'output/cloudflare-runtime.json'), JSON.stringify({ runtime: 'wrangler dev --local', base, checks }, null, 2))
  console.log(`Cloudflare runtime local: ${checks.length} verificações de rotas, assets, cabeçalhos e arquivos privados passaram.`)
}
run().catch(error => { console.error(error.message); process.exitCode = 1 })
