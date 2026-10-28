'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = fs.readFileSync(path.join(__dirname, '../assets/js/api-client.js'), 'utf8')

async function summary(progress) {
  const window = { RV_COURSE_CONFIG: { testMode:false } }
  const document = { querySelectorAll:() => [], documentElement:{ classList:{ remove(){} } } }
  const fetch = async route => ({ ok:true, json:async () => {
    if (route === '/api/config') return { ok:true, configured:true, salesEnabled:false }
    if (route === '/api/account') return { ok:true, account:{ id:'fixture', entitlements:['rv30'] }, isAdmin:false }
    if (route === '/api/courses/rv30') return { ok:true, lessons:[], progress }
    throw new Error('Unexpected request in progress test')
  } })
  vm.runInNewContext(source, { window,document,fetch,AbortSignal,URLSearchParams,Intl })
  await window.RVApi.ready
  // JSON removes the VM realm prototype; values still come from the real adapter.
  return JSON.parse(JSON.stringify(window.RVCourseStore.courseProgressSummary('rv30')))
}

;(async () => {
  assert.deepEqual(await summary([]), { completed:0, percent:0, nextDay:1 }, 'first available training day is 1, not the untrackable introduction')
  assert.deepEqual(await summary([1,2,3]), { completed:3, percent:10, nextDay:4 }, 'continue resumes after completed days')
  assert.deepEqual(await summary([1,3,30]), { completed:3, percent:10, nextDay:2 }, 'an intermediate gap is preserved')
  assert.deepEqual(await summary(Array.from({ length:29 },(_,i)=>i+1)), { completed:29, percent:97, nextDay:30 })
  assert.deepEqual(await summary(Array.from({ length:30 },(_,i)=>i+1)), { completed:30, percent:100, nextDay:30 }, 'completed course stays within day 30 for review')
  assert.deepEqual(await summary([0,-1,1,1,1.5,31,'2']), { completed:1, percent:3, nextDay:2 }, 'invalid or duplicate days cannot distort progress')
  console.log('OK: 6 verificações do progresso real e retomada dos dias 1–30 passaram; APIs simuladas, sem acesso a dados reais.')
})().catch(error => { console.error(error); process.exitCode=1 })
