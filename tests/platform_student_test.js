'use strict'
const fs=require('node:fs'),assert=require('node:assert/strict')
const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
;(async()=>{
 const {createPlatformHandler}=await import('../backend/platform/worker.mjs')
 const {hashPassword}=await import('../backend/qa/core.mjs')
 const {recordActivity}=await import('../backend/platform/student.mjs')
 const mf=new Miniflare(convertV4MiniflareOptions({name:'student-fixture',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-26',d1Databases:['QA_DB'],r2Buckets:['VIDEOS']}))
 try{
  const db=await mf.getD1Database('QA_DB'),bucket=await mf.getR2Bucket('VIDEOS'),email='student@example.test',pepper='fixture-pepper-'.repeat(4),password='fixture-student-password'
  for(const file of ['backend/qa/schema.sql','backend/platform/student-schema.sql'])for(const sql of fs.readFileSync(file,'utf8').split(';').filter(x=>x.trim()))await db.prepare(sql).run()
  let now=Date.now();const initial=now,hash=await hashPassword(password,pepper)
  for(const [id,address]of[['student',email],['other','other@example.test']]){
   await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind(id,address,'Aluno',hash.salt,hash.hash,now).run()
   await db.prepare("insert into qa_grants(user_id,source,expires_at) values(?,'owner_validation',?)").bind(id,now+365*86400000).run()
   await db.prepare("insert into enrollment_details(user_id,starts_at,source) values(?,?,'owner_validation')").bind(id,now).run()
  }
  const item={day:1,key:'rv30/dia-01/'+'a'.repeat(64)+'.mp4',bytes:10,duration:120};await bucket.put(item.key,'0123456789')
  const env={QA_DB:db,VIDEOS:bucket,QA_EMAIL:email,QA_PASSWORD_PEPPER:pepper,QA_PREVIEW:'true',PUBLIC_SITE_URL:'https://site.example.test',PREVIEW_ORIGINS:'https://site.example.test',QA_MEDIA_MANIFEST:JSON.stringify([item])}
  const app=createPlatformHandler({now:()=>now});let cookie=''
  const call=(path,method='GET',data,headers={})=>app.fetch(new Request('https://worker.example.test/api'+path,{method,headers:{Origin:env.PUBLIC_SITE_URL,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),env)
  assert.equal((await call('/student/dashboard')).status,401)
  const login=await call('/auth/login','POST',{email,password});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0]
  const config=await(await call('/config')).json();assert(config.platformMode);assert.equal(config.salesEnabled,false)
  let dashboard=await(await call('/student/dashboard')).json();assert.equal(dashboard.enrollment.startsAt,new Date(initial).toISOString());assert.equal(dashboard.activity.validatedSeconds,0);assert.equal(dashboard.resume.day,1);assert.equal(dashboard.history.length,0)
  assert.equal((await call('/courses/rv30/activity/open','POST',{day:1},{Origin:'https://evil.example.test'})).status,403)
  assert.equal((await call('/courses/rv30/activity/open','POST',{day:30})).status,404)
  const opened=await(await call('/courses/rv30/activity/open','POST',{day:1,userId:'other'})).json();assert(opened.ok)
  let sequence=0
  const event=async(type,position,visible=true,playing=true,seconds=10)=>{now+=seconds*1000;const input={sessionId:opened.sessionId,sequence:++sequence,event:type,positionSeconds:position,visible,playing};const response=await call('/courses/rv30/activity/event','POST',input);assert.equal(response.status,200);return{...await response.json(),input}}
  assert.equal((await event('play',0,true,true,0)).creditedSeconds,0)
  const pulse=await event('heartbeat',10);assert.equal(pulse.creditedSeconds,10)
  const duplicate=await(await call('/courses/rv30/activity/event','POST',pulse.input)).json();assert(duplicate.duplicate);assert.equal(duplicate.creditedSeconds,0)
  assert.equal((await event('visibility',20,false,true)).creditedSeconds,10)
  assert.equal((await event('heartbeat',30,false,true)).creditedSeconds,0,'background não conta tempo')
  assert.equal((await event('visibility',40,true,true)).creditedSeconds,0)
  assert.equal((await event('pause',50,true,false)).creditedSeconds,10)
  assert.equal((await event('seek',90,true,false,1)).creditedSeconds,0)
  assert.equal((await event('play',90,true,true,0)).creditedSeconds,0)
  assert.equal((await event('heartbeat',100,true,true,60)).creditedSeconds,0,'intervalos longos não contam automaticamente')
  dashboard=await(await call('/student/dashboard')).json();assert.equal(dashboard.activity.validatedSeconds,30);assert.equal(dashboard.history.length,1);assert.equal(dashboard.resume.positionSeconds,100)
  const course=await(await call('/courses/rv30')).json();assert.equal(course.positions['1'],100)
  assert.equal((await db.prepare('select count(*) as n from lesson_visits where user_id=?').bind('other').first()).n,0)
  const next={sessionId:opened.sessionId,sequence:sequence+1,event:'heartbeat',positionSeconds:110,visible:true,playing:true};now+=10000
  const raced=await Promise.all([call('/courses/rv30/activity/event','POST',next),call('/courses/rv30/activity/event','POST',next)])
  assert(raced.every(result=>result.ok));assert.equal((await(await call('/student/dashboard')).json()).activity.validatedSeconds,40,'requisições concorrentes não duplicam crédito')
  sequence++
  await db.prepare("insert into activity_limits(user_id,scope,window,hits) values('student','event',?,120) on conflict(user_id,scope,window) do update set hits=120").bind(Math.floor(now/60000)).run()
  assert.equal((await call('/courses/rv30/activity/event','POST',{...next,sequence:sequence+1})).status,429)
  now+=60000
  await assert.rejects(()=>recordActivity(env,{hasAccess:true,user:{id:'other'}},[item],{sessionId:opened.sessionId,sequence:sequence+1,event:'heartbeat',positionSeconds:101,visible:true,playing:true},now),/sessão de aula terminou/)
  await db.prepare('update qa_grants set revoked=1 where user_id=?').bind('student').run()
  assert.equal((await call('/courses/rv30/activity/event','POST',{sessionId:opened.sessionId,sequence:sequence+1,event:'heartbeat',positionSeconds:101,visible:true,playing:true})).status,403)
  assert.equal((await(await call('/student/dashboard')).json()).enrollment.status,'revoked')
  console.log('Aluno: D1 real local, datas, histórico, retomada, crédito limitado, duplicação, background, pausas, seek, intervalos longos, origem, IDOR e revogação aprovados.')
 }finally{await mf.dispose()}
})().catch(error=>{console.error(error);process.exitCode=1})
