import {hashPassword} from '../qa/core.mjs'
import {requireSetup,fail,identityEvent} from './auth.mjs'
import {audit} from './admin-common.mjs'
export async function setOwnerValidationPassword(env,ownerEmail,role,password,now=Date.now()){
 requireSetup(env)
 // Only the private Access-protected review service can invoke this RPC.
 // This recovery path is deliberately unavailable for commercial identities.
 if(env.PLATFORM_ENV!=='staging'||!['admin','student'].includes(role)||typeof ownerEmail!=='string'||ownerEmail.toLowerCase()!==String(env.QA_ADMIN_EMAIL||'').toLowerCase())fail(403,'OWNER_REQUIRED','Recuperação restrita ao responsável pela homologação.')
 const email=String(role==='admin'?env.QA_ADMIN_EMAIL:env.QA_EMAIL||'').toLowerCase(),db=env.QA_DB
 const user=await db.prepare("select u.id,u.status from qa_users u join identity_metadata m on m.user_id=u.id join user_roles r on r.user_id=u.id where u.email=? and m.kind='validation' and r.role=?").bind(email,role).first()
 const actor=await db.prepare("select u.id from qa_users u join identity_metadata m on m.user_id=u.id join user_roles r on r.user_id=u.id where u.email=? and u.status='active' and m.kind='validation' and r.role='admin'").bind(ownerEmail.toLowerCase()).first()
 if(!user||user.status!=='active'||!actor)fail(403,'OWNER_ACCOUNT_PENDING','Confira as contas de validação e as permissões com o responsável.')
 const hash=await hashPassword(password,env.AUTH_PASSWORD_PEPPER)
 const changes=[
  db.prepare('update qa_users set password_salt=?,password_hash=?,credential_version=credential_version+1 where id=?').bind(hash.salt,hash.hash,user.id),
  db.prepare('delete from auth_sessions where user_id=?').bind(user.id),db.prepare('delete from identity_tokens where user_id=?').bind(user.id),
  identityEvent(db,user.id,actor.id,'owner_validation_password_set',now)
 ]
 if(env.PLATFORM_ADMIN_ENABLED==='true')changes.push(audit(db,{user:actor},'identity',user.id,'owner_validation_password_set',{role},now))
 await db.batch(changes)
 return{ok:true,message:role==='admin'?'Senha administrativa de homologação definida. As sessões anteriores foram encerradas.':'Senha do aluno de homologação definida. As sessões anteriores foram encerradas.'}
}
