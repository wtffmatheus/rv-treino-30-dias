'use strict'
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { root, files } = require('./site-files')
const aliases = {
  '/': '/index.html', '/rv30': '/index.html', '/entrar': '/login.html', '/meus-cursos': '/aluno.html',
  '/checkout/rv30': '/checkout.html', '/curso/rv30': '/area.html', '/pagamento/sucesso': '/pagamento-confirmado.html',
  '/admin': '/admin.html', '/admin/entrar': '/admin-login.html', '/suporte': '/suporte.html',
  '/admin/suporte': '/suporte.html', '/admin/videos': '/admin-videos.html', '/privacidade': '/privacidade.html', '/termos': '/termos.html'
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' }
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
  const url = new URL(req.url, 'http://localhost')
  let route = aliases[url.pathname] || (/^\/curso\/rv30\/dia\/\d+$/.test(url.pathname) ? '/area.html' : url.pathname)
  const name = route.slice(1)
  const allowed = files.includes(name) && !name.startsWith('_')
  const file = path.join(root, allowed ? name : '404.html')
  res.writeHead(allowed ? 200 : 404, { 'Content-Type': types[path.extname(file)] || 'text/plain', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' })
  if (req.method === 'HEAD') res.end()
  else fs.createReadStream(file).pipe(res)
})
const port = Number(process.env.PORT || 8081)
server.listen(port, '127.0.0.1', () => console.log(`RV Cursos: http://127.0.0.1:${port}`))
server.on('error', (error) => { console.error(error.code === 'EADDRINUSE' ? 'Porta ocupada. Defina PORT com outra porta.' : 'Servidor indisponivel.'); process.exitCode = 1 })
