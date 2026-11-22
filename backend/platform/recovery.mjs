// Password recovery with a 6-digit e-mail code. Codes are stored only as an
// HMAC keyed by AUTH_PASSWORD_PEPPER, expire in 10 minutes, accept at most 5
// attempts and are consumed once. A verified code only yields a short-lived
// identity token; the password itself changes in acceptIdentityToken.
import {sha} from '../qa/core.mjs'
import {fail,rateLimit,identityEvent,requireSetup} from './auth.mjs'
import {emailProvider,sendEmail,recoveryEmail} from './email.mjs'
const enc=new TextEncoder(),CODE_TTL=600000,RESEND=60000,MAX_ATTEMPTS=5,TOKEN_TTL=600000
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)))
const ip=request=>String(request.headers.get('CF-Connecting-IP')||'shared')
const staging=env=>env.PLATFORM_ENV!=='production'
const normalize=value=>typeof value==='string'?value.trim().toLowerCase():''
const validEmail=email=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
export function sixDigitCode(){
 // Rejection sampling keeps every code equally likely; never Math.random.
 const limit=4294967296-(4294967296%1000000),value=new Uint32Array(1)
 do crypto.getRandomValues(value);while(value[0]>=limit)
 return String(value[0]%1000000).padStart(6,'0')
}
const codeKey=env=>crypto.subtle.importKey('raw',enc.encode('rv30-recovery-code-v1\0'+env.AUTH_PASSWORD_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
export async function codeHash(env,id,code){return hex(await crypto.subtle.sign('HMAC',await codeKey(env),enc.encode(id+':'+code)))}
async function codeMatches(env,id,code,stored){
 const bytes=Uint8Array.from(/^[a-f0-9]{64}$/.test(stored||'')?stored.match(/../g):Array(32).fill('00'),x=>parseInt(x,16))
 return crypto.subtle.verify('HMAC',await codeKey(env),bytes,enc.encode(id+':'+code))
}
const GENERIC={ok:true,message:'Se este e-mail estiver cadastrado, enviaremos um código de 6 dígitos em instantes. Confira também a caixa de spam.',expiresInSeconds:CODE_TTL/1000,resendAfterSeconds:RESEND/1000}
export async function requestRecovery(request,env,input,now,ctx){
 requireSetup(env)
 if(!emailProvider(env))fail(503,'EMAIL_NOT_CONFIGURED','A recuperação por e-mail está em ativação. Fale com a equipe pelo suporte para receber um convite privado.')
 const email=normalize(input.email)
 if(!validEmail(email))fail(400,'EMAIL_INVALID','Informe um e-mail válido.')
 await rateLimit(env,'recovery-ip:'+ip(request),20,now)
 // Applies equally to unknown addresses, so a 429 reveals nothing about the account.
 await rateLimit(env,'recovery-email:'+email,5,now)
 const db=env.QA_DB,user=await db.prepare('select u.id,u.email,u.name,u.status,m.kind from qa_users u join identity_metadata m on m.user_id=u.id where u.email=?').bind(email).first()
 if(!user||user.status!=='active'||staging(env)!==(user.kind==='validation'))return GENERIC
 const last=await db.prepare('select max(created_at) as at from recovery_codes where user_id=?').bind(user.id).first()
 if(last?.at&&now-last.at<RESEND)return GENERIC
 const id=crypto.randomUUID(),code=sixDigitCode(),hash=await codeHash(env,id,code)
 await db.batch([
  db.prepare('update recovery_codes set consumed_at=? where user_id=? and consumed_at is null').bind(now,user.id),
  db.prepare('insert into recovery_codes(id,user_id,code_hash,created_at,expires_at) values(?,?,?,?,?)').bind(id,user.id,hash,now,now+CODE_TTL),
  db.prepare('delete from recovery_codes where expires_at<?').bind(now-86400000),
  identityEvent(db,user.id,user.id,'recovery_code_issued',now)
 ])
 const message=recoveryEmail(env,{name:user.name,code})
 const delivery=sendEmail(env,{to:user.email,...message})
  .then(()=>identityEvent(db,user.id,user.id,'recovery_email_sent',Date.now()).run())
  .catch(async error=>{
   // A failed delivery invalidates the code; the password is never touched here.
   console.error('recovery_email_failed',error?.code||error?.name||'unknown')
   await db.batch([db.prepare('update recovery_codes set consumed_at=? where id=? and consumed_at is null').bind(Date.now(),id),identityEvent(db,user.id,user.id,'recovery_email_failed',Date.now())])
  })
 // Same response and similar latency whether or not the address exists.
 if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery
 return GENERIC
}
export async function verifyRecovery(request,env,input,now){
 requireSetup(env)
 const email=normalize(input.email),code=typeof input.code==='string'?input.code.trim():''
 const invalid=()=>fail(400,'CODE_INVALID','Código incorreto ou expirado. Após 5 tentativas, solicite um novo código.')
 if(!validEmail(email)||!/^\d{6}$/.test(code))invalid()
 await rateLimit(env,'recovery-verify-ip:'+ip(request),30,now)
 const db=env.QA_DB,row=await db.prepare('select c.id,c.code_hash,c.user_id,u.credential_version,u.status,m.kind from recovery_codes c join qa_users u on u.id=c.user_id join identity_metadata m on m.user_id=u.id where u.email=? and c.consumed_at is null and c.expires_at>? order by c.created_at desc limit 1').bind(email,now).first()
 if(!row||row.status!=='active'||staging(env)!==(row.kind==='validation')){await codeMatches(env,'none',code,null);invalid()}
 // Count the attempt before comparing, so parallel guesses cannot exceed the limit.
 const counted=await db.prepare('update recovery_codes set attempts=attempts+1 where id=? and attempts<? and consumed_at is null and expires_at>? returning attempts').bind(row.id,MAX_ATTEMPTS,now).first()
 if(!counted)invalid()
 if(!await codeMatches(env,row.id,code,row.code_hash)){
  if(counted.attempts>=MAX_ATTEMPTS)await db.prepare('update recovery_codes set consumed_at=? where id=? and consumed_at is null').bind(now,row.id).run()
  invalid()
 }
 const consumed=await db.prepare('update recovery_codes set consumed_at=? where id=? and consumed_at is null').bind(now,row.id).run()
 if(consumed.meta.changes!==1)invalid()
 const token=random(),tokenHash=await sha(token)
 await db.batch([
  db.prepare('delete from identity_tokens where user_id=? or expires_at<=?').bind(row.user_id,now),
  db.prepare("insert into identity_tokens(token_hash,user_id,purpose,credential_version,created_at,expires_at,created_by) values(?,?,'recovery',?,?,?,?)").bind(tokenHash,row.user_id,row.credential_version,now,now+TOKEN_TTL,row.user_id),
  identityEvent(db,row.user_id,row.user_id,'recovery_code_verified',now)
 ])
 return{ok:true,token,expiresAt:new Date(now+TOKEN_TTL).toISOString(),message:'Código confirmado. Defina sua nova senha.'}
}
