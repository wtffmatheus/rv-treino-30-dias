import {catalog,streamVideo} from '../review/handler.mjs'
export {authenticate as authenticateQa,body as readQaBody}
const enc=new TextEncoder()
const COOKIE='__Host-rv30_qa_session'
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow',...extra}})
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code})}
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')
const bytes=value=>Uint8Array.from(value.match(/../g)||[],x=>parseInt(x,16))
export async function sha(value){return hex(await crypto.subtle.digest('SHA-256',enc.encode(value)))}
async function passwordKey(password,salt,pepper){
 const input=await crypto.subtle.importKey('raw',enc.encode(password+'\0'+pepper),'PBKDF2',false,['deriveKey'])
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations:100000},input,{name:'HMAC',hash:'SHA-256',length:256},false,['sign','verify'])
}
export async function hashPassword(password,pepper,{preview=false}={}){
 const minimum=preview?6:12
 if(typeof password!=='string'||password.length<minimum||password.length>128)fail(400,'PASSWORD_INVALID',`Use uma senha de ${minimum} a 128 caracteres.`)
 if(typeof pepper!=='string'||pepper.length<32)fail(503,'QA_NOT_CONFIGURED','O acesso de validação ainda está em configuração.')
 const salt=hex(crypto.getRandomValues(new Uint8Array(32))),key=await passwordKey(password,salt,pepper)
 return{salt,hash:hex(await crypto.subtle.sign('HMAC',key,enc.encode('rv30-qa-password-v1')))}
}
async function verifyPassword(password,row,pepper){
 const valid=typeof row?.password_salt==='string'&&/^[a-f0-9]{64}$/.test(row.password_salt)&&/^[a-f0-9]{64}$/.test(row.password_hash||'')
 const key=await passwordKey(password,valid?row.password_salt:'0'.repeat(64),pepper)
 const matches=await crypto.subtle.verify('HMAC',key,bytes(valid?row.password_hash:'0'.repeat(64)),enc.encode('rv30-qa-password-v1'))
 return valid&&matches
}
export async function setTestPassword(env,password){
 const email=env.QA_EMAIL?.trim().toLowerCase()
 if(!email||!env.QA_DB)fail(503,'QA_NOT_CONFIGURED','A conta de validação ainda está em configuração.')
 const row=await env.QA_DB.prepare('select id from qa_users where email=? and status=\'active\'').bind(email).first()
 if(!row)fail(404,'QA_ACCOUNT_MISSING','Conta de validação não localizada.')
 const value=await hashPassword(password,env.QA_PASSWORD_PEPPER)
 await env.QA_DB.batch([
  env.QA_DB.prepare('update qa_users set password_salt=?,password_hash=?,credential_version=credential_version+1 where id=?').bind(value.salt,value.hash,row.id),
  env.QA_DB.prepare('delete from qa_sessions where user_id=?').bind(row.id)
 ])
 return{ok:true,message:'Senha definida. Entre no site com a conta de teste.'}
}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON_REQUIRED','Envie um formulário válido.')
 const reader=request.body?.getReader();let length=0;const chunks=[]
 if(reader)for(;;){const{value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>8192){await reader.cancel();fail(413,'BODY_TOO_LARGE','Formulário muito grande.')}chunks.push(value)}
 const buffer=new Uint8Array(length);let offset=0;for(const part of chunks){buffer.set(part,offset);offset+=part.length}
 try{const result=JSON.parse(new TextDecoder().decode(buffer));if(!result||Array.isArray(result)||typeof result!=='object')throw new Error();return result}catch{fail(400,'INVALID_JSON','Formulário inválido.')}
}
function cookie(token,maxAge){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
async function authenticate(request,env){
 const token=String(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)
 if(!/^[a-f0-9]{64}$/.test(token||''))fail(401,'AUTH_REQUIRED','Entre na conta de teste para continuar.')
 const tokenHash=await sha(token),now=Date.now()
 const user=await env.QA_DB.prepare(`select u.id,u.email,u.name,u.status,g.expires_at as grant_expires,g.revoked from qa_sessions s
 join qa_users u on u.id=s.user_id left join qa_grants g on g.user_id=u.id
 where s.token_hash=? and s.expires_at>? and s.credential_version=u.credential_version`).bind(tokenHash,now).first()
 const isAdmin=env.QA_PREVIEW==='true'&&!!env.QA_ADMIN_EMAIL&&user?.email===env.QA_ADMIN_EMAIL.trim().toLowerCase()
 if(!user||user.status!=='active'||(!isAdmin&&user.email!==env.QA_EMAIL.trim().toLowerCase()))fail(401,'SESSION_INVALID','Sua sessão terminou. Entre novamente.')
 return{user,tokenHash,isAdmin,hasAccess:!user.revoked&&user.grant_expires>now}
}
async function limit(request,env){
 const period=Math.floor(Date.now()/900000),key=await sha('login:'+String(request.headers.get('CF-Connecting-IP')||'unknown'))
 const row=await env.QA_DB.prepare('insert into qa_limits(key,window,hits) values(?,?,1) on conflict(key,window) do update set hits=hits+1 returning hits').bind(key,period).first()
 if(row.hits>10)fail(429,'RATE_LIMIT','Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
 await env.QA_DB.batch([env.QA_DB.prepare('delete from qa_limits where window<?').bind(period-1),env.QA_DB.prepare('delete from qa_sessions where expires_at<=?').bind(Date.now())])
}
export function createQaHandler(){return{async fetch(request,env){
 try{
  const url=new URL(request.url),origin=env.PUBLIC_SITE_URL
  if(!env.QA_DB||!env.QA_EMAIL||!env.QA_PASSWORD_PEPPER||env.QA_PASSWORD_PEPPER.length<32||!origin)fail(503,'QA_NOT_CONFIGURED','O acesso de validação está em configuração.')
  const requestOrigin=request.headers.get('origin'),preview=env.QA_PREVIEW==='true'
  const origins=preview?String(env.PREVIEW_ORIGINS||'').split(',').filter(Boolean):[origin]
  if(!['GET','HEAD'].includes(request.method)&&!origins.includes(requestOrigin))fail(403,'ORIGIN_REJECTED','Origem não autorizada.')
  const items=catalog({REVIEW_MEDIA_MANIFEST:env.QA_MEDIA_MANIFEST})
  if(!items||!env.VIDEOS)fail(503,'MEDIA_NOT_CONFIGURED','Os vídeos estão em configuração.')
  if(request.method==='GET'&&url.pathname==='/api/config')return json({ok:true,configured:true,qaOnly:true,salesEnabled:false,environment:'test',product:{id:'rv30',title:'RV 30',totalDays:30,priceCents:39900,currency:'BRL',accessDurationDays:365}})
  if(request.method==='POST'&&url.pathname==='/api/auth/login'){
   await limit(request,env);const input=await body(request)
   if(typeof input.email!=='string'||typeof input.password!=='string'||input.password.length<1||input.password.length>128)fail(401,'LOGIN_FAILED','E-mail ou senha inválidos.')
   const email=input.email.trim().toLowerCase(),allowed=[env.QA_EMAIL.trim().toLowerCase(),...(preview&&env.QA_ADMIN_EMAIL?[env.QA_ADMIN_EMAIL.trim().toLowerCase()]:[])],row=allowed.includes(email)?await env.QA_DB.prepare('select * from qa_users where email=?').bind(email).first():null
   const valid=await verifyPassword(input.password,row,env.QA_PASSWORD_PEPPER)
   if(!valid||row.status!=='active')fail(401,'LOGIN_FAILED','E-mail ou senha inválidos. A senha de teste é definida pelo responsável na área privada.')
   const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await sha(token)
   const result=await env.QA_DB.prepare(`insert into qa_sessions(token_hash,user_id,credential_version,expires_at)
    select ?,id,credential_version,? from qa_users where id=? and credential_version=? and status='active'`).bind(tokenHash,Date.now()+3600000,row.id,row.credential_version).run()
   if(result.meta.changes!==1)fail(401,'SESSION_INVALID','A senha foi atualizada. Entre novamente.')
   return json({ok:true,user:{id:row.id,email:row.email},isAdmin:preview&&email===env.QA_ADMIN_EMAIL?.trim().toLowerCase(),testAccount:true},200,{'Set-Cookie':cookie(token,3600)})
  }
  if(request.method==='POST'&&url.pathname==='/api/auth/logout'){
   const session=await authenticate(request,env);await env.QA_DB.prepare('delete from qa_sessions where token_hash=?').bind(session.tokenHash).run()
   return json({ok:true},200,{'Set-Cookie':cookie('',0)})
  }
  if(url.pathname.startsWith('/api/auth/'))fail(503,'PUBLIC_AUTH_PENDING','Cadastros e recuperação públicos ainda estão em preparação. A senha da conta de validação é definida na área privada do responsável.')
  if(url.pathname.startsWith('/api/orders')||url.pathname.startsWith('/api/webhooks'))fail(503,'SALES_DISABLED','Vendas reais continuam desativadas. Este acesso não registra pagamentos.')
  const session=await authenticate(request,env),user=session.user
  if(url.pathname.startsWith('/api/admin/')){
   if(!session.isAdmin)fail(403,'ADMIN_REQUIRED','Esta conta não tem acesso administrativo.')
   if(request.method==='GET'&&url.pathname==='/api/admin/students'){
    const rows=await env.QA_DB.prepare(`select u.id,u.name,u.email,u.status,g.expires_at,g.revoked from qa_users u left join qa_grants g on g.user_id=u.id where u.email=?`).bind(env.QA_EMAIL.trim().toLowerCase()).all()
    const students=[]
    for(const row of rows.results){const progress=await env.QA_DB.prepare('select day from qa_progress where user_id=? order by day').bind(row.id).all();students.push({...row,hasAccess:row.status==='active'&&!row.revoked&&row.expires_at>Date.now(),progress:progress.results.map(x=>x.day)})}
    return json({ok:true,students,qaOnly:true})
   }
   const match=url.pathname.match(/^\/api\/admin\/students\/([a-zA-Z0-9-]+)$/)
   if(match&&request.method==='PATCH'){
    const student=await env.QA_DB.prepare('select id from qa_users where id=? and email=?').bind(match[1],env.QA_EMAIL.trim().toLowerCase()).first()
    if(!student)fail(404,'STUDENT_NOT_FOUND','Aluno de teste não localizado.')
    const input=await body(request)
    if(['active','blocked'].includes(input.status))await env.QA_DB.batch([env.QA_DB.prepare('update qa_users set status=?,credential_version=credential_version+1 where id=?').bind(input.status,student.id),env.QA_DB.prepare('delete from qa_sessions where user_id=?').bind(student.id)])
    else if(input.access==='revoke')await env.QA_DB.prepare('update qa_grants set revoked=1 where user_id=?').bind(student.id).run()
    else if(input.access==='grant')await env.QA_DB.prepare("insert into qa_grants(user_id,source,expires_at,revoked) values(?,'owner_validation',?,0) on conflict(user_id) do update set revoked=0,expires_at=case when expires_at>? then expires_at else excluded.expires_at end").bind(student.id,Date.now()+365*86400000,Date.now()).run()
    else fail(400,'INVALID_ACTION','Escolha uma ação válida.')
    return json({ok:true})
   }
   fail(404,'API_NOT_FOUND','Operação administrativa indisponível neste teste.')
  }
  if(request.method==='GET'&&url.pathname==='/api/account')return json({ok:true,isAdmin:session.isAdmin,account:{id:user.id,email:user.email,name:user.name,status:'active',testAccount:true,accessSource:'owner_validation',entitlements:session.hasAccess?['rv30']:[],access:user.grant_expires?[{courseId:'rv30',status:session.hasAccess?'active':'expired',expiresAt:new Date(user.grant_expires).toISOString(),source:'owner_validation'}]:[]}})
  if(!session.hasAccess)fail(403,'PURCHASE_REQUIRED','O acesso de validação está vencido ou foi revogado.')
  if(request.method==='GET'&&url.pathname==='/api/courses/rv30'){
   const progress=await env.QA_DB.prepare('select day from qa_progress where user_id=? order by day').bind(user.id).all()
   return json({ok:true,courseId:'rv30',lessons:Array.from({length:30},(_,i)=>{const item=items.find(x=>x.day===i+1);return{day:i+1,title:`Dia ${String(i+1).padStart(2,'0')}`,description:'Vídeo disponibilizado para validação do RV 30.',is_published:!!item,available:!!item,durationSeconds:item?.duration||null}}),progress:progress.results.map(x=>x.day)})
  }
  const video=url.pathname.match(/^\/api\/courses\/rv30\/days\/([1-9]|[12]\d|30)\/(video|media)$/)
  if(video&&['GET','HEAD'].includes(request.method)){
   const item=items.find(x=>x.day===Number(video[1]));if(!item)fail(404,'VIDEO_PENDING','O vídeo deste dia ainda está pendente.')
   if(video[2]==='video')return json({ok:true,url:preview?`/api/courses/rv30/days/${item.day}/media`:`${origin}/api/courses/rv30/days/${item.day}/media`,expiresIn:Math.min(120,Math.floor((user.grant_expires-Date.now())/1000))})
   return streamVideo(request,env.VIDEOS,item)
  }
  const progress=url.pathname.match(/^\/api\/courses\/rv30\/progress\/([1-9]|[12]\d|30)$/)
  if(request.method==='PUT'&&progress){
   const day=Number(progress[1]),input=await body(request)
   if(typeof input.complete!=='boolean')fail(400,'INVALID_PROGRESS','Progresso inválido.')
   if(!items.some(x=>x.day===day))fail(409,'LESSON_PENDING','Este vídeo ainda está pendente.')
   if(input.complete)await env.QA_DB.prepare('insert into qa_progress(user_id,day,completed_at) values(?,?,?) on conflict(user_id,day) do update set completed_at=excluded.completed_at').bind(user.id,day,Date.now()).run()
   else await env.QA_DB.prepare('delete from qa_progress where user_id=? and day=?').bind(user.id,day).run()
   return json({ok:true})
  }
  fail(404,'API_NOT_FOUND','Operação não disponível neste ambiente de validação.')
 }catch(error){return json({ok:false,code:error.code||'INTERNAL_ERROR',message:error.code?error.message:'Não foi possível concluir a operação. Tente novamente.'},error.status||503)}
}}}
