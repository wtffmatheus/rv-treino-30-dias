'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { root, files } = require('./site-files')
const target = path.join(root, 'dist')
fs.mkdirSync(target, { recursive: true })
// Fail closed on stale or unexpected files; do not delete user files.
function verify(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) verify(full)
    else if (!files.includes(path.relative(target, full).split(path.sep).join('/'))) throw new Error(`Unexpected build file: ${full}`)
  }
}
verify(target)
for (const file of files) {
  const out = path.join(target, file)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.copyFileSync(path.join(root, file), out)
}
console.log(`Build: ${files.length} arquivos em dist/. Backend nao conectado; nao liberar vendas reais.`)
