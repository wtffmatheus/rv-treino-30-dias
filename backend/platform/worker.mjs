import {readQaBody} from '../qa/core.mjs'
import {catalog,streamVideo} from '../review/handler.mjs'
import {studentDashboard,openActivity,recordActivity} from './student.mjs'
import {authenticate,login,sessionCookie,requireSetup,requireAdmin,issueIdentityToken,acceptIdentityToken,rateLimit,fail,identityEvent} from './auth.mjs'
import {listStudents,changeAccess} from './admin-access.mjs'
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow',...headers}})
// Resolve the clock per request; tests may inject an explicit clock.
export function createPlatformHandler({now=()=>Date.now()}={}){
 return{async fetch(request,env){
  try{
   requireSetup(env)
   const path=new URL(request.url).pathname,time=now(),db=env.QA_DB
   if(!['GET','HEAD'].includes(request.method)&&!String(env.PREVIEW_ORIGINS||'').split(',').filter(Boolean).includes(request.headers.get('origin')))fail(403,'ORIGIN_REJECTED','Origem não autorizada.')
   if(path==='/api/config'&&request.method==='GET'){
    await db.prepare('select count(*) as n from identity_metadata').first()
    return response({ok:true,configured:true,qaOnly:env.PLATFORM_ENV!=='production',platformMode:true,platformIdentity:true,salesEnabled:false,registrationEnabled:false,recoveryMode:'administrative_invite',environment:env.PLATFORM_ENV,activityRetentionDays:90,product:{id:'rv30',title:'RV 30',totalDays:30,priceCents:39900,currency:'BRL',accessDurationDays:365}})
   }
   if(path==='/api/auth/login'&&request.method==='POST'){
    const result=await login(request,env,await readQaBody(request),time)
    return response({ok:true,user:result.user,roles:result.roles,isAdmin:result.roles.includes('admin'),testAccount:result.testAccount},200,{'Set-Cookie':sessionCookie(result.token,3600)})
   }
   if(path==='/api/auth/accept'&&request.method==='POST'){
    await rateLimit(env,'accept-ip:'+String(request.headers.get('CF-Connecting-IP')||'shared'),60,time)
    return response(await acceptIdentityToken(env,await readQaBody(request),time),200,{'Set-Cookie':sessionCookie('',0)})
   }
   if(path==='/api/auth/logout'&&request.method==='POST'){
    try{const session=await authenticate(request,env,time);await db.batch([db.prepare('delete from auth_sessions where token_hash=?').bind(session.tokenHash),identityEvent(db,session.user.id,session.user.id,'logout',time)])}catch(error){if(error.status!==401)throw error}
    return response({ok:true},200,{'Set-Cookie':sessionCookie('',0)})
   }
   if(path.startsWith('/api/auth/'))fail(503,'PUBLIC_AUTH_PENDING','Cadastros públicos e envio automático de recuperação ainda não estão habilitados. Solicite um convite privado à equipe.')
   if(path.startsWith('/api/orders')||path.startsWith('/api/webhooks'))fail(503,'SALES_DISABLED','Vendas reais continuam desativadas. Nenhum pagamento é registrado neste ambiente.')
   const session=await authenticate(request,env,time),user=session.user
   if(path==='/api/account'&&request.method==='GET')return response({ok:true,isAdmin:session.isAdmin,roles:session.roles,account:{id:user.id,email:user.email,name:user.name,status:user.status,roles:session.roles,testAccount:user.kind==='validation',identityVerification:user.verification_method,entitlements:session.hasAccess?['rv30']:[],access:session.enrollment?[{courseId:'rv30',status:session.enrollment.revoked?'revoked':session.hasAccess?'active':session.enrollment.expires_at<=time?'expired':'restricted',startsAt:new Date(session.enrollment.starts_at).toISOString(),expiresAt:new Date(session.enrollment.expires_at).toISOString(),source:session.enrollment.source}]:[]}})
   if(path.startsWith('/api/admin/')){
    requireAdmin(session,time)
    if(path==='/api/admin/students'&&request.method==='GET')return response(await listStudents(env,time))
    const match=path.match(/^\/api\/admin\/students\/([a-zA-Z0-9-]+)$/)
    if(match&&request.method==='PATCH')return response(await changeAccess(env,session,match[1],await readQaBody(request),time))
    if(path==='/api/admin/identity-tokens'&&request.method==='POST'){
     const input=await readQaBody(request)
     if(typeof input.userId!=='string'||input.userId.length>100)fail(400,'ACCOUNT_INVALID','Escolha uma conta válida.')
     return response(await issueIdentityToken(env,session,input.userId,input.purpose,time))
    }
    fail(404,'API_NOT_FOUND','Operação administrativa em preparação.')
   }
   const items=catalog({REVIEW_MEDIA_MANIFEST:env.QA_MEDIA_MANIFEST})
   if(!items||!env.VIDEOS)fail(503,'MEDIA_NOT_CONFIGURED','O catálogo de vídeos está em configuração.')
   if(path==='/api/student/dashboard'&&request.method==='GET')return response(await studentDashboard(env,session,items,time))
   if(!session.hasAccess)fail(403,'PURCHASE_REQUIRED','Esta conta não tem matrícula ativa para o RV 30. Confira seu acesso em Meus cursos.')
   if(path==='/api/courses/rv30/activity/open'&&request.method==='POST')return response(await openActivity(env,session,items,await readQaBody(request),time))
   if(path==='/api/courses/rv30/activity/event'&&request.method==='POST')return response(await recordActivity(env,session,items,await readQaBody(request),time))
   if(path==='/api/courses/rv30'&&request.method==='GET'){
    const [progress,visits]=await Promise.all([db.prepare('select day from qa_progress where user_id=? order by day').bind(user.id).all(),db.prepare('select day,position_seconds from lesson_visits where user_id=?').bind(user.id).all()])
    return response({ok:true,courseId:'rv30',lessons:Array.from({length:30},(_,i)=>{const item=items.find(x=>x.day===i+1);return{day:i+1,title:`Dia ${String(i+1).padStart(2,'0')}`,description:'Vídeo disponibilizado para validação do RV 30.',is_published:!!item,available:!!item,durationSeconds:item?.duration||null}}),progress:progress.results.map(x=>x.day),positions:Object.fromEntries(visits.results.map(x=>[x.day,x.position_seconds]))})
   }
   const video=path.match(/^\/api\/courses\/rv30\/days\/([1-9]|[12]\d|30)\/(video|media)$/)
   if(video&&['GET','HEAD'].includes(request.method)){
    const item=items.find(x=>x.day===Number(video[1]));if(!item)fail(404,'VIDEO_PENDING','O vídeo deste dia ainda está pendente.')
    if(video[2]==='video')return response({ok:true,url:`/api/courses/rv30/days/${item.day}/media`,authorization:'session_per_request'})
    return await streamVideo(request,env.VIDEOS,item)
   }
   const progress=path.match(/^\/api\/courses\/rv30\/progress\/([1-9]|[12]\d|30)$/)
   if(progress&&request.method==='PUT'){
    const day=Number(progress[1]);if(!items.some(x=>x.day===day))fail(404,'VIDEO_PENDING','Conclua somente conteúdos disponíveis.')
    const input=await readQaBody(request);if(typeof input.complete!=='boolean')fail(400,'PROGRESS_INVALID','Informe se o conteúdo foi concluído.')
    const permitted="exists(select 1 from enrollments e join qa_users u on u.id=e.user_id join auth_sessions s on s.user_id=u.id and s.credential_version=u.credential_version join user_roles r on r.user_id=u.id and r.role='student' where e.user_id=? and e.course_id='rv30' and e.revoked=0 and e.starts_at<=? and e.expires_at>? and u.status='active' and s.token_hash=? and s.expires_at>?)"
    const bindings=[user.id,time,time,session.tokenHash,time]
    const results=await db.batch([
     db.prepare('select '+permitted+' as permitted').bind(...bindings),
     input.complete?db.prepare('insert into qa_progress(user_id,day,completed_at) select ?,?,? where '+permitted+' on conflict(user_id,day) do nothing').bind(user.id,day,time,...bindings):db.prepare('delete from qa_progress where user_id=? and day=? and '+permitted).bind(user.id,day,...bindings)
    ])
    if(!results[0].results[0].permitted)fail(403,'PURCHASE_REQUIRED','Sua matrícula não permite registrar esta conclusão.')
    return response({ok:true,day,complete:input.complete})
   }
   fail(404,'API_NOT_FOUND','Este recurso está em preparação.')
  }catch(error){return response({ok:false,code:error.code||'SERVICE_UNAVAILABLE',message:error.code?error.message:'Não foi possível concluir a operação. Tente novamente.'},error.status||503)}
 }}
}
export default createPlatformHandler()
