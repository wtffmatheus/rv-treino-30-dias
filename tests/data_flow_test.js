'use strict'

const fs = require('fs')
const vm = require('vm')
const assert = require('assert')

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

vm.runInThisContext(fs.readFileSync(require('path').join(__dirname, '../assets/js/auth-demo.js'), 'utf8'))
const auth = window.RVCourseAuthDemo

assert(auth, 'API de demonstração não foi criada')
auth.resetAllDemoData()

const order = auth.createDemoOrder({ courseId:'rv30', name:'Aluno Teste', email:'Aluno@Teste.com', phone:'11999999999', amountCents:39900 })
assert.equal(order.status, 'approved')
assert.equal(order.email, 'aluno@teste.com')
assert.equal(auth.claimApprovedOrder('123', order.id).ok, false, 'senha fraca não pode criar conta')

const claim = auth.claimApprovedOrder('Senha1234', order.id)
assert.equal(claim.ok, true)
assert.equal(claim.existing, false)
assert.equal(claim.user.email, 'aluno@teste.com')
assert(!('password' in claim.user), 'API pública não deve devolver senha')

assert.equal(auth.login('aluno@teste.com', 'errada').ok, false)
assert.equal(auth.login('aluno@teste.com', 'Senha1234').ok, true)
assert.equal(auth.isLoggedIn(), true)
assert.equal(auth.hasAccess('rv30'), true)

let studentSession = JSON.parse(localStorage.getItem(auth.storage.session))
studentSession.expiresAt = new Date(Date.now() - 1000).toISOString()
localStorage.setItem(auth.storage.session, JSON.stringify(studentSession))
assert.equal(auth.isLoggedIn(), false, 'sessão expirada precisa ser encerrada')
assert.equal(auth.login('aluno@teste.com', 'Senha1234').ok, true)

assert.equal(auth.setDayComplete('rv30', -1, true).ok, false)
assert.equal(auth.setDayComplete('rv30', 0, true).ok, true)
assert.equal(auth.setDayComplete('rv30', 1, true).ok, true)
let summary = auth.courseProgressSummary('rv30')
assert.equal(summary.completed, 1)
assert.equal(summary.nextDay, 2)

assert.equal(auth.addComment('rv30', 1, 'Minha dúvida').ok, true)
assert.equal(auth.comments('rv30', 1).length, 1)

assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'errada').ok, false)
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)
assert.equal(auth.isAdminLoggedIn(), true)
let adminSession = JSON.parse(localStorage.getItem(auth.storage.adminSession))
adminSession.expiresAt = new Date(Date.now() - 1000).toISOString()
localStorage.setItem(auth.storage.adminSession, JSON.stringify(adminSession))
assert.equal(auth.isAdminLoggedIn(), false, 'sessão admin expirada precisa ser encerrada')
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)

let students = auth.adminStudents('rv30')
assert.equal(students.length, 1)
assert.equal(students[0].openComments, 1)
assert.equal(students[0].completed, 1)
const userId = students[0].id

let adminComments = auth.adminCourseComments(userId, 'rv30')
assert.equal(adminComments.length, 1)
assert.equal(adminComments[0].day, 1)
assert.equal(auth.adminReplyComment(userId, 'rv30', adminComments[0].id, '').ok, false, 'resposta vazia não deve ser aceita')
assert.equal(auth.adminReplyComment(userId, 'rv30', adminComments[0].id, 'Resposta da equipe RV').ok, true)
adminComments = auth.adminCourseComments(userId, 'rv30')
assert.equal(adminComments[0].status, 'answered')
assert.equal(adminComments[0].adminReply.text, 'Resposta da equipe RV')
assert.equal(auth.comments('rv30', 1)[0].adminReply.text, 'Resposta da equipe RV', 'aluno deve receber a resposta do admin')
assert.equal(auth.adminStudents('rv30')[0].openComments, 0)

assert.equal(auth.addComment('rv30', 1, 'Segunda dúvida').ok, true)
assert.equal(auth.adminStudents('rv30')[0].openComments, 1)
assert.equal(auth.adminMarkCommentsAnswered(userId, 'rv30').ok, true)
assert.equal(auth.adminStudents('rv30')[0].openComments, 0)

assert.equal(auth.adminUpdateStudent(userId, { status:'blocked' }).ok, true)
auth.logout()
assert.equal(auth.login('aluno@teste.com', 'Senha1234').ok, false, 'aluno bloqueado não entra')
assert.equal(auth.adminUpdateStudent(userId, { status:'active' }).ok, true)
assert.equal(auth.login('aluno@teste.com', 'Senha1234').ok, true)

assert.equal(auth.adminSetAccess(userId, 'rv30', false).ok, true)
assert.equal(auth.hasAccess('rv30'), false)
assert.equal(auth.setDayComplete('rv30', 2, true).ok, false, 'sem entitlement não altera progresso')
assert.equal(auth.addComment('rv30', 2, 'não deve gravar').ok, false, 'sem entitlement não comenta')
assert.equal(auth.adminSetAccess(userId, 'rv30', true).ok, true)
assert.equal(auth.hasAccess('rv30'), true)

assert.equal(auth.adminResetProgress(userId, 'rv30').ok, true)
assert.equal(auth.adminStudents('rv30')[0].completed, 0)

const secondOrder = auth.createDemoOrder({ courseId:'rv30', name:'Aluno Teste', email:'aluno@teste.com', phone:'11999999999', amountCents:39900 })
const secondClaim = auth.claimApprovedOrder('', secondOrder.id)
assert.equal(secondClaim.ok, true)
assert.equal(secondClaim.existing, true, 'nova compra no mesmo e-mail deve usar a conta existente')
auth.logout()
assert.equal(auth.login('aluno@teste.com', 'Senha1234').ok, true, 'segunda compra não pode trocar a senha existente')

// Operações administrativas devem falhar sem uma sessão admin válida.
auth.adminLogout()
assert.equal(auth.adminStudents('rv30').length, 0)
assert.equal(auth.adminUpdateStudent(userId, { name:'Tentativa sem admin' }).ok, false)
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)

assert.equal(auth.adminCreateStudent({ name:'Novo', email:'aluno@teste.com', password:'12345678' }, 'rv30').ok, false, 'não pode duplicar e-mail')
const created = auth.adminCreateStudent({ name:'Outro Aluno', email:'outro@teste.com', phone:'11911110000', password:'aluno1234' }, 'rv30')
assert.equal(created.ok, true)
assert.equal(auth.adminStats('rv30').total, 2)

assert.equal(auth.adminSetDayProgress(created.user.id, 'rv30', 31, true).ok, false)
assert.equal(auth.adminSetDayProgress(created.user.id, 'rv30', 30, true).ok, true)

// Migração da V4 deve preservar conta, progresso e comentários de teste quando existirem.
auth.resetAllDemoData()
localStorage.setItem('rv-cursos-demo-account-v4', JSON.stringify({ name:'Legado', email:'legado@teste.com', password:'SenhaLegado', entitlements:['rv30'] }))
localStorage.setItem('rv-cursos-demo-order-v4', JSON.stringify({ id:'ord_legado', courseId:'rv30', name:'Legado', email:'legado@teste.com', phone:'11933334444', amountCents:39900, status:'approved', approvedAt:new Date().toISOString() }))
localStorage.setItem('rv30-progress-v4-legado-teste-com', JSON.stringify([0,1,2]))
localStorage.setItem('rv30-comments-v4-legado-teste-com', JSON.stringify({2:[{id:'cmt_legado',name:'Legado',text:'Dúvida antiga',createdAt:new Date().toISOString(),status:'open'}]}))
assert.equal(auth.adminStudents('rv30').length, 0, 'dados administrativos não podem ser lidos sem sessão admin')
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)
let legacyStudents = auth.adminStudents('rv30')
assert.equal(legacyStudents.length, 1)
assert.equal(legacyStudents[0].completed, 2)
assert.equal(auth.adminCourseComments(legacyStudents[0].id, 'rv30').length, 1)

// O painel não pode popular alunos fictícios quando já existe uma compra real/de teste pendente.
auth.resetAllDemoData()
const pending = auth.createDemoOrder({ courseId:'rv30', name:'Compra Pendente', email:'pendente@teste.com', phone:'11988887777', amountCents:39900 })
assert.equal(auth.adminSeedDemoData().ok, false, 'seed administrativo exige autenticação')
assert.equal(auth.adminLogin('admin@rvfisiologia.test', 'rv30admin').ok, true)
assert.equal(auth.adminSeedDemoData().skipped, true)
assert.equal(auth.adminStudents('rv30').length, 0)
assert.equal(auth.adminPendingOrders('rv30').length, 1)
assert.equal(auth.orderById(pending.id).email, 'pendente@teste.com')
const pendingAccess = auth.adminCreateAccessFromOrder(pending.id, 'aluno1234')
assert.equal(pendingAccess.ok, true, 'admin deve conseguir criar acesso a partir de compra aprovada')
assert.equal(auth.adminPendingOrders('rv30').length, 0)
assert.equal(auth.adminStudents('rv30').length, 1)

// Se alguém desligar testMode sem instalar o backend real, o adaptador demo deve falhar fechado.
window.RV_COURSE_CONFIG.testMode = false
assert.equal(auth.isLoggedIn(), false)
assert.equal(auth.isAdminLoggedIn(), false)
assert.equal(auth.currentOrder(), null)
assert.equal(auth.login('pendente@teste.com', 'qualquer').ok, false)
assert.equal(auth.createDemoOrder({ courseId:'rv30', email:'nao@pode.com' }).ok, false)
window.RV_COURSE_CONFIG.testMode = true

console.log('OK: data_flow_test.js passou por compra, conta, login, progresso, respostas de suporte, expiração de sessão, migração legada, controles administrativos e fail-closed do modo demo.')
