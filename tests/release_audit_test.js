'use strict'
const assert = require('node:assert/strict')
const { check } = require('../scripts/release-audit.js')
const x = check()
const statuses = new Map(x.findings.map(p=>[p.code,p.status]))
assert(['NO_GO','REVIEW_REQUIRED'].includes(x.verdict))
assert.equal(statuses.get('drive_manifest_unique_30'), 'PASS')
assert.equal(statuses.get('no_private_drive_links_publicly'), 'PASS')
assert.equal(statuses.get('sales_activation'), 'FAIL')
assert.equal(statuses.get('server_approved_access'), 'FAIL')
for (const code of ['price_gateway_configured','production_auth','protected_video_delivery']) {
  assert(['PASS','FAIL'].includes(statuses.get(code)), 'gate ausente: '+code)
}
if ([...statuses].some(([code, state]) => ['price_gateway_configured','production_auth','protected_video_delivery'].includes(code) && state === 'FAIL')) {
  assert.equal(x.verdict,'NO_GO')
}
assert(x.checkedFiles.length >= 7)
assert.equal(x.verdict, 'NO_GO', 'API preparada não equivale à comprovação de uma implantação real')
for (const code of ['server_api_prepared', 'payment_adapter_prepared', 'private_playback_adapter_prepared', 'database_migration_prepared', 'sales_disabled_by_default']) {
  assert.equal(statuses.get(code), 'PASS', 'preparação de código ausente: ' + code)
}
for (const code of ['production_auth', 'price_gateway_configured', 'protected_video_delivery', 'deployment_backend_verified', 'database_policies_verified']) {
  assert.equal(statuses.get(code), 'FAIL', 'não declarar verificação real sem evidência: ' + code)
}
assert.equal(x.verification.staticSourceOnly, true)
assert.equal(x.verification.livePaymentVerified, false)
assert.equal(x.inventory.authenticatedDriveChecked, false)
assert.equal(x.inventory.verifiedFiles, 0)
assert.deepEqual(x.inventory.linkedDays, [])
assert.deepEqual(x.inventory.pendingDays, Array.from({ length: 30 }, (_, i) => i + 1))
assert.match(x.inventory.historicalNote, /não foi revalidada/)
const lastDay = x.findings.find(finding => finding.code === 'day_30_drive_verified')
assert.match(lastDay.detail, /não verificado nesta sessão/)
assert.doesNotMatch(lastDay.detail, /30\.MOV ausente|foram encontrados 1\.MOV/)
console.log('Release gate: API preparada distinguida de homologação real; NO_GO, zero vídeos vinculados e inventário histórico não presumido.')
