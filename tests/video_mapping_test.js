'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const memory = new Map()
const context = vm.createContext({
  window: { location: { hostname: 'localhost' } }, URL, URLSearchParams,
  localStorage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) },
  console, crypto: require('node:crypto').webcrypto
})
for (const file of ['config', 'auth-demo', 'media-review', 'delivery-check']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js', `${file}.js`), 'utf8'), context)
}
const media = context.window.RVMediaReview
const auth = context.window.RVCourseStore
const diagnostic = context.window.RVDeliveryDiagnostic.demoDiagnostic
const plain = (value) => JSON.parse(JSON.stringify(value))
const file = (day, name = `${day}.mov`) => ({ name, driveUrl: `https://drive.google.com/file/d/private_test_day_${day}/view`, revision: `test-${day}` })

for (const [name, expected] of [['01.MOV', 1], ['12 - Mobilidade.mp4', 12], ['Vídeo Aula 02.webm', 2], ['dia-30.m4v', 30], ['0.mov', 0]]) {
  assert.equal(media.parseDay(name), expected, name)
}
for (const name of ['12 - versão 2.mp4', 'dia 1 ou 2.mov', 'copia 3.mov', '3.mov.bak', '1extra.mov', 'treino.mp4', '1.mov/anything']) {
  assert.equal(media.parseDay(name), null, name)
}
const gaps = media.inventory([file(12), file(2), file(10), file(1)])
assert.deepEqual(plain(gaps.items.map((item) => item.day)), [1, 2, 10, 12], 'a ordenação é numérica')
assert.equal(gaps.missingDays.includes(3), true)
assert.equal(gaps.missingDays.includes(12), false, 'dia 12 não é deslocado quando falta dia 3')
assert.equal(gaps.linked, 4)
const duplicateDay = media.inventory([file(1), file(1, 'aula 1.mp4'), file(2)])
assert.deepEqual(plain(duplicateDay.items.map((item) => item.day)), [2], 'nenhuma alternativa de dia duplicado é escolhida')
assert.equal(duplicateDay.issues.every((issue) => issue.code === 'DUPLICATE_DAY'), true)
const duplicateSource = media.inventory([file(1), { ...file(2), driveUrl: file(1).driveUrl }, file(3)])
assert.deepEqual(plain(duplicateSource.items.map((item) => item.day)), [3], 'nenhuma cópia de arquivo repetido é aceita')
const ambiguity = media.inventory([file(12, '12 - treino 2.mov'), file(31), { ...file(3), day: 4 }, file(6)])
assert.deepEqual(plain(ambiguity.items.map((item) => item.day)), [6])
assert.equal(ambiguity.issues.length, 3)
assert.equal(media.inventory([{ name: '1.mov' }]).linked, 0, 'um nome no modelo não significa arquivo vinculado')
assert.equal(media.driveFileId('https://drive.google.com:9443/file/d/id/view'), null)
assert.equal(media.driveFileId('https://drive.google.com/file/d/id/view/evil'), null)
assert.equal(media.importAvailable('rv30', [file(1)]).ok, false, 'importação exige admin')
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)
const partial = media.importAvailable('rv30', [file(12), file(2), file(2, 'dia 2.mp4'), file(4)])
assert.equal(partial.ok, true, 'arquivos válidos continuam mesmo com conflito em outro dia')
assert.equal(partial.issues.length, 2, 'conflitos são informados')
assert.deepEqual(plain(media.list('rv30').map((item) => item.day)), [4, 12])
assert.equal(media.summary('rv30').missingDays.includes(2), true)
assert.equal(media.summary('rv30').linked, 2)
assert.equal(media.approveBatch('unknown').ok, false, 'curso inexistente não lança exceção')
assert.equal(media.import('rv30', [{ ...file(1), approved: true, approvedAt: '2026-01-01' }]).ok, true)
assert.equal(media.list('rv30').find((item) => item.day === 1).approved, false, 'aceite vindo do cliente é descartado')

const snapshot = { users: [{ id: 'buyer_1', email: 'qa@example.test', status: 'active', entitlements: ['rv30'] }], orders: [{ id: 'order_1', userId: 'buyer_1', courseId: 'rv30', status: 'approved', amountCents: 39900 }] }
const unchanged = JSON.stringify(snapshot)
const report = diagnostic(snapshot, 'order_1', [])
assert.equal(report.ok, true)
assert.equal(report.result, 'pending', 'uma simulação nunca comprova o pagamento real')
assert.equal(report.provider.confirmed, false)
assert.equal(report.account.id, 'buyer_1')
assert.equal(report.entitlement.exists, true)
assert.equal(report.lessons.missingDays.length, 30)
assert.equal(JSON.stringify(snapshot), unchanged, 'consulta não altera pedido, conta ou acesso')
assert.equal(diagnostic(snapshot, 'unknown').ok, false)
const unlinked = plain(snapshot)
unlinked.orders[0].userId = 'another_user'
unlinked.orders[0].email = 'qa@example.test'
assert.equal(diagnostic(unlinked, 'order_1').account, null, 'e-mail enviado pelo cliente não associa comprador')
const refunded = plain(snapshot)
refunded.orders[0].status = 'refunded'
assert.equal(diagnostic(refunded, 'order_1').result, 'error')
console.log('OK: numeração 1–30, lacunas preservadas, conflitos explícitos, importação parcial e diagnóstico de entrega somente leitura.')
