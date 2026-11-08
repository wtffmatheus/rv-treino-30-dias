import {hashPassword} from '../qa/core.mjs'
import {fail,issueIdentityToken} from './auth.mjs'
import {accountKind,text,audit,adminWrite,findUser} from './admin-common.mjs'
export async function students(env,url,now){
 const term=text(url.searchParams.get('q')||'','a busca',120).toLowerCase(),filter=url.searchParams.get('status')||'all',page=Number(url.searchParams.get('page')||1)
 if(!['all','active','blocked','expired','revoked','none','inactive'].includes(filter)||!Number.isInteger(page)||page<1||page>10000)fail(400,'FILTER_INVALID','Confira os filtros.')
 const where=`m.kind=? and exists(select 1 from user_roles r where r.user_id=u.id and r.role='student') and (?='' or instr(lower(u.name),?)>0 or instr(u.email,?)>0)`
 const condition={all:'1',active:"u.status='active' and e.revoked=0 and e.starts_at<=? and e.expires_at>?",blocked:"u.status='blocked'",expired:'e.expires_at<=?',revoked:'e.revoked=1',none:'e.user_id is null',inactive:"not exists(select 1 from identity_events i where i.user_id=u.id and i.action='login' and i.at>?)"}[filter]
 const args=[accountKind(env),term,term,term,...(filter==='active'?[now,now]:filter==='expired'?[now]:filter==='inactive'?[now-30*86400000]:[])]
 const base=`from qa_users u join identity_metadata m on m.user_id=u.id left join enrollments e on e.user_id=u.id and e.course_id='rv30' where ${where} and ${condition}`
 const count=await env.QA_DB.prepare('select count(*) as n '+base).bind(...args).first()
 const rows=await env.QA_DB.prepare(`select u.id,u.name,u.email,u.status,u.created_at,m.verified_at,e.starts_at,e.expires_at,e.revoked,e.source,(select count(*) from qa_progress p where p.user_id=u.id) as completed,(select max(at) from identity_events i where i.user_id=u.id and action='login') as last_login,(select max(last_opened_at) from lesson_visits v where v.user_id=u.id) as last_activity ${base} order by u.created_at desc,u.id limit 25 offset ?`).bind(...args,(page-1)*25).all()
 const output=[]
 for(const row of rows.results){const progress=await env.QA_DB.prepare('select day from qa_progress where user_id=? order by day').bind(row.id).all();output.push({...row,hasAccess:row.status==='active'&&!row.revoked&&row.starts_at<=now&&row.expires_at>now,progress:progress.results.map(x=>x.day)})}
 return{ok:true,students:output,total:count.n,page,pageSize:25}
}
export async function studentDetail(env,id){
 const db=env.QA_DB,user=await findUser(env,id)
 const [profile,roles,enrollment,progress,history,activity,notes,events]=await Promise.all([
  db.prepare('select phone,updated_at from profiles where user_id=?').bind(id).first(),db.prepare('select role from user_roles where user_id=?').bind(id).all(),
  db.prepare('select * from enrollments where user_id=?').bind(id).all(),db.prepare('select day,completed_at from qa_progress where user_id=? order by day').bind(id).all(),
  db.prepare('select * from lesson_visits where user_id=? order by last_opened_at desc').bind(id).all(),db.prepare('select coalesce(sum(seconds),0) as seconds from activity_daily where user_id=?').bind(id).first(),
  db.prepare('select n.id,n.body,n.at,u.name as actor from admin_notes n join qa_users u on u.id=n.actor_id where user_id=? order by n.at desc limit 100').bind(id).all(),
  db.prepare(`select action,at,'identity' as entity from identity_events where user_id=? union all select action,at,entity from audit_events where subject_id=? order by at desc limit 100`).bind(id,id).all()
 ])
 return{ok:true,user,profile:profile||{phone:''},roles:roles.results.map(x=>x.role),enrollments:enrollment.results,progress:progress.results,history:history.results,activity,notes:notes.results,events:events.results}
}
export async function createStudent(env,session,input,now){
 await adminWrite(env,session,now)
 const name=text(input.name,'o nome',120,true),email=text(input.email,'o e-mail',254,true).toLowerCase(),phone=text(input.phone??'','o telefone',40)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'EMAIL_INVALID','Informe um e-mail válido.')
 const db=env.QA_DB;if(await db.prepare('select id from qa_users where email=?').bind(email).first())fail(409,'EMAIL_EXISTS','Já existe uma conta com esse e-mail.')
 // No administrator chooses or learns a student's password.
 const id=crypto.randomUUID(),random=crypto.randomUUID()+crypto.randomUUID(),hash=await hashPassword(random,env.AUTH_PASSWORD_PEPPER)
 await db.batch([
  db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind(id,email,name,hash.salt,hash.hash,now),
  db.prepare('insert into identity_metadata(user_id,kind) values(?,?)').bind(id,accountKind(env)),
  db.prepare("insert into user_roles(user_id,role,assigned_at,assigned_by) values(?,'student',?,?)").bind(id,now,session.user.id),
  db.prepare('insert into profiles(user_id,phone,updated_at) values(?,?,?)').bind(id,phone,now),
  audit(db,session,'student',id,'student_created',{kind:accountKind(env)},now)
 ])
 return{ok:true,id,message:'Perfil criado sem matrícula. Gere um convite privado para o aluno definir a senha.'}
}
export async function editStudent(env,session,id,input,now){
 await adminWrite(env,session,now);const user=await findUser(env,id),db=env.QA_DB,statements=[]
 if(input.action==='profile'){
  const name=text(input.name,'o nome',120,true),phone=text(input.phone??'','o telefone',40)
  statements.push(db.prepare('update qa_users set name=? where id=?').bind(name,id),db.prepare('insert into profiles(user_id,phone,updated_at) values(?,?,?) on conflict(user_id) do update set phone=excluded.phone,updated_at=excluded.updated_at').bind(id,phone,now))
 }else if(input.action==='note'){
  statements.push(db.prepare('insert into admin_notes(id,user_id,actor_id,body,at) values(?,?,?,?,?)').bind(crypto.randomUUID(),id,session.user.id,text(input.body,'a observação',2000,true),now))
 }else if(input.action==='validity'){
  const start=Date.parse(input.startsAt),end=Date.parse(input.expiresAt),current=await db.prepare("select source from enrollments where user_id=? and course_id='rv30'").bind(id).first()
  if(!current)fail(400,'ENROLLMENT_REQUIRED','Libere uma matrícula administrativa primeiro.')
  if(current.source==='payment')fail(403,'PAYMENT_ENROLLMENT_IMMUTABLE','A validade de uma compra deve seguir a confirmação do provedor.')
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>5*366*86400000)fail(400,'DATES_INVALID','Informe início e fim válidos, com período máximo de cinco anos.')
  statements.push(db.prepare("update enrollments set starts_at=?,expires_at=?,updated_at=? where user_id=? and course_id='rv30' and source!='payment'").bind(start,end,now,id))
 }else if(input.action==='role'){
  if(id===session.user.id)fail(400,'SELF_CHANGE','Outra pessoa autorizada deve alterar seus papéis.')
  if(typeof input.admin!=='boolean')fail(400,'ROLE_INVALID','Informe a permissão administrativa.')
  statements.push(input.admin?db.prepare("insert into user_roles(user_id,role,assigned_at,assigned_by) values(?,'admin',?,?) on conflict(user_id,role) do nothing").bind(id,now,session.user.id):db.prepare("delete from user_roles where user_id=? and role='admin'").bind(id),db.prepare('update qa_users set credential_version=credential_version+1 where id=?').bind(id),db.prepare('delete from auth_sessions where user_id=?').bind(id))
 }else fail(400,'ACTION_INVALID','Escolha uma alteração válida.')
 statements.push(audit(db,session,'student',user.id,'student_'+input.action,{fields:input.action==='profile'?['name','phone']:input.action==='validity'?['startsAt','expiresAt']:input.action==='role'?{admin:input.admin}:['note']},now));await db.batch(statements);return{ok:true}
}
export async function studentInvite(env,session,id,input,now){await findUser(env,id);return issueIdentityToken(env,session,id,input.purpose,now)}
