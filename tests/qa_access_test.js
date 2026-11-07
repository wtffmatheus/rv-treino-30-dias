'use strict'
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
;(async()=>{
 const {createQaHandler,hashPassword,setTestPassword}=await import('../backend/qa/core.mjs')
 const mf=new Miniflare(convertV4MiniflareOptions({name:'qa-fixture',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-26',d1Databases:['QA_DB'],r2Buckets:['VIDEOS']}))
 try{
  const db=await mf.getD1Database('QA_DB'),bucket=await mf.getR2Bucket('VIDEOS')
  for(const statement of fs.readFileSync(path.join(__dirname,'../backend/qa/schema.sql'),'utf8').split(';').filter(x=>x.trim()))await db.prepare(statement).run()
  const email='student@example.test',password='fixture-password-1234',pepper='p'.repeat(64),credentials=await hashPassword(password,pepper),now=Date.now()
  await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind('fixture-user',email,'Aluno',credentials.salt,credentials.hash,now).run()
  await db.prepare('insert into qa_grants(user_id,source,expires_at) values(?,?,?)').bind('fixture-user','owner_validation',now+86400000).run()
  const key='rv30/dia-01/'+'a'.repeat(64)+'.mp4';await bucket.put(key,'0123456789')
  const env={QA_DB:db,VIDEOS:bucket,QA_EMAIL:email,QA_PASSWORD_PEPPER:pepper,PUBLIC_SITE_URL:'https://site.example.test',QA_MEDIA_MANIFEST:JSON.stringify([{day:1,key,bytes:10,duration:12}])}
  const app=createQaHandler();let cookie=''
  const call=(route,method='GET',body,extra={})=>app.fetch(new Request('https://worker.example.test/api'+route,{method,headers:{origin:env.PUBLIC_SITE_URL,'Content-Type':'application/json',...(cookie?{cookie}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env)
  assert.equal((await call('/config')).status,200);assert.equal((await(await call('/config')).json()).salesEnabled,false)
  assert.equal((await call('/courses/rv30/days/1/media')).status,401)
  assert.equal((await call('/auth/login','POST',{email,password},{origin:'https://evil.example.test'})).status,403)
  assert.equal((await call('/auth/login','POST',{email:'other@example.test',password})).status,401)
  const login=await call('/auth/login','POST',{email,password});assert.equal(login.status,200)
  const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly; Secure; SameSite=Strict/);cookie=header.split(';')[0]
  const account=await(await call('/account')).json();assert.equal(account.account.testAccount,true);assert.deepEqual(account.account.entitlements,['rv30']);assert.equal(account.isAdmin,false)
  assert.equal((await call('/admin/videos')).status,403);assert.equal((await call('/orders','POST',{})).status,503);assert.equal((await call('/auth/signup','POST',{})).status,503)
  const catalog=await(await call('/courses/rv30')).json();assert.equal(catalog.lessons.length,30);assert.equal(catalog.lessons[29].available,false);assert(!JSON.stringify(catalog).includes(key))
  const media=await call('/courses/rv30/days/1/media','GET',undefined,{Range:'bytes=2-4'});assert.equal(media.status,206);assert.equal(await media.text(),'234')
  assert.equal((await call('/courses/rv30/days/30/video')).status,404)
  assert.equal((await call('/courses/rv30/progress/1','PUT',{complete:true,userId:'forged'})).status,200)
  assert.deepEqual((await(await call('/courses/rv30')).json()).progress,[1]);assert.equal((await db.prepare('select user_id from qa_progress').first()).user_id,'fixture-user')
  await db.prepare('update qa_grants set revoked=1').run();assert.equal((await call('/courses/rv30/days/1/media')).status,403)
  await db.prepare('update qa_grants set revoked=0,expires_at=?').bind(now-1).run();assert.equal((await call('/courses/rv30')).status,403)
  await db.prepare('update qa_grants set expires_at=?').bind(now+86400000).run()
  await setTestPassword(env,'new-fixture-password-123');assert.equal((await call('/account')).status,401)
  cookie='';assert.equal((await call('/auth/login','POST',{email,password})).status,401)
  const next=await call('/auth/login','POST',{email,password:'new-fixture-password-123'});assert.equal(next.status,200);cookie=next.headers.get('set-cookie').split(';')[0]
  assert.equal((await call('/auth/logout','POST',{})).status,200);assert.equal((await call('/account')).status,401)
  await assert.rejects(()=>hashPassword('123456',pepper),/12 a 128/)
  const short=await hashPassword('123456',pepper,{preview:true})
  await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind('fixture-admin','admin@example.test','Administrador',short.salt,short.hash,now).run()
  await db.prepare('delete from qa_limits').run();cookie=''
  assert.equal((await call('/auth/login','POST',{email:'admin@example.test',password:'123456'})).status,401,'admin de preview não existe no modo de produção')
  Object.assign(env,{QA_PREVIEW:'true',QA_ADMIN_EMAIL:'admin@example.test',PREVIEW_ORIGINS:env.PUBLIC_SITE_URL})
  const admin=await call('/auth/login','POST',{email:'admin@example.test',password:'123456'});assert.equal(admin.status,200);assert.equal((await admin.clone().json()).isAdmin,true);cookie=admin.headers.get('set-cookie').split(';')[0]
  const students=await(await call('/admin/students')).json();assert.equal(students.students.length,1);assert.equal(students.students[0].email,email)
  assert.equal((await call('/admin/students/fixture-admin','PATCH',{status:'blocked'})).status,404,'admin não pode mudar a própria permissão')
  assert.equal((await call('/admin/students/fixture-user','PATCH',{access:'revoke'})).status,200)
  assert.equal((await(await call('/admin/students')).json()).students[0].hasAccess,false)
  assert.equal((await call('/admin/students/fixture-user','PATCH',{access:'grant'})).status,200)
  assert.equal((await call('/admin/students/fixture-user','PATCH',{status:'blocked'})).status,200)
  assert.equal((await(await call('/admin/students')).json()).students[0].status,'blocked')
  assert.equal((await call('/admin/students/fixture-user','PATCH',{status:'active'})).status,200)
  assert.equal((await call('/orders','POST',{})).status,503,'nem o administrador de preview habilita cobranças')
  await db.prepare('delete from qa_limits').run();cookie=''
  for(let i=0;i<11;i++)await call('/auth/login','POST',{email,password:'wrong'})
  assert.equal((await call('/auth/login','POST',{email,password})).status,429)
  console.log('QA: D1/R2, senha, cookie, origem, grant/expiração, ranges, progresso persistente, revogação de sessões, isolamento e rate limit passaram.')
 }finally{await mf.dispose()}
})().catch(error=>{console.error(error);process.exitCode=1})
