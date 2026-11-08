import {fail} from './auth.mjs'
import {text,adminWrite,revision} from './admin-common.mjs'
const parse=value=>value?JSON.parse(value):null
const list=(value,label)=>{if(!Array.isArray(value)||value.length>20)fail(400,'LIST_INVALID',`Confira ${label}.`);return value.map(x=>text(x,label,500,true))}
function lessonDocument(input){
 if(!Number.isInteger(input.order)||input.order<1||input.order>30)fail(400,'ORDER_INVALID','A ordem deve estar entre 1 e 30.')
 if(input.durationLabel!==undefined&&typeof input.durationLabel!=='string')fail(400,'DURATION_INVALID','Confira a duração informada.')
 for(const key of ['mediaId','coverId'])if(input[key]!==null&&(typeof input[key]!=='string'||input[key].length>100))fail(400,'MEDIA_INVALID','Selecione uma mídia da biblioteca.')
 return{title:text(input.title,'o título',160,true),description:text(input.description??'','a descrição',2000),objective:text(input.objective??'','o objetivo',2000),instructions:text(input.instructions??'','as orientações',6000),materials:list(input.materials??[],'os materiais'),warnings:list(input.warnings??[],'os avisos'),durationLabel:text(input.durationLabel??'','a duração informada',100),order:input.order,mediaId:input.mediaId,coverId:input.coverId,editorialReviewed:input.editorialReviewed===true}
}
function courseDocument(input){
 if(!Number.isInteger(input.priceCents)||input.priceCents<100||input.priceCents>100000000||input.accessDurationDays!==365)fail(400,'COMMERCIAL_INVALID','Informe um preço válido e preserve o acesso aprovado de 365 dias.')
 return{title:text(input.title,'o nome do curso',160,true),description:text(input.description??'','a descrição',6000),priceCents:input.priceCents,accessDurationDays:365,currency:'BRL'}
}
async function validateMedia(env,doc,publishing){
 for(const [key,kind]of [['mediaId','video'],['coverId','image']]){
  if(!doc[key]){if(publishing&&key==='mediaId')fail(400,'VIDEO_REQUIRED','Associe um vídeo validado antes de publicar.');continue}
  const media=await env.QA_DB.prepare('select kind,state,object_key,bytes from media_records where id=?').bind(doc[key]).first()
  if(!media||media.kind!==kind||media.state!=='ready')fail(400,'MEDIA_NOT_READY','Use somente mídia validada da biblioteca.')
  if(publishing){const object=await env.VIDEOS.head(media.object_key);if(!object||object.size!==media.bytes)fail(409,'MEDIA_MISSING','A mídia não foi encontrada com o tamanho esperado. Revise a biblioteca.')}
 }
}
export async function contentRead(env){
 const [course,lessons]=await Promise.all([env.QA_DB.prepare("select draft,published,revision,updated_at from course_records where id='rv30'").first(),env.QA_DB.prepare('select day,draft,published,revision,updated_at from lesson_records order by day').all()])
 if(!course||lessons.results.length!==30)fail(503,'CONTENT_PENDING','O catálogo persistente ainda não foi preparado.')
 return{ok:true,course:{...course,draft:parse(course.draft),published:parse(course.published)},lessons:lessons.results.map(row=>({...row,draft:parse(row.draft),published:parse(row.published)}))}
}
export async function versions(env,entity,id){
 if(!['course','lesson'].includes(entity))fail(404,'CONTENT_NOT_FOUND','Conteúdo não localizado.')
 const rows=await env.QA_DB.prepare('select v.id,v.revision,v.document,v.action,v.at,u.name as actor from content_versions v join qa_users u on u.id=v.actor_id where entity=? and entity_id=? order by revision desc limit 100').bind(entity,String(id)).all()
 return{ok:true,versions:rows.results.map(x=>({...x,document:parse(x.document)}))}
}
export async function changeContent(env,session,entity,id,input,now){
 await adminWrite(env,session,now);const expected=revision(input),db=env.QA_DB,isCourse=entity==='course',table=isCourse?'course_records':'lesson_records',column=isCourse?'id':'day'
 if((isCourse&&id!=='rv30')||(!isCourse&&(!Number.isInteger(id)||id<1||id>30)))fail(404,'CONTENT_NOT_FOUND','Conteúdo não localizado.')
 const row=await db.prepare(`select * from ${table} where ${column}=?`).bind(id).first();if(!row)fail(404,'CONTENT_NOT_FOUND','Conteúdo não localizado.')
 if(row.revision!==expected)fail(409,'CONTENT_CONFLICT','Outra alteração foi salva. Recarregue antes de editar novamente.')
 let draft=parse(row.draft),published=parse(row.published)
 if(input.action==='save')draft=isCourse?courseDocument(input.document):lessonDocument(input.document)
 else if(input.action==='restore'){
  const previous=await db.prepare('select document from content_versions where id=? and entity=? and entity_id=?').bind(String(input.versionId||''),entity,String(id)).first()
  if(!previous)fail(404,'VERSION_NOT_FOUND','Versão não localizada.');draft=parse(previous.document).draft
 }else if(input.action==='publish'){
  if(!isCourse){
   if(!draft.editorialReviewed||!draft.objective||!draft.instructions)fail(400,'EDITORIAL_PENDING','Preencha objetivo e orientações e confirme a revisão editorial.')
   await validateMedia(env,draft,true)
   const others=await db.prepare('select day,published from lesson_records where day!=? and published is not null').bind(id).all()
   if(others.results.some(x=>parse(x.published).order===draft.order))fail(409,'ORDER_CONFLICT','Outra aula publicada usa essa ordem. Despublique a outra aula antes de reorganizar.')
  }
  published=draft
 }else if(input.action==='unpublish'&&!isCourse)published=null
 else fail(400,'CONTENT_ACTION','Escolha salvar, publicar, despublicar ou restaurar.')
 if(!isCourse)await validateMedia(env,draft,false)
 const claim=crypto.randomUUID(),document=JSON.stringify({draft,published}),event=crypto.randomUUID()
 const result=await db.batch([
  db.prepare(`update ${table} set draft=?,published=?,revision=revision+1,last_change=?,updated_at=? where ${column}=? and revision=?`).bind(JSON.stringify(draft),published?JSON.stringify(published):null,claim,now,id,expected),
  db.prepare(`insert into content_versions(id,entity,entity_id,revision,document,actor_id,action,at) select ?,?,?,revision,?,?,?,? from ${table} where ${column}=? and last_change=?`).bind(claim,entity,String(id),document,session.user.id,input.action,now,id,claim),
  db.prepare('insert into audit_events(id,actor_id,subject_id,entity,action,detail,at) select ?,?,?,?,?,?,? where exists(select 1 from content_versions where id=?)').bind(event,session.user.id,String(id),entity,'content_'+input.action,JSON.stringify({revision:expected+1,previousMediaId:parse(row.published)?.mediaId??null,mediaId:published?.mediaId??null}),now,claim)
 ])
 if(result[0].meta.changes!==1)fail(409,'CONTENT_CONFLICT','Outra alteração foi salva. Recarregue antes de editar novamente.')
 return{ok:true,revision:expected+1}
}
export async function publishedContent(env){
 const db=env.QA_DB,course=await db.prepare("select published from course_records where id='rv30'").first(),lessons=await db.prepare('select day,published from lesson_records order by day').all(),media=await db.prepare("select id,object_key,bytes,duration from media_records where kind='video' and state='ready'").all()
 if(!course||lessons.results.length!==30)fail(503,'CONTENT_PENDING','O catálogo ainda está em preparação.')
 const documents=lessons.results.map(x=>({day:x.day,...(parse(x.published)||{}),published:!!x.published})),items=[]
 for(const lesson of documents){const file=media.results.find(x=>x.id===lesson.mediaId);if(lesson.published&&file)items.push({day:lesson.day,key:file.object_key,bytes:file.bytes,duration:file.duration})}
 return{course:parse(course.published),lessons:documents,items}
}
