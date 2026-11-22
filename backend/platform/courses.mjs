// Multi-course catalog. rv30 stays on its original tables (enrollments,
// lesson_records, qa_progress) so existing history is untouched; every other
// course uses course_enrollments, course_lessons and course_progress.
// Enrollment is an access grant, never a payment record.
import {streamVideo} from '../review/handler.mjs'
import {fail,identityEvent} from './auth.mjs'
import {text,audit,adminWrite,findUser,accountKind} from './admin-common.mjs'
import {privateImage} from './media.mjs'
const DAY=86400000,LEGACY='rv30'
const sourceFor=env=>accountKind(env)==='validation'?'owner_validation':'administrative'
const courseId=value=>{if(typeof value!=='string'||!/^[a-z0-9-]{2,40}$/.test(value))fail(404,'COURSE_NOT_FOUND','Curso não localizado.');return value}
const days=value=>{if(!Number.isInteger(value)||value<1||value>1830)fail(400,'DURATION_INVALID','Informe uma duração entre 1 e 1830 dias.');return value}
export const enrollmentStatus=(row,userStatus,now)=>!row?'none':userStatus==='blocked'?'blocked':row.revoked?'revoked':row.expires_at<=now?'expired':row.starts_at>now?'scheduled':'active'
async function course(env,id){const row=await env.QA_DB.prepare('select * from courses where id=?').bind(courseId(id)).first();if(!row)fail(404,'COURSE_NOT_FOUND','Curso não localizado.');return row}
async function legacyLessons(env){
 // Same publication rule as publishedContent: a published lesson with a ready video.
 const row=await env.QA_DB.prepare("select count(*) as n from lesson_records l join media_records m on m.id=json_extract(l.published,'$.mediaId') and m.kind='video' and m.state='ready' where l.published is not null").first()
 return row?.n||0
}
export async function enrollmentFor(env,userId,id){
 const table=id===LEGACY?'enrollments':'course_enrollments'
 return env.QA_DB.prepare(`select * from ${table} where user_id=? and course_id=?`).bind(userId,id).first()
}
// Server-side gate for every non-legacy course request (lessons, media, progress).
export async function requireCourseAccess(env,session,id,now){
 const row=await course(env,id)
 if(row.state!=='published'&&!session.isAdmin)fail(404,'COURSE_NOT_FOUND','Curso não localizado.')
 if(!session.roles.includes('student'))fail(403,'ENROLLMENT_REQUIRED','Esta conta não tem matrícula neste curso.')
 const enrollment=id===LEGACY?session.enrollment:await enrollmentFor(env,session.user.id,id)
 if(enrollmentStatus(enrollment,session.user.status,now)!=='active')fail(403,'ENROLLMENT_REQUIRED','Sua matrícula neste curso não está ativa. Confira a validade em Meus cursos.')
 return{course:row,enrollment}
}
const coverUrl=c=>c.cover_media_id?`/api/courses/${c.id}/cover`:c.id===LEGACY?'/assets/brand/rv30-training-hero.webp':null
export async function studentCourses(env,session,now){
 const db=env.QA_DB,user=session.user
 const rows=await db.prepare("select c.*,e.starts_at,e.expires_at,e.revoked,e.source from courses c join course_enrollments e on e.course_id=c.id and e.user_id=? where c.legacy=0 and c.state='published' order by c.position,c.title").bind(user.id).all()
 const output=[]
 if(session.enrollment){
  const rv=await db.prepare('select * from courses where id=?').bind(LEGACY).first(),[done,total]=await Promise.all([db.prepare('select count(*) as n from qa_progress where user_id=?').bind(user.id).first(),legacyLessons(env)])
  output.push(summary(rv||{id:LEGACY,title:'RV Treino 30 Dias',description:''},session.enrollment,user.status,now,done.n,30,total,'/curso/rv30'))
 }
 for(const row of rows.results){
  const [done,total]=await Promise.all([db.prepare('select count(*) as n from course_progress p join course_lessons l on l.id=p.lesson_id and l.published=1 where p.user_id=? and p.course_id=?').bind(user.id,row.id).first(),db.prepare('select count(*) as n from course_lessons where course_id=? and published=1').bind(row.id).first()])
  output.push(summary(row,row,user.status,now,done.n,total.n,total.n,'/curso/'+row.id))
 }
 return{ok:true,courses:output,generatedAt:new Date(now).toISOString()}
}
function summary(c,e,userStatus,now,completed,planned,available,href){
 const status=enrollmentStatus(e,userStatus,now)
 return{id:c.id,title:c.title,description:c.description,coverUrl:coverUrl(c),status,startsAt:e?new Date(e.starts_at).toISOString():null,expiresAt:e?new Date(e.expires_at).toISOString():null,totalLessons:planned,availableLessons:available,completedLessons:completed,percent:planned?Math.round(Math.min(completed,planned)/planned*100):0,href:status==='active'?href:null}
}
export async function studentCourse(env,session,id,now){
 const {course:row,enrollment}=await requireCourseAccess(env,session,id,now)
 const [lessons,progress]=await Promise.all([env.QA_DB.prepare('select id,position,title,description,media_id,cover_id from course_lessons where course_id=? and published=1 order by position').bind(id).all(),env.QA_DB.prepare('select lesson_id,completed_at from course_progress where user_id=? and course_id=?').bind(session.user.id,id).all()])
 const done=new Set(progress.results.map(x=>x.lesson_id))
 return{ok:true,course:{id:row.id,title:row.title,description:row.description,coverUrl:coverUrl(row)},enrollment:{status:'active',expiresAt:new Date(enrollment.expires_at).toISOString()},lessons:lessons.results.map(x=>({id:x.id,position:x.position,title:x.title,description:x.description,hasVideo:!!x.media_id,coverUrl:x.cover_id?`/api/courses/${id}/lessons/${x.id}/cover`:null,completed:done.has(x.id)})),completed:[...done]}
}
async function publishedLesson(env,id,lessonId){
 if(typeof lessonId!=='string'||lessonId.length>100)fail(404,'LESSON_NOT_FOUND','Aula não localizada.')
 const row=await env.QA_DB.prepare('select * from course_lessons where id=? and course_id=? and published=1').bind(lessonId,id).first()
 if(!row)fail(404,'LESSON_NOT_FOUND','Aula não localizada.');return row
}
export async function lessonMedia(request,env,session,id,lessonId,now){
 // Authorization is checked on every request, including each Range request.
 await requireCourseAccess(env,session,id,now);const lesson=await publishedLesson(env,id,lessonId)
 const media=await env.QA_DB.prepare("select object_key,bytes from media_records where id=? and kind='video' and state='ready'").bind(lesson.media_id||'').first()
 if(!media)fail(404,'VIDEO_PENDING','O vídeo desta aula ainda está pendente.')
 return streamVideo(request,env.VIDEOS,{key:media.object_key,bytes:media.bytes})
}
export async function lessonCover(request,env,session,id,lessonId,now){await requireCourseAccess(env,session,id,now);const lesson=await publishedLesson(env,id,lessonId);if(!lesson.cover_id)fail(404,'IMAGE_NOT_FOUND','Capa não localizada.');return privateImage(request,env,lesson.cover_id)}
export async function courseCover(request,env,session,id){
 const row=await course(env,id),enrolled=session.isAdmin||(id===LEGACY?session.enrollment:await enrollmentFor(env,session.user.id,id))
 if(!row.cover_media_id||!enrolled||(row.state!=='published'&&!session.isAdmin))fail(404,'IMAGE_NOT_FOUND','Capa não localizada.')
 return privateImage(request,env,row.cover_media_id)
}
export async function lessonProgress(env,session,id,lessonId,input,now){
 await requireCourseAccess(env,session,id,now);await publishedLesson(env,id,lessonId)
 if(typeof input.complete!=='boolean')fail(400,'PROGRESS_INVALID','Informe se a aula foi concluída.')
 const db=env.QA_DB
 await(input.complete?db.prepare('insert into course_progress(user_id,lesson_id,course_id,completed_at) values(?,?,?,?) on conflict(user_id,lesson_id) do nothing').bind(session.user.id,lessonId,id,now):db.prepare('delete from course_progress where user_id=? and lesson_id=?').bind(session.user.id,lessonId)).run()
 return{ok:true,lessonId,complete:input.complete}
}
// ---- Administration -------------------------------------------------------
export async function adminCourses(env){
 const rows=await env.QA_DB.prepare("select c.*,(select count(*) from course_lessons l where l.course_id=c.id) as lessons,(select count(*) from course_lessons l where l.course_id=c.id and l.published=1) as published_lessons,case when c.id='rv30' then (select count(*) from enrollments e where e.course_id='rv30') else (select count(*) from course_enrollments e where e.course_id=c.id) end as enrollments from courses c order by c.position,c.title").all()
 const legacy=await legacyLessons(env)
 return{ok:true,courses:rows.results.map(x=>x.id===LEGACY?{...x,lessons:30,published_lessons:legacy}:x)}
}
const slug=value=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)
export async function createCourse(env,session,input,now){
 await adminWrite(env,session,now)
 const title=text(input.title,'o nome do curso',160,true),description=text(input.description??'','a descrição',4000),id=typeof input.id==='string'&&input.id?input.id:slug(title)
 if(!/^[a-z0-9-]{2,40}$/.test(id))fail(400,'COURSE_ID_INVALID','Use de 2 a 40 letras minúsculas, números ou hífens no identificador.')
 const db=env.QA_DB;if(await db.prepare('select id from courses where id=?').bind(id).first())fail(409,'COURSE_EXISTS','Já existe um curso com esse identificador.')
 await db.batch([db.prepare("insert into courses(id,title,description,state,legacy,position,created_at,updated_at) values(?,?,?,'draft',0,100,?,?)").bind(id,title,description,now,now),audit(db,session,'course',id,'course_created',{},now)])
 return{ok:true,id}
}
async function readyMedia(env,id,kind){if(id===null||id===undefined||id==='')return null;if(typeof id!=='string'||id.length>100)fail(400,'MEDIA_INVALID','Selecione uma mídia da biblioteca.');const row=await env.QA_DB.prepare('select id from media_records where id=? and kind=? and state=?').bind(id,kind,'ready').first();if(!row)fail(400,'MEDIA_NOT_READY','Use somente mídia validada da biblioteca.');return id}
export async function editCourse(env,session,id,input,now){
 await adminWrite(env,session,now);const row=await course(env,id),db=env.QA_DB
 const title=input.title===undefined?row.title:text(input.title,'o nome do curso',160,true),description=input.description===undefined?row.description:text(input.description,'a descrição',4000)
 const cover=input.coverId===undefined?row.cover_media_id:await readyMedia(env,input.coverId,'image')
 const state=input.state===undefined?row.state:input.state
 if(!['draft','published','unpublished','archived'].includes(state))fail(400,'STATE_INVALID','Escolha um estado válido.')
 if(row.legacy&&state!=='published')fail(409,'LEGACY_COURSE_PROTECTED','O RV 30 permanece publicado para preservar o acesso dos alunos.')
 if(state==='published'&&!row.legacy&&!(await db.prepare('select count(*) as n from course_lessons where course_id=? and published=1').bind(id).first()).n)fail(400,'LESSONS_REQUIRED','Publique ao menos uma aula antes de publicar o curso.')
 const position=input.position===undefined?row.position:Number(input.position);if(!Number.isInteger(position)||position<1||position>1000)fail(400,'POSITION_INVALID','Informe uma posição entre 1 e 1000.')
 if(!Number.isInteger(input.revision)||input.revision!==row.revision)fail(409,'COURSE_CONFLICT','Outra alteração foi salva. Recarregue antes de editar.')
 const result=await db.batch([db.prepare('update courses set title=?,description=?,cover_media_id=?,state=?,position=?,revision=revision+1,updated_at=? where id=? and revision=?').bind(title,description,cover,state,position,now,id,row.revision),audit(db,session,'course',id,'course_'+(state!==row.state?state:'updated'),{fields:Object.keys(input).filter(x=>x!=='revision')},now)])
 if(result[0].meta.changes!==1)fail(409,'COURSE_CONFLICT','Outra alteração foi salva. Recarregue antes de editar.')
 return{ok:true,revision:row.revision+1}
}
export async function adminLessons(env,id){
 const row=await course(env,id);if(row.legacy)fail(409,'LEGACY_COURSE','As aulas do RV 30 são editadas em "Curso e aulas".')
 const lessons=await env.QA_DB.prepare('select * from course_lessons where course_id=? order by position').bind(id).all()
 return{ok:true,course:row,lessons:lessons.results}
}
export async function saveLesson(env,session,id,lessonId,input,now){
 await adminWrite(env,session,now);const row=await course(env,id),db=env.QA_DB
 if(row.legacy)fail(409,'LEGACY_COURSE','As aulas do RV 30 são editadas em "Curso e aulas".')
 const current=lessonId?await db.prepare('select * from course_lessons where id=? and course_id=?').bind(lessonId,id).first():null
 if(lessonId&&!current)fail(404,'LESSON_NOT_FOUND','Aula não localizada.')
 const title=text(input.title??current?.title,'o título da aula',160,true),description=text(input.description??current?.description??'','a descrição',4000)
 const position=Number(input.position??current?.position);if(!Number.isInteger(position)||position<1||position>500)fail(400,'POSITION_INVALID','Informe uma posição entre 1 e 500.')
 const media=input.mediaId===undefined?current?.media_id??null:await readyMedia(env,input.mediaId,'video'),cover=input.coverId===undefined?current?.cover_id??null:await readyMedia(env,input.coverId,'image')
 const published=input.published===undefined?current?.published??0:input.published===true?1:0
 if(published&&!media)fail(400,'VIDEO_REQUIRED','Associe um vídeo validado antes de publicar a aula.')
 const clash=await db.prepare('select id from course_lessons where course_id=? and position=? and id!=?').bind(id,position,lessonId||'').first();if(clash)fail(409,'POSITION_TAKEN','Outra aula já usa essa posição.')
 const target=lessonId||crypto.randomUUID()
 await db.batch([current?db.prepare('update course_lessons set title=?,description=?,position=?,media_id=?,cover_id=?,published=?,updated_at=? where id=?').bind(title,description,position,media,cover,published,now,target):db.prepare('insert into course_lessons(id,course_id,position,title,description,media_id,cover_id,published,updated_at) values(?,?,?,?,?,?,?,?,?)').bind(target,id,position,title,description,media,cover,published,now),audit(db,session,'lesson',id+'/'+target,current?'lesson_updated':'lesson_created',{published:!!published},now)])
 return{ok:true,id:target}
}
// Grants/renews/revokes one course for one student. Never touches the password,
// credential_version or sessions: enrollment changes cannot lock anyone out of login.
export async function changeEnrollment(env,session,userId,id,input,now){
 await adminWrite(env,session,now);const user=await findUser(env,userId),row=await course(env,id),db=env.QA_DB
 if(row.state==='archived')fail(409,'COURSE_ARCHIVED','Este curso está arquivado.')
 const table=id===LEGACY?'enrollments':'course_enrollments',current=await enrollmentFor(env,user.id,id)
 if(current?.source==='payment'&&input.action!=='revoke')fail(403,'PAYMENT_ENROLLMENT_IMMUTABLE','A matrícula de uma compra segue a confirmação do provedor de pagamento.')
 const statements=[];let action
 if(input.action==='grant'||input.action==='renew'){
  const length=days(input.days)*DAY,start=current&&!current.revoked&&current.expires_at>now?current.starts_at:now,base=input.action==='renew'&&current&&current.expires_at>now&&!current.revoked?current.expires_at:now
  action=input.action==='grant'?'enrollment_granted':'enrollment_renewed'
  if(id===LEGACY)statements.push(db.prepare("insert into enrollments(user_id,course_id,source,starts_at,expires_at,revoked,updated_at) values(?,'rv30',?,?,?,0,?) on conflict(user_id,course_id) do update set revoked=0,starts_at=excluded.starts_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(user.id,sourceFor(env),start,base+length,now))
  else statements.push(db.prepare('insert into course_enrollments(user_id,course_id,source,starts_at,expires_at,revoked,granted_by,updated_at) values(?,?,?,?,?,0,?,?) on conflict(user_id,course_id) do update set revoked=0,starts_at=excluded.starts_at,expires_at=excluded.expires_at,granted_by=excluded.granted_by,updated_at=excluded.updated_at').bind(user.id,id,'administrative',start,base+length,session.user.id,now))
  statements.push(db.prepare("insert into user_roles(user_id,role,assigned_at,assigned_by) values(?,'student',?,?) on conflict(user_id,role) do nothing").bind(user.id,now,session.user.id))
 }else if(input.action==='revoke'){
  if(!current)fail(400,'ENROLLMENT_REQUIRED','Este aluno não tem matrícula neste curso.')
  action='enrollment_revoked';statements.push(db.prepare(`update ${table} set revoked=1,updated_at=? where user_id=? and course_id=?`).bind(now,user.id,id))
 }else fail(400,'ACTION_INVALID','Escolha liberar, renovar ou revogar.')
 statements.push(identityEvent(db,user.id,session.user.id,action,now),audit(db,session,'enrollment',user.id,action,{courseId:id,days:input.days??null},now))
 await db.batch(statements)
 return{ok:true}
}
export async function studentEnrollments(env,userId,now){
 const db=env.QA_DB,[legacy,others,rv]=await Promise.all([db.prepare("select * from enrollments where user_id=? and course_id='rv30'").bind(userId).first(),db.prepare('select e.*,c.title,(select count(*) from course_progress p where p.user_id=e.user_id and p.course_id=e.course_id) as completed,(select count(*) from course_lessons l where l.course_id=e.course_id and l.published=1) as total from course_enrollments e join courses c on c.id=e.course_id where e.user_id=? order by c.position').bind(userId).all(),db.prepare("select title from courses where id='rv30'").first()])
 const user=await db.prepare('select status from qa_users where id=?').bind(userId).first(),list=[]
 if(legacy){const done=await db.prepare('select count(*) as n from qa_progress where user_id=?').bind(userId).first();list.push({...legacy,title:rv?.title||'RV Treino 30 Dias',completed:done.n,total:30})}
 list.push(...others.results)
 return list.map(x=>({courseId:x.course_id,title:x.title,source:x.source,startsAt:x.starts_at,expiresAt:x.expires_at,revoked:x.revoked,status:enrollmentStatus(x,user?.status,now),completed:x.completed,total:x.total,percent:x.total?Math.round(Math.min(x.completed,x.total)/x.total*100):0}))
}
