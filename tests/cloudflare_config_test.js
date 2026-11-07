'use strict'
// Static packaging/routing contract. The real Workers asset runtime is checked
// separately with wrangler dev; this parser does not claim to emulate Cloudflare.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { root, files } = require('../scripts/site-files')
const config = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'))

assert.equal(config.name, 'rv-treino-30-dias')
assert.match(config.compatibility_date, /^\d{4}-\d{2}-\d{2}$/)
assert.equal(path.resolve(root, config.assets.directory), path.join(root, 'dist'), 'o upload deve usar somente o resultado do build')
assert.equal(config.assets.html_handling, 'none', 'destinos .html dos proxies não devem ganhar redirecionamento canônico automático')
assert.equal(config.assets.not_found_handling, '404-page', 'página ausente não pode virar a landing com status de sucesso')
assert.equal(config.main, undefined, 'esta correção publica assets; não implanta a API Node como Worker')
assert.equal(config.assets.run_worker_first, undefined)
assert.ok(files.includes('_redirects'))
assert.ok(files.includes('_headers'))
assert.ok(files.includes('404.html'))
assert.ok(!files.some((file) => /^(?:backend\/|node_modules\/|\.git\/|\.env(?:\.|$))/.test(file)), 'arquivos privados e backend não entram no diretório de assets')

const redirects = fs.readFileSync(path.join(root, '_redirects'), 'utf8').split(/\r?\n/)
  .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [source, target, status] = line.split(/\s+/)
    const names = []
    const pattern = source.split('/').map((part) => {
      if (part.startsWith(':')) { names.push(part.slice(1)); return '([^/]+)' }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('/')
    return { source, target, status: Number(status), names, pattern: new RegExp(`^${pattern}$`) }
  })

function targetFor(route) {
  const pathname = new URL(route, 'https://assets.example.test').pathname
  for (const entry of redirects) {
    const matches = pathname.match(entry.pattern)
    if (!matches) continue
    const target = entry.names.reduce((value, name, index) => value.replace(`:${name}`, matches[index + 1]), entry.target)
    return { target, status: entry.status }
  }
  return null
}

const matrix = [
  ['/', '/index.html'],
  ['/entrar', '/login.html'],
  ['/meus-cursos', '/aluno.html'],
  ['/checkout/rv30', '/checkout.html?curso=rv30'],
  ['/curso/rv30', '/area.html'],
  ['/curso/rv30/dia/2', '/area.html?day=2'],
  ['/curso/rv30/dia/12', '/area.html?day=12'],
  ['/curso/rv30/dia/30', '/area.html?day=30'],
  ['/admin', '/admin.html'],
  ['/admin/entrar', '/admin-login.html'],
  ['/admin/videos', '/admin-videos.html'],
  ['/admin/suporte', '/suporte.html?perfil=admin'],
  ['/pagamento/sucesso', '/pagamento-confirmado.html']
]
for (const [route, expected] of matrix) {
  const result = targetFor(route)
  assert.ok(result, `rota sem configuração: ${route}`)
  assert.deepEqual(result, { target: expected, status: 200 }, route)
  const destination = new URL(result.target, 'https://assets.example.test')
  assert.equal(destination.origin, 'https://assets.example.test', 'proxies de assets devem continuar locais')
  assert.ok(files.includes(destination.pathname.slice(1)), `destino não faz parte do build: ${route}`)
}
assert.equal(targetFor('/api/config'), null, 'não transformar a API ausente em um arquivo HTML de sucesso')
assert.equal(targetFor('/api/orders'), null)
assert.equal(targetFor('/rota-inexistente'), null)

console.log(`Cloudflare: diretório dist, custom 404 e ${matrix.length} rotas estáticas válidos; nenhum Worker/API incluído no upload.`)
