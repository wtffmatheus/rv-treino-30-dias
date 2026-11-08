import {fail,rateLimit} from './auth.mjs'
import {accountKind,text,audit} from './admin-common.mjs'
async function allowedThread(env,session,id,admin){
 const row=await env.QA_DB.prepare('select t.* from support_threads t join identity_metadata m on m.user_id=t.user_id where t.id=? and m.kind=?').bind(id,accountKind(env)).first()
 if(!row||(!admin&&row.user_id!==session.user.id))fail(404,'THREAD_NOT_FOUND','Atendimento não localizado.');return row
}
export async function supportList(env,session,admin,url){
 const status=url.searchParams.get('status')||'all',term=text(url.searchParams.get('q')||'','a busca',120).toLowerCase()
 if(!['all','open','answered','resolved','unread'].includes(status))fail(400,'FILTER_INVALID','Confira o filtro de atendimento.')
 const marker=admin?'admin_read_at':'student_read_at',sender=admin?'student':'admin'
 const rows=await env.QA_DB.prepare(`select t.*,u.name as student_name,(select count(*) from support_messages x where x.thread_id=t.id and x.sender_role=? and x.at>t.${marker}) as unread from support_threads t join qa_users u on u.id=t.user_id join identity_metadata m on m.user_id=t.user_id where m.kind=? and (?=1 or t.user_id=?) and (?='' or instr(lower(t.subject),?)>0 or (?=1 and instr(lower(u.name),?)>0)) and (? in('all','unread') or t.status=?) order by t.updated_at desc limit 100`).bind(sender,accountKind(env),admin?1:0,session.user.id,term,term,admin?1:0,term,status,status).all()
 return{ok:true,threads:rows.results.filter(x=>status!=='unread'||x.unread>0),limit:100}
}
export async function supportRead(env,session,id,admin,now){
 const thread=await allowedThread(env,session,id,admin),db=env.QA_DB
 const messages=await db.prepare('select id,sender_role,body,at from support_messages where thread_id=? order by at,id limit 500').bind(id).all()
 // A read marker is private UI state, not a business mutation. It never grants access.
 await db.prepare(`update support_threads set ${admin?'admin_read_at':'student_read_at'}=? where id=?`).bind(now,id).run()
 return{ok:true,thread,messages:messages.results,limit:500}
}
export async function supportCreate(env,session,input,now){
 await rateLimit(env,'support-new:'+session.user.id,5,now,3600000)
 const subject=text(input.subject,'o assunto',160,true),body=text(input.body,'a mensagem',4000,true),day=input.day??null
 if(day!==null&&(!Number.isInteger(day)||day<1||day>30))fail(400,'DAY_INVALID','Informe um dia entre 1 e 30.')
 const db=env.QA_DB,id=crypto.randomUUID()
 await db.batch([
  db.prepare("insert into support_threads(id,user_id,subject,day,status,created_at,updated_at,student_read_at) values(?,?,?,?,'open',?,?,?)").bind(id,session.user.id,subject,day,now,now,now),
  db.prepare("insert into support_messages(id,thread_id,sender_id,sender_role,body,at) values(?,?,?,'student',?,?)").bind(crypto.randomUUID(),id,session.user.id,body,now),
  audit(db,session,'support',session.user.id,'support_created',{threadId:id,day},now)
 ])
 return{ok:true,id}
}
export async function supportReply(env,session,id,input,admin,now){
 await allowedThread(env,session,id,admin);await rateLimit(env,'support-reply:'+session.user.id,20,now,60000)
 const db=env.QA_DB,role=admin?'admin':'student'
 if(input.action==='status'){
  if(!admin||!['open','answered','resolved'].includes(input.status))fail(403,'SUPPORT_ACTION','Somente a equipe pode alterar o atendimento.')
  await db.batch([db.prepare('update support_threads set status=?,updated_at=? where id=?').bind(input.status,now,id),audit(db,session,'support',id,'support_status',{status:input.status},now)])
 }else{
  const body=text(input.body,'a mensagem',4000,true)
  const count=await db.prepare('select count(*) as n from support_messages where thread_id=?').bind(id).first()
  if(count.n>=500)fail(409,'THREAD_LIMIT','Este atendimento atingiu o limite. Abra uma nova solicitação.')
  await db.batch([
   db.prepare('insert into support_messages(id,thread_id,sender_id,sender_role,body,at) values(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,session.user.id,role,body,now),
   db.prepare(`update support_threads set status=?,updated_at=?,${admin?'admin_read_at':'student_read_at'}=? where id=?`).bind(admin?'answered':'open',now,now,id),
   audit(db,session,'support',id,'support_reply',{sender:role},now)
  ])
 }
 return{ok:true}
}
