'use strict'
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
function filesIn(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesIn(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`])
}
// Nao publicar o repositorio inteiro nem o public/ copiado do RV App.
const files = [
  ...fs.readdirSync(root).filter((name) => name.endsWith('.html')),
  ...filesIn('assets'),
  'public/logo-rv.png', 'public/icons/favicon-64.png', 'public/icons/apple-touch-icon.png',
  '_headers', '_redirects', 'robots.txt', 'sitemap.xml'
]
module.exports = { root, files }
