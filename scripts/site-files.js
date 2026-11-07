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
function assertPublishableFiles(list) {
  for (const file of list) {
    if (/\.(?:mov|mp4|m4v|webm)$|(?:^|\/)manifest\.private\.json$|\.private\./i.test(file)) {
      throw new Error('Arquivo de mídia ou manifesto privado bloqueado no build: ' + file)
    }
  }
}
// Shared by build, dev server and static checks: no accidental course uploads.
assertPublishableFiles(files)
module.exports = { root, files, assertPublishableFiles }
