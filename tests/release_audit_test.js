'use strict'
const assert = require('node:assert/strict')
const { check } = require('../scripts/release-audit.js')
const x = check()
const statuses = new Map(x.findings.map(p=>[p.code,p.status]))
assert(['NO_GO','REVIEW_REQUIRED'].includes(x.verdict))
assert.equal(statuses.get('drive_manifest_unique_30'), 'PASS')
assert.equal(statuses.get('no_private_drive_links_publicly'), 'PASS')
for (const code of ['price_gateway_configured','production_auth','protected_video_delivery']) {
  assert(['PASS','FAIL'].includes(statuses.get(code)), 'gate ausente: '+code)
}
if ([...statuses].some(([code, state]) => ['price_gateway_configured','production_auth','protected_video_delivery'].includes(code) && state === 'FAIL')) {
  assert.equal(x.verdict,'NO_GO')
}
assert(x.checkedFiles.length >= 7)
console.log('Release gate: bloqueios de vendas identificados e nenhum link privado publicado.')
