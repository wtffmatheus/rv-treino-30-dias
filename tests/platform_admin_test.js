'use strict'
const fs=require('node:fs'),assert=require('node:assert/strict'),{Miniflare,convertV4MiniflareOptions}=require('miniflare')
const box=(type,...parts)=>{const data=Buffer.concat(parts),head=Buffer.alloc(8);head.writeUInt32BE(data.length+8);head.write(type,4);return Buffer.concat([head,data])}
function mp4(){
 const track=(handler,codec)=>{const hdlr=Buffer.alloc(12);hdlr.write(handler,8);const mdhd=Buffer.alloc(20);mdhd.writeUInt32BE(1000,12);mdhd.writeUInt32BE(10000,16);const tkhd=Buffer.alloc(84);tkhd.writeUInt32BE(720*65536,76);tkhd.writeUInt32BE(1280*65536,80);const stsd=Buffer.alloc(8);stsd.writeUInt32BE(1,4);return box('trak',box('tkhd',tkhd),box('mdia',box('hdlr',hdlr),box('mdhd',mdhd),box('minf',box('stbl',box('stsd',stsd,box(codec,Buffer.alloc(8)))))))}
 return Buffer.concat([box('ftyp',Buffer.from('isom0000isomavc1')),box('moov',track('vide','avc1'),track('soun','mp4a')),box('mdat',Buffer.alloc(40))])
}
;(async()=>{
 const{createPlatformHandler}=await import('../backend/platform/worker.mjs'),{hashPassword}=await import('../backend/qa/core.mjs'),{inspectMP4,inspectImage,PART_BYTES}=await import('../backend/platform/media.mjs')
 const mf=new Miniflare(convertV4MiniflareOptions({name:'admin-fixture',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-26',d1Databases:['QA_DB'],r2Buckets:['VIDEOS']}))
 try{
  const db=await mf.getD1Database('QA_DB'),bucket=await mf.getR2Bucket('VIDEOS'),now=Date.now(),origin='https://platform.example.test',password='StrongAdminFixture123',pepper='private-test-pepper'.repeat(4),hash=await hashPassword(password,pepper)
  for(const file of ['backend/qa/schema.sql','backend/platform/student-schema.sql','backend/platform/identity-schema.sql','backend/platform/admin-schema.sql'])for(const sql of fs.readFileSync(file,'utf8').replace(/--[^\n]*/g,'').split(';').filter(x=>x.trim()))await db.prepare(sql).run()
  for(const id of ['admin','student-a','student-b']){
   await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind(id,id+'@example.test',id,hash.salt,hash.hash,now).run();await db.prepare("insert into identity_metadata(user_id,kind,verified_at,verification_method) values(?,'validation',?,'owner_provisioned')").bind(id,now).run();await db.prepare('insert into user_roles(user_id,role,assigned_at) values(?,?,?)').bind(id,id==='admin'?'admin':'student',now).run()
   if(id!=='admin')await db.prepare("insert into enrollments(user_id,course_id,source,starts_at,expires_at,updated_at) values(?,'rv30','owner_validation',?,?,?)").bind(id,now,now+365*86400000,now).run()
  }
  const course={title:'RV 30',description:'Curso em validação',priceCents:39900,currency:'BRL',accessDurationDays:365}
  await db.prepare("insert into course_records(id,draft,published,updated_at) values('rv30',?,?,?)").bind(JSON.stringify(course),JSON.stringify(course),now).run()
  const bytes=mp4(),key='rv30/uploads/fixture.mp4';await bucket.put(key,bytes)
  await db.prepare("insert into media_records(id,object_key,kind,label,state,bytes,duration,width,height,format,created_at) values('video',?,'video','Vídeo de fixture','ready',?,10,720,1280,'video/mp4',?)").bind(key,bytes.length,now).run()
  for(let day=1;day<=30;day++){const doc={title:'Dia '+day,description:'',objective:'',instructions:'',materials:[],warnings:[],durationLabel:'',order:day,mediaId:day===1?'video':null,coverId:null,editorialReviewed:false};await db.prepare('insert into lesson_records(day,draft,published,updated_at) values(?,?,?,?)').bind(day,JSON.stringify(doc),day===1?JSON.stringify(doc):null,now).run()}
  const env={QA_DB:db,VIDEOS:bucket,AUTH_PASSWORD_PEPPER:pepper,PLATFORM_ENV:'staging',PLATFORM_ADMIN_ENABLED:'true',PREVIEW_ORIGINS:origin},app=createPlatformHandler({now:()=>now})
  const call=async(path,{cookie='',method='GET',body,binary,headers={}}={})=>{
   const response=await app.fetch(new Request(origin+'/api'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(binary?{'Content-Type':'application/octet-stream'}:{'Content-Type':'application/json'}),...headers},...(body===undefined&&binary===undefined?{}:{body:binary||JSON.stringify(body)})}),env)
   return{status:response.status,headers:response.headers,body:response.headers.get('content-type')?.includes('json')?await response.json():await response.text()}
  }
  const signin=async id=>{const result=await call('/auth/login',{method:'POST',body:{email:id+'@example.test',password}});assert.equal(result.status,200);return result.headers.get('set-cookie').split(';')[0]}
  const admin=await signin('admin'),student=await signin('student-a'),other=await signin('student-b'),a=(path,options={})=>call('/admin'+path,{cookie:admin,...options})
  assert.equal((await call('/config')).body.platformAdmin,true)
  for(const path of ['/admin/metrics','/admin/students','/admin/content','/admin/media','/admin/audit','/admin/orders','/admin/report','/admin/uploads']){assert.equal((await call(path)).status,401);assert.equal((await call(path,{cookie:student})).status,403)}
  assert.equal((await a('/students',{method:'POST',body:null})).status,400)
  const created=await a('/students',{method:'POST',body:{name:'Aluno novo',email:'new@example.test',phone:'11999999999',role:'admin',isAdmin:true}});assert.equal(created.status,201);const id=created.body.id
  assert.equal((await db.prepare('select verified_at from identity_metadata where user_id=?').bind(id).first()).verified_at,null)
  assert.deepEqual((await db.prepare('select role from user_roles where user_id=?').bind(id).all()).results.map(x=>x.role),['student'])
  assert.equal((await db.prepare('select count(*) as n from enrollments where user_id=?').bind(id).first()).n,0)
  assert.equal((await a('/students',{method:'POST',body:{name:'Duplicado',email:'new@example.test'}})).status,409)
  const invitation=await a('/identity-tokens',{method:'POST',body:{userId:id,purpose:'invitation'}});assert.equal(invitation.status,200)
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:invitation.body.token,password:'StrongNewStudent123'}})).status,200)
  assert.equal((await a('/students/'+id,{method:'PATCH',body:{access:'grant'}})).status,200)
  let detail=(await a('/students/'+id)).body;assert.equal(detail.enrollments[0].expires_at-detail.enrollments[0].starts_at,365*86400000)
  assert.equal((await a('/students/'+id,{method:'PATCH',body:{action:'profile',name:'=HYPERLINK("bad")',phone:'11987654321'}})).status,200)
  assert.equal((await a('/students/'+id,{method:'PATCH',body:{action:'note',body:'Nota privada <script>inert</script>'}})).status,200)
  assert.equal((await a('/students/'+id,{method:'PATCH',body:{action:'validity',startsAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString()}})).status,200)
  detail=(await a('/students/'+id)).body;assert.equal(detail.profile.phone,'11987654321');assert.equal(detail.notes.length,1);assert.equal(detail.enrollments[0].expires_at,now+86400000)
  await db.prepare("update enrollments set source='payment' where user_id=?").bind(id).run()
  assert.equal((await a('/students/'+id,{method:'PATCH',body:{access:'grant'}})).status,403)
  assert.equal((await a('/students/'+id,{method:'PATCH',body:{action:'validity',startsAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString()}})).status,403)
  await db.prepare("update enrollments set source='owner_validation' where user_id=?").bind(id).run()
  const report=await a('/report');assert.equal(report.status,200);assert(report.body.includes("' =HYPERLINK".replace("' ","'")));assert(!report.body.includes(password))
  assert.equal((await a('/students?q='+encodeURIComponent("' or 1=1 --"))).body.total,0)
  assert.equal((await call('/admin/students/'+id,{cookie:student,method:'PATCH',body:{action:'role',admin:true}})).status,403)
  assert.equal((await a('/students/admin',{method:'PATCH',body:{action:'role',admin:false}})).status,400)
  const thread=await call('/support',{cookie:student,method:'POST',body:{subject:'Dúvida dia 1',body:'Mensagem privada com acentuação.',day:1}});assert.equal(thread.status,201);const threadId=thread.body.id
  assert.equal((await call('/support/'+threadId,{cookie:other})).status,404);assert.equal((await call('/support/'+threadId,{cookie:other,method:'POST',body:{body:'Intrusão'}})).status,404)
  assert.equal((await call('/support',{cookie:other})).body.threads.length,0)
  assert.equal((await a('/support/'+threadId,{method:'POST',body:{body:'Resposta da equipe'}})).status,200)
  assert.equal((await call('/support/'+threadId,{cookie:student})).body.messages.length,2)
  assert.equal((await a('/support/'+threadId,{method:'POST',body:{action:'status',status:'resolved'}})).status,200)
  assert.equal((await call('/support/'+threadId,{cookie:student,method:'POST',body:{action:'status',status:'resolved'}})).status,403)
  const content=(await a('/content')).body,doc={...content.lessons[0].draft,objective:'Objetivo revisado',instructions:'Instruções revisadas.',materials:['Material conferido'],warnings:['Aviso revisado'],editorialReviewed:true}
  await db.prepare("insert into qa_progress(user_id,day,completed_at) values('student-a',1,?)").bind(now).run()
  let saved=await a('/content/lesson/1',{method:'PUT',body:{action:'save',revision:1,document:doc}});assert.equal(saved.status,200)
  assert.equal((await a('/content/lesson/1',{method:'PUT',body:{action:'save',revision:1,document:doc}})).status,409)
  assert.equal((await a('/content/lesson/1',{method:'PUT',body:{action:'publish',revision:2}})).status,200)
  assert.equal((await call('/courses/rv30',{cookie:student})).body.lessons[0].objective,'Objetivo revisado')
  assert.equal((await a('/content/lesson/1',{method:'PUT',body:{action:'unpublish',revision:3}})).status,200)
  assert.equal((await call('/courses/rv30/days/1/media',{cookie:student})).status,404)
  assert.equal((await db.prepare("select count(*) as n from qa_progress where user_id='student-a'").first()).n,1)
  const history=(await a('/content/lesson/1/versions')).body.versions;assert.equal(history.length,3)
  assert.equal((await a('/content/lesson/1',{method:'PUT',body:{action:'restore',revision:4,versionId:history.find(x=>x.action==='publish').id}})).status,200)
  assert.equal((await a('/content/lesson/1',{method:'PUT',body:{action:'publish',revision:5}})).status,200)
  assert.equal((await call('/courses/rv30/days/1/media',{cookie:student,headers:{Range:'bytes=0-1'}})).status,206)
  assert.equal((await a('/content/lesson/30',{method:'PUT',body:{action:'publish',revision:1}})).status,400)
  const concurrent=await Promise.all([1,2].map(x=>a('/content/lesson/1',{method:'PUT',body:{action:'save',revision:6,document:{...doc,title:'Edição '+x}}})));assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409])
  assert.equal((await a('/content/course/rv30',{method:'PUT',body:{action:'save',revision:1,document:{...course,accessDurationDays:1000}}})).status,400)
  const technical=inspectMP4(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),bytes.length);assert.equal(technical.duration,10)
  assert.throws(()=>inspectMP4(new Uint8Array(40).buffer,40));assert.throws(()=>inspectImage(new Uint8Array(24).buffer))
  const upload=await a('/uploads',{method:'POST',body:{label:'Envio de fixture',kind:'video',bytes:bytes.length}});assert.equal(upload.status,201);const uploadId=upload.body.id
  assert.equal((await call('/admin/uploads/'+uploadId+'/parts/1',{cookie:student,method:'PUT',binary:bytes})).status,403)
  assert.equal((await a('/uploads/'+uploadId+'/finish',{method:'POST',body:{}})).status,409)
  assert.equal((await a('/uploads/'+uploadId+'/parts/1',{method:'PUT',binary:bytes})).status,200)
  assert.equal((await a('/uploads/'+uploadId+'/finish',{method:'POST',body:{}})).status,200)
  assert.equal((await a('/uploads/'+uploadId+'/finish',{method:'POST',body:{}})).status,200)
  const uploaded=(await a('/media')).body.media.find(x=>x.id===uploadId);assert.equal(uploaded.state,'review');assert(!('object_key'in uploaded))
  assert.equal((await a('/media/'+uploadId+'/preview',{headers:{Range:'bytes=0-1'}})).status,206)
  assert.equal((await a('/media/'+uploadId,{method:'PATCH',body:{state:'ready',reviewed:false}})).status,400)
  assert.equal((await a('/media/'+uploadId,{method:'PATCH',body:{state:'ready',reviewed:true}})).status,200)
  const unsafe=await a('/uploads',{method:'POST',body:{label:'HTML disfarçado',kind:'video',bytes:20}});assert.equal(unsafe.status,201)
  assert.equal((await a('/uploads/'+unsafe.body.id+'/parts/1',{method:'PUT',binary:Buffer.alloc(20,60)})).status,200)
  assert.equal((await a('/uploads/'+unsafe.body.id+'/finish',{method:'POST',body:{}})).status,400)
  assert.equal((await db.prepare('select count(*) as n from media_records where id=?').bind(unsafe.body.id).first()).n,0)
  const stats=(await a('/metrics?days=30')).body;assert.equal(stats.totals.students,3);assert.equal(stats.totals.lessonsCompleted,1);assert.equal(stats.paymentsAvailable,false)
  assert.deepEqual((await a('/orders')).body.orders,[]);assert.equal((await a('/metrics?days=9999')).status,400)
  assert((await a('/audit')).body.events.length>10);assert(!JSON.stringify((await a('/audit')).body).includes(invitation.body.token))
  assert.equal(PART_BYTES,5*1024*1024)
  const{setOwnerValidationPassword}=await import('../backend/platform/owner-control.mjs'),ownerEnv={...env,QA_ADMIN_EMAIL:'admin@example.test',QA_EMAIL:'student-a@example.test'}
  await assert.rejects(()=>setOwnerValidationPassword(ownerEnv,'other@example.test','admin','StrongOwnerPassword123',now),error=>error.status===403)
  await assert.rejects(()=>setOwnerValidationPassword({...ownerEnv,PLATFORM_ENV:'production'},'admin@example.test','admin','StrongOwnerPassword123',now),error=>error.status===403)
  await assert.rejects(()=>setOwnerValidationPassword(ownerEnv,'admin@example.test','student','123456',now),error=>error.status===400)
  assert.equal((await setOwnerValidationPassword(ownerEnv,'admin@example.test','student','StrongOwnerPassword123',now)).ok,true)
  assert.equal((await call('/account',{cookie:student})).status,401)
  const ownerResetLogin=await call('/auth/login',{method:'POST',body:{email:'student-a@example.test',password:'StrongOwnerPassword123'}});assert.equal(ownerResetLogin.status,200);assert.equal(ownerResetLogin.body.isAdmin,false)
  console.log('Administração: D1/R2 locais, criação/convite, perfis, validade, notas, CSV, RBAC, suporte isolado, versões concorrentes, publicação sem apagar progresso, upload privado, validação e métricas reais passaram. Arquivo MP4 de teste valida estrutura; não comprova reprodução de conteúdo real.')
 }finally{await mf.dispose()}
})().catch(error=>{console.error(error);process.exitCode=1})
