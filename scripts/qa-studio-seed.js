'use strict'
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

/** Only called by the loopback Miniflare fixture. Media is generated in output/. */
async function seedStudio(db, bucket, hash) {
  const now = Date.now()
  for (const file of ['backend/platform/admin-schema.sql','backend/platform/catalog-schema.sql']) {
    const schema = fs.readFileSync(path.join(root,file),'utf8')
    for (const sql of schema.replace(/--[^\n]*/g,'').split(';').filter(sql=>sql.trim())) await db.prepare(sql).run()
  }
  await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)')
    .bind('studio-admin','equipe@example.test','Equipe de validação',hash.salt,hash.hash,now).run()
  await db.prepare("insert into identity_metadata(user_id,kind,verified_at,verification_method) values('studio-admin','validation',?,'owner_provisioned')").bind(now).run()
  await db.prepare("insert into user_roles(user_id,role,assigned_at) values('studio-admin','admin',?)").bind(now).run()
  const course = JSON.stringify({title:'RV 30',description:'Programa de treinos de 30 dias.',priceCents:49900,currency:'BRL',accessDurationDays:365})
  await db.prepare("insert into course_records(id,draft,published,updated_at) values('rv30',?,?,?)").bind(course,course,now).run()
  const bytes=fs.readFileSync(path.join(root,'output/codex-redesign-completo/qa/midia-validacao.mp4'))
  const key='rv30/uploads/fixture-validacao.mp4'
  await bucket.put(key,bytes)
  await db.prepare("insert into media_records(id,object_key,kind,label,state,bytes,duration,width,height,format,created_at) values('studio-video',?,'video','Mídia local de validação','ready',?,3,640,360,'video/mp4',?)").bind(key,bytes.length,now).run()
  for(let day=1;day<=30;day++){
    const available=[1,2,15,25,29].includes(day)
    const lesson=JSON.stringify({title:'Dia '+day,description:'Aula do programa RV 30.',objective:'Acompanhar as orientações da aula.',instructions:'Consulte o vídeo e registre sua conclusão.',materials:[],warnings:[],durationLabel:'',order:day,mediaId:available?'studio-video':null,coverId:null,editorialReviewed:available})
    await db.prepare('insert into lesson_records(day,draft,published,updated_at) values(?,?,?,?)').bind(day,lesson,available?lesson:null,now).run()
  }
  // Additional catalog entries so the multi-course screens show real states.
  await db.prepare("insert into courses(id,title,description,state,legacy,position,created_at,updated_at) values('mobilidade-essencial','Mobilidade Essencial','Sequências curtas para soltar quadril, coluna e ombros antes do treino.','published',0,2,?,?),('forca-em-casa','Força em Casa','Treinos de força com o peso do corpo, em planejamento.','draft',0,3,?,?)").bind(now,now,now,now).run()
  for (const [position,title] of [[1,'Quadril livre'],[2,'Coluna e respiração'],[3,'Ombros sem tensão']]) await db.prepare("insert into course_lessons(id,course_id,position,title,description,media_id,published,updated_at) values(?,'mobilidade-essencial',?,?,?,'studio-video',1,?)").bind('mob-'+position,position,title,'Aula '+position+' da trilha de mobilidade.',now).run()
}
/** Enrolls a fixture student in the additional course (after the scenarios exist). */
async function seedStudioEnrollments(db) {
  const now = Date.now()
  await db.prepare("insert or ignore into course_enrollments(user_id,course_id,source,starts_at,expires_at,revoked,updated_at) values('golden','mobilidade-essencial','administrative',?,?,0,?)").bind(now, now + 90 * 86400000, now).run()
  await db.prepare("insert or ignore into course_progress(user_id,lesson_id,course_id,completed_at) values('golden','mob-1','mobilidade-essencial',?)").bind(now).run()
}
module.exports={seedStudio,seedStudioEnrollments}

