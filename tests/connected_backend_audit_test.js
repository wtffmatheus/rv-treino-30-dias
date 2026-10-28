'use strict'
const assert=require('node:assert/strict')
const {auditEnvironment,allowedOrigin}=require('../scripts/audit-connected-backend')
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'anon-fixture-do-not-print',SUPABASE_SERVICE_ROLE_KEY:'service-fixture-do-not-print'}
;(async()=>{
  for(const url of ['http://fixture.supabase.co','https://fixture.supabase.co.evil.test','https://evil.test','https://fixture.supabase.co/rest/v1/','https://user:password@fixture.supabase.co','https://fixture.supabase.co?token=private','https://127.0.0.1'])assert.equal(allowedOrigin(url),null)
  const calls=[]
  const fetchImpl=async(raw,options)=>{
    const url=new URL(raw);calls.push({url,options})
    if(url.pathname==='/auth/v1/settings')return {ok:true,status:200,json:async()=>({external:{email:true},mailer_autoconfirm:false,disable_signup:false,privateDiagnostic:'upstream-message-must-not-appear'})}
    assert.equal(url.searchParams.get('limit'),'0')
    const anon=options.headers.apikey===env.SUPABASE_ANON_KEY
    return {ok:!anon,status:anon?403:200,json:async()=>anon?{code:'42501',message:'upstream-message-must-not-appear'}:[{email:'personal-data-must-not-appear'}]}
  }
  const report=await auditEnvironment({env,fetchImpl})
  assert.equal(report.verdict,'metadata_checks_passed_not_launch_approval')
  assert.equal(report.auth.emailConfirmationRequired,true)
  assert.equal(report.configurationDefined.SUPABASE_URL,true)
  assert.equal(report.configurationDefined.PUBLIC_SITE_URL,false)
  assert.equal(report.tables.length,17)
  assert.ok(calls.every(call=>call.options.method==='GET'&&call.options.redirect==='error'))
  assert.ok(!calls.some(call=>/rpc|users|payments/.test(call.url.pathname)))
  const serialized=JSON.stringify(report)
  for(const secret of [env.SUPABASE_URL,env.SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY,'personal-data-must-not-appear','upstream-message-must-not-appear'])assert.ok(!serialized.includes(secret))
  const noNetwork=await auditEnvironment({env:{...env,SUPABASE_URL:'https://not-approved.example'},fetchImpl:()=>{throw new Error('must not call')}})
  assert.equal(noNetwork.originAllowed,false);assert.equal(noNetwork.verdict,'not_configured')
  const empty=await auditEnvironment({env:{SUPABASE_URL:'',PUBLIC_SITE_URL:' ',PAYMENT_PROVIDER:'',VERCEL_ENV:'private-unexpected-marker'},fetchImpl:()=>{throw new Error('must not call')}})
  assert.equal(empty.configurationDefined.SUPABASE_URL,true)
  assert.equal(empty.configurationPresent.SUPABASE_URL,false)
  assert.equal(empty.configurationDefined.PUBLIC_SITE_URL,true)
  assert.equal(empty.configurationPresent.PUBLIC_SITE_URL,false)
  assert.equal(empty.platform.environmentDefined,true)
  assert.equal(empty.platform.environment,'unknown')
  assert.ok(!JSON.stringify(empty).includes('private-unexpected-marker'))
  const failed=await auditEnvironment({env,fetchImpl:async()=>{throw new Error(env.SUPABASE_SERVICE_ROLE_KEY)}})
  assert.equal(failed.verdict,'connection_error');assert.ok(!JSON.stringify(failed).includes(env.SUPABASE_SERVICE_ROLE_KEY))
  console.log('OK: auditoria remota usa somente GET, zero linhas, origem permitida e relatório sem segredos/dados pessoais; configuração inválida falha fechada.')
})().catch(error=>{console.error(error);process.exitCode=1})
