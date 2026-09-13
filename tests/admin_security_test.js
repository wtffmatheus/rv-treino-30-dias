'use strict'

const fs = require('fs')
const vm = require('vm')
const assert = require('assert')
const path = require('path')

class LocalStorageMock {
  constructor(){ this.map = new Map() }
  getItem(key){ return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value){ this.map.set(key, String(value)) }
  removeItem(key){ this.map.delete(key) }
  clear(){ this.map.clear() }
}

global.localStorage = new LocalStorageMock()
global.window = {
  RV_COURSE_CONFIG: {
    testMode: true,
    demoAdmin: { email: 'admin@rvfisiologia.test', password: 'rv30admin' }
  }
}

vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../assets/js/auth-demo.js'), 'utf8'))
const auth = window.RVCourseAuthDemo
auth.resetAllDemoData()

const protectedReads = [
  () => auth.adminStudents('rv30'),
  () => auth.adminPendingOrders('rv30'),
  () => auth.adminCourseComments('qualquer', 'rv30'),
  () => auth.adminAudit(10)
]

for (const read of protectedReads) {
  assert.deepEqual(read(), [], 'leitura administrativa deve ficar vazia sem sessão admin')
}

const protectedWrites = [
  () => auth.adminSeedDemoData(),
  () => auth.adminUpdateStudent('x', { name:'X' }),
  () => auth.adminSetAccess('x', 'rv30', true),
  () => auth.adminResetProgress('x', 'rv30'),
  () => auth.adminSetDayProgress('x', 'rv30', 1, true),
  () => auth.adminAddNote('x', 'nota'),
  () => auth.adminReplyComment('x', 'rv30', 'c', 'resposta'),
  () => auth.adminMarkCommentsAnswered('x', 'rv30'),
  () => auth.adminCreateStudent({ name:'Pessoa Teste', email:'pessoa@teste.com', password:'12345678' }, 'rv30'),
  () => auth.adminCreateAccessFromOrder('x', '12345678')
]

for (const write of protectedWrites) {
  const result = write()
  assert.equal(result?.ok, false, 'mutação administrativa deve falhar sem sessão admin')
  assert.equal(result?.code, 'ADMIN_AUTH_REQUIRED')
}

assert.equal(auth.db(), null, 'snapshot completo não pode ser lido sem admin')
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)
assert(auth.db(), 'snapshot redigido deve ser acessível com admin')
assert.equal(auth.db().users.some((user) => 'password' in user), false, 'snapshot admin não deve expor senha')

auth.adminLogout()
assert.equal(auth.adminStudents('rv30').length, 0)

console.log('OK: admin_security_test.js confirmou guards de leitura/escrita e snapshot sem senha.')
