'use strict'

// Intended for an authorized preview build with existing environment injection.
// Never prints values, URLs, tokens, upstream messages, user records or responses.
// All network requests are GET; PostgREST always receives limit=0.
const REQUIRED_TABLES = {
  rv30_products:'id,title,status,price_cents,currency,commercial_approved',
  rv30_profiles:'user_id,name,status',
  rv30_lessons:'product_id,day,title,is_published,storage_path',
  rv30_orders:'id,user_id,product_id,amount_cents,currency,environment,status,payment_id',
  rv30_entitlements:'user_id,product_id,environment,order_id,status',
  rv30_progress:'user_id,product_id,environment,day',
  rv30_payment_events:'event_key,order_id,payment_id,provider_status,provider_updated_at,result'
}
const LEGACY_TABLES = ['rv_courses','rv_course_profiles','rv_course_lessons','rv_course_purchases','rv_course_enrollments','rv_course_progress','rv_course_comments','rv_course_admin_notes','rv_course_webhook_events','rv_course_audit_log']

function allowedOrigin(value) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || !['','/'].includes(parsed.pathname)) return null
    // Only hosted Supabase project endpoints. Custom domains need separate review.
    if (!/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname)) return null
    return parsed.origin
  } catch { return null }
}

async function auditEnvironment({ env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date() }={}) {
  const expected=['PUBLIC_SITE_URL','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL',
    'PAYMENT_PROVIDER','PAYMENT_URL','MERCADO_PAGO_ACCESS_TOKEN','MERCADO_PAGO_WEBHOOK_SECRET','MERCADO_PAGO_COLLECTOR_ID',
    'STONE_API_KEY','STONE_WEBHOOK_SECRET','RV30_SALES_ENABLED','VITE_ENABLE_PAYMENT_SIMULATION']
  const defined=Object.fromEntries(expected.map(key=>[key,Object.hasOwn(env,key)]))
  const flags=Object.fromEntries(expected.map(key=>[key,typeof env[key]==='string'&&env[key].trim().length>0]))
  const report = {
    version:1, auditedAt:now().toISOString(), scope:'GET only; zero PostgREST rows; no RPCs, payment requests or migrations',
    configurationDefined:defined, configurationPresent:flags,
    platform:{vercelDefined:Object.hasOwn(env,'VERCEL'),vercelNonempty:typeof env.VERCEL==='string'&&env.VERCEL.trim().length>0,
      environmentDefined:Object.hasOwn(env,'VERCEL_ENV'),environment:['preview','production','development'].includes(env.VERCEL_ENV)?env.VERCEL_ENV:'unknown'},
    originAllowed:false, auth:null, tables:[], verdict:'not_configured',
    limitations:['Does not inspect customer rows, actual indexes, relationships, existing RLS policy definitions or backups.',
      'Zero-row anonymous reads test table grants only; they do not prove isolation between authenticated users.',
      'Does not prove e-mail delivery, one-time token behavior, live sessions, signed videos or payment delivery.',
      'This report never authorizes enabling sales or publishing the application.']
  }
  const origin = allowedOrigin(env.SUPABASE_URL)
  report.originAllowed = Boolean(origin)
  if (!origin || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return report

  async function probe(path,key,settings=false) {
    try {
      const response = await fetchImpl(`${origin}${path}`,{ method:'GET',redirect:'error',signal:AbortSignal.timeout(6000),
        headers:{ apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json','Cache-Control':'no-store' } })
      const result = { httpStatus:response.status, ok:response.ok, errorCode:null }
      // Read only error-code metadata or documented non-personal Auth settings.
      if (settings || !response.ok) {
        let body
        try { body=await response.json() } catch {}
        if (!response.ok && /^[A-Z0-9_]{2,24}$/.test(String(body?.code || ''))) result.errorCode=body.code
        if (settings && response.ok) Object.assign(result,{
          emailProviderEnabled:typeof body?.external?.email==='boolean'?body.external.email:null,
          emailConfirmationRequired:typeof body?.mailer_autoconfirm==='boolean'?!body.mailer_autoconfirm:null,
          signupDisabled:typeof body?.disable_signup==='boolean'?body.disable_signup:null
        })
      }
      return result
    } catch (error) {
      return { httpStatus:null,ok:false,errorCode:error?.name==='TimeoutError' || error?.name==='AbortError'?'TIMEOUT':'REQUEST_FAILED' }
    }
  }
  report.auth=await probe('/auth/v1/settings',env.SUPABASE_ANON_KEY,true)
  const targets=[...Object.entries(REQUIRED_TABLES).map(([name,select])=>({name,select,kind:'required'})),...LEGACY_TABLES.map(name=>({name,select:'*',kind:'legacy'}))]
  // Bounded batches prevent a build audit from turning into a load test.
  for(let start=0;start<targets.length;start+=3){
    const batch=await Promise.all(targets.slice(start,start+3).map(async table=>{
      const query=new URLSearchParams({select:table.select,limit:'0'})
      const path=`/rest/v1/${table.name}?${query}`
      const privileged=await probe(path,env.SUPABASE_SERVICE_ROLE_KEY)
      const anonymous=table.kind==='required'?await probe(path,env.SUPABASE_ANON_KEY):null
      return {table:table.name,kind:table.kind,privileged,anonymous,
        anonymousGrantDenied:anonymous?[401,403].includes(anonymous.httpStatus):null}
    }))
    report.tables.push(...batch)
  }
  const required=report.tables.filter(table=>table.kind==='required')
  report.verdict=!report.auth.ok?'connection_error':required.some(table=>!table.privileged.ok)?'schema_or_access_pending':
    required.some(table=>!table.anonymousGrantDenied)?'anonymous_grants_need_review':'metadata_checks_passed_not_launch_approval'
  return report
}

if(require.main===module){
  auditEnvironment().then(report=>console.log(JSON.stringify(report))).catch(()=>{
    // Never include exception details: they can contain headers or configuration.
    console.log(JSON.stringify({version:1,verdict:'audit_failed',errorCode:'UNEXPECTED_AUDIT_FAILURE'}))
  })
}
module.exports={auditEnvironment,allowedOrigin,REQUIRED_TABLES,LEGACY_TABLES}
