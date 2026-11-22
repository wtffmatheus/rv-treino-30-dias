'use strict'
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

/** Only called by the loopback Miniflare fixture. Media is generated in output/. */
async function seedStudio(db, bucket, hash) {
  const now = Date.now()
  const schema = fs.readFileSync(path.join(root,'backend/platform/admin-schema.sql'),'utf8')
  for (const sql of schema.replace(/--[^\n]*/g,'').split(';').filter(sql=>sql.trim())) await db.prepare(sql).run()
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
}
module.exports={seedStudio}

