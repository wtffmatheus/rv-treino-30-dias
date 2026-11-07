import {fail,requireAdmin,identityEvent} from './auth.mjs'
export async function listStudents(env,now=Date.now()){
 const db=env.QA_DB,kind=env.PLATFORM_ENV==='production'?'commercial':'validation'
 const rows=await db.prepare(`select u.id,u.email,u.name,u.status,e.expires_at,e.revoked,e.starts_at from qa_users u join identity_metadata m on m.user_id=u.id join user_roles r on r.user_id=u.id and r.role='student' left join enrollments e on e.user_id=u.id and e.course_id='rv30' where m.kind=? order by u.created_at desc limit 100`).bind(kind).all()
 const students=[]
 for(const user of rows.results){const progress=await db.prepare('select day from qa_progress where user_id=? order by day').bind(user.id).all();students.push({...user,hasAccess:user.status==='active'&&!user.revoked&&user.starts_at<=now&&user.expires_at>now,progress:progress.results.map(x=>x.day)})}
 return{ok:true,students,qaOnly:kind==='validation'}
}
export async function changeAccess(env,session,userId,input,now=Date.now()){
 requireAdmin(session,now,true)
 if(userId===session.user.id)fail(400,'SELF_CHANGE','Use a gestão de permissões para alterar sua própria conta.')
 const db=env.QA_DB,row=await db.prepare('select u.id,m.kind from qa_users u join identity_metadata m on m.user_id=u.id where u.id=?').bind(userId).first()
 if(!row||(env.PLATFORM_ENV!=='production')!==(row.kind==='validation'))fail(404,'STUDENT_NOT_FOUND','Aluno não localizado.')
 const statements=[]
 let action
 if(['active','blocked'].includes(input.status)){
  action=input.status==='active'?'unblocked':'blocked'
  statements.push(db.prepare('update qa_users set status=?,credential_version=credential_version+1 where id=?').bind(input.status,userId),db.prepare('delete from auth_sessions where user_id=?').bind(userId))
 }else if(input.access==='revoke'){
  action='access_revoked';statements.push(db.prepare("update enrollments set revoked=1,updated_at=? where user_id=? and course_id='rv30'").bind(now,userId))
 }else if(input.access==='grant'){
  action='access_granted'
  statements.push(db.prepare("insert into enrollments(user_id,course_id,source,starts_at,expires_at,revoked,updated_at) values(?,'rv30',?,?,?,0,?) on conflict(user_id,course_id) do update set revoked=0,updated_at=excluded.updated_at,starts_at=case when expires_at>? then starts_at else excluded.starts_at end,expires_at=case when expires_at>? then expires_at else excluded.expires_at end").bind(userId,row.kind==='validation'?'owner_validation':'administrative',now,now+365*86400000,now,now,now),db.prepare("insert into user_roles(user_id,role,assigned_at,assigned_by) values(?,'student',?,?) on conflict(user_id,role) do nothing").bind(userId,now,session.user.id))
 }else fail(400,'INVALID_ACTION','Escolha uma ação válida.')
 statements.push(identityEvent(db,userId,session.user.id,action,now))
 await db.batch(statements)
 return{ok:true}
}
