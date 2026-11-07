import {sha,hashPassword,verifyPassword} from '../qa/core.mjs'
export const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code})}
const COOKIE='__Host-rv30_session',HOUR=3600000,IDLE=1800000
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')
export const sessionCookie=(token,seconds)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`
export const identityEvent=(db,user,actor,action,now)=>db.prepare('insert into identity_events(id,user_id,actor_id,action,at) values(?,?,?,?,?)').bind(crypto.randomUUID(),user,actor,action,now)
const staging=env=>env.PLATFORM_ENV!=='production'
export function requireSetup(env){if(!env.QA_DB||typeof env.AUTH_PASSWORD_PEPPER!=='string'||env.AUTH_PASSWORD_PEPPER.length<32||!['staging','production'].includes(env.PLATFORM_ENV))fail(503,'AUTH_NOT_CONFIGURED','O serviço de acesso está em configuração.')}
export async function rateLimit(env,key,maximum,now,period=900000){
 const hashed=await sha(key),window=Math.floor(now/period)
 const row=await env.QA_DB.prepare('insert into auth_limits(key,window,hits,expires_at) values(?,?,1,?) on conflict(key,window) do update set hits=hits+1 returning hits').bind(hashed,window,now+period*2).first()
 if(row.hits>maximum)fail(429,'RATE_LIMIT','Muitas tentativas. Aguarde alguns minutos e tente novamente.')
}
export async function authenticate(request,env,now=Date.now()){
 requireSetup(env)
 const token=String(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)
 if(!/^[a-f0-9]{64}$/.test(token||''))fail(401,'AUTH_REQUIRED','Entre na sua conta para continuar.')
 const tokenHash=await sha(token),db=env.QA_DB
 const user=await db.prepare(`select u.id,u.email,u.name,u.status,u.credential_version,m.kind,m.verified_at,m.verification_method,s.created_at as session_created,s.last_seen_at from auth_sessions s join qa_users u on u.id=s.user_id join identity_metadata m on m.user_id=u.id where s.token_hash=? and s.expires_at>? and s.last_seen_at>? and s.credential_version=u.credential_version`).bind(tokenHash,now,now-IDLE).first()
 if(!user||user.status!=='active'||!user.verified_at||staging(env)!==(user.kind==='validation'))fail(401,'SESSION_INVALID','Sua sessão terminou. Entre novamente.')
 const [roleRows,enrollment]=await Promise.all([db.prepare('select role from user_roles where user_id=? order by role').bind(user.id).all(),db.prepare("select * from enrollments where user_id=? and course_id='rv30'").bind(user.id).first()])
 const roles=roleRows.results.map(x=>x.role),hasAccess=roles.includes('student')&&!!enrollment&&!enrollment.revoked&&enrollment.starts_at<=now&&enrollment.expires_at>now
 if(now-user.last_seen_at>300000)await db.prepare('update auth_sessions set last_seen_at=? where token_hash=? and expires_at>?').bind(now,tokenHash,now).run()
 return{user:{...user,grant_expires:enrollment?.expires_at||null,revoked:enrollment?.revoked||0},roles,enrollment,tokenHash,isAdmin:roles.includes('admin'),hasAccess}
}
export function requireAdmin(session,now=Date.now(),fresh=false){
 if(!session.isAdmin)fail(403,'ADMIN_REQUIRED','Esta conta não tem autorização administrativa.')
 if(fresh&&now-session.user.session_created>900000)fail(403,'REAUTH_REQUIRED','Entre novamente no painel para confirmar esta alteração.')
}
export async function login(request,env,input,now=Date.now()){
 requireSetup(env)
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():''
 await rateLimit(env,'ip-login:'+String(request.headers.get('CF-Connecting-IP')||'shared'),100,now)
 await rateLimit(env,'email-login:'+email.slice(0,254),8,now)
 const password=typeof input.password==='string'&&input.password.length<=128?input.password:''
 const row=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254?await env.QA_DB.prepare('select u.*,m.kind,m.verified_at from qa_users u join identity_metadata m on m.user_id=u.id where u.email=?').bind(email).first():null
 const valid=await verifyPassword(password,row,env.AUTH_PASSWORD_PEPPER)
 if(!valid||!row||row.status!=='active'||!row.verified_at||staging(env)!==(row.kind==='validation'))fail(401,'LOGIN_FAILED','E-mail ou senha inválidos.')
 const token=random(),tokenHash=await sha(token),db=env.QA_DB
 const changes=await db.batch([
  db.prepare("insert into auth_sessions(token_hash,user_id,credential_version,created_at,last_seen_at,expires_at) select ?,id,credential_version,?,?,? from qa_users where id=? and credential_version=? and status='active'").bind(tokenHash,now,now,now+HOUR,row.id,row.credential_version),
  db.prepare("insert into identity_events(id,user_id,actor_id,action,at) select ?,user_id,user_id,'login',? from auth_sessions where token_hash=?").bind(crypto.randomUUID(),now,tokenHash),
  db.prepare('delete from auth_sessions where expires_at<=? or last_seen_at<=?').bind(now,now-IDLE),
  db.prepare('delete from auth_limits where expires_at<=?').bind(now),
  db.prepare('delete from identity_events where at<?').bind(now-90*86400000)
 ])
 if(changes[0].meta.changes!==1)fail(401,'SESSION_INVALID','A conta foi atualizada. Entre novamente.')
 const roles=await db.prepare('select role from user_roles where user_id=?').bind(row.id).all()
 return{token,user:{id:row.id,email:row.email},roles:roles.results.map(x=>x.role),testAccount:row.kind==='validation'}
}
export async function issueIdentityToken(env,session,userId,purpose,now=Date.now()){
 requireAdmin(session,now,true)
 if(!['invitation','recovery'].includes(purpose))fail(400,'TOKEN_PURPOSE','Escolha um tipo de convite válido.')
 await rateLimit(env,'invite:'+session.user.id,20,now,60000)
 const db=env.QA_DB,row=await db.prepare('select u.id,u.credential_version,u.status,m.kind from qa_users u join identity_metadata m on m.user_id=u.id where u.id=?').bind(userId).first()
 if(!row||row.status!=='active'||staging(env)!==(row.kind==='validation'))fail(404,'ACCOUNT_NOT_FOUND','Conta não localizada.')
 const token=random(),tokenHash=await sha(token)
 await db.batch([
  db.prepare('delete from identity_tokens where user_id=? or expires_at<=?').bind(userId,now),
  db.prepare('insert into identity_tokens(token_hash,user_id,purpose,credential_version,created_at,expires_at,created_by) values(?,?,?,?,?,?,?)').bind(tokenHash,userId,purpose,row.credential_version,now,now+1800000,session.user.id),
  identityEvent(db,userId,session.user.id,purpose+'_issued',now)
 ])
 return{ok:true,token,purpose,expiresAt:new Date(now+1800000).toISOString(),delivery:'manual_private',message:'Link de uso único. Entregue por um canal privado ao destinatário após conferir sua identidade. Nenhum e-mail foi enviado.'}
}
export async function acceptIdentityToken(env,input,now=Date.now()){
 requireSetup(env)
 if(!/^[a-f0-9]{64}$/.test(input.token||''))fail(400,'TOKEN_INVALID','Link inválido, expirado ou já utilizado.')
 const db=env.QA_DB,tokenHash=await sha(input.token)
 await rateLimit(env,'token:'+tokenHash,6,now)
 const row=await db.prepare(`select t.*,u.status,m.kind from identity_tokens t join qa_users u on u.id=t.user_id join identity_metadata m on m.user_id=u.id where t.token_hash=? and t.used_at is null and t.expires_at>? and t.credential_version=u.credential_version`).bind(tokenHash,now).first()
 if(!row||row.status!=='active'||staging(env)!==(row.kind==='validation'))fail(400,'TOKEN_INVALID','Link inválido, expirado ou já utilizado.')
 const hash=await hashPassword(input.password,env.AUTH_PASSWORD_PEPPER),claim=crypto.randomUUID()
 const results=await db.batch([
  db.prepare('update identity_tokens set used_at=?,claim_id=? where token_hash=? and used_at is null and expires_at>? and exists(select 1 from qa_users where id=? and credential_version=? and status=\'active\')').bind(now,claim,tokenHash,now,row.user_id,row.credential_version),
  db.prepare('update qa_users set password_salt=?,password_hash=?,credential_version=credential_version+1 where id=? and credential_version=? and exists(select 1 from identity_tokens where token_hash=? and claim_id=?)').bind(hash.salt,hash.hash,row.user_id,row.credential_version,tokenHash,claim),
  db.prepare('delete from auth_sessions where user_id=? and exists(select 1 from identity_tokens where token_hash=? and claim_id=?)').bind(row.user_id,tokenHash,claim),
  db.prepare("update identity_metadata set verified_at=coalesce(verified_at,?),verification_method=coalesce(verification_method,'invitation') where user_id=? and exists(select 1 from identity_tokens where token_hash=? and claim_id=?)").bind(now,row.user_id,tokenHash,claim),
  db.prepare('insert into identity_events(id,user_id,actor_id,action,at) select ?,user_id,user_id,?,? from identity_tokens where token_hash=? and claim_id=?').bind(crypto.randomUUID(),row.purpose+'_accepted',now,tokenHash,claim)
 ])
 if(results[0].meta.changes!==1||results[1].meta.changes!==1)fail(400,'TOKEN_INVALID','Link inválido, expirado ou já utilizado.')
 return{ok:true,message:'Senha definida. Entre com seu e-mail e a nova senha. As sessões anteriores foram encerradas.'}
}
