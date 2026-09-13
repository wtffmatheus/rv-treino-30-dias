'use strict'
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const assert = require('node:assert/strict')
const { root, files } = require('./site-files')
for (const file of files.filter((f) => f.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file })
for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(root, file), 'utf8')
  assert(html.includes('name="viewport"'), `${file}: viewport`)
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const target = match[1]
    if (/^(https?:|mailto:|tel:)/.test(target)) continue
    const local = target.replace(/^\//, '')
    if (!path.extname(local)) continue
    assert(files.includes(local), `${file}: referencia ausente ${target}`)
  }
}
assert(!files.some((f) => /public\/(?:videos|sw|manifest)|logo-rv-app|\.env|backend\//.test(f)))
console.log('OK: sintaxe JS, assets HTML e allowlist de deploy.')
