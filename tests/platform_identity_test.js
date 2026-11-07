'use strict'
const fs=require('node:fs'),assert=require('node:assert/strict')
const {Miniflare,convertV4MiniflareOptions}=require('miniflare')
;(async()=>{
 const {createPlatformHandler}=await import('../backend/platform/worker.mjs'),{hashPassword,sha}=await import('../backend/qa/core.mjs')
 const mf=new Miniflare(convertV4MiniflareOptions({name:'identity-fixture',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-26',d1Databases:['QA_DB'],r2Buckets:['VIDEOS']}))
 try{
  const db=await mf.getD1Database('QA_DB'),bucket=await mf.getR2Bucket('VIDEOS')
  for(const file of ['backend/qa/schema.sql','backend/platform/student-schema.sql','backend/platform/identity-schema.sql'])for(const sql of fs.readFileSync(file,'utf8').split(';').filter(x=>x.trim()))await db.prepare(sql).run()
  let now=Date.now();const initial=now,origin='https://platform.example.test',password='StrongFixturePassword123',pepper='protected-fixture-pepper'.repeat(3),hash=await hashPassword(password,pepper)
  const definitions=[['admin',['admin'],'validation'],['student-a',['student'],'validation'],['student-b',['student'],'validation'],['dual',['student','admin'],'validation'],['commercial',['student'],'commercial'],['unverified',['student'],'validation']]
  for(const[id,roles,kind]of definitions){
   await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind(id,id+'@example.test','Perfil '+id,hash.salt,hash.hash,now).run()
   await db.prepare('insert into identity_metadata(user_id,kind,verified_at,verification_method) values(?,?,?,?)').bind(id,kind,id==='unverified'?null:now,kind==='commercial'?'email':'owner_provisioned').run()
   for(const role of roles)await db.prepare('insert into user_roles(user_id,role,assigned_at) values(?,?,?)').bind(id,role,now).run()
   if(roles.includes('student'))await db.prepare("insert into enrollments(user_id,course_id,source,starts_at,expires_at,updated_at) values(?,'rv30',?,?,?,?)").bind(id,kind==='validation'?'owner_validation':'payment',now,now+365*86400000,now).run()
  }
  const media={day:1,key:'rv30/dia-01/'+'b'.repeat(64)+'.mp4',bytes:10,duration:120};await bucket.put(media.key,'0123456789')
  const env={QA_DB:db,VIDEOS:bucket,PLATFORM_ENV:'staging',AUTH_PASSWORD_PEPPER:pepper,PREVIEW_ORIGINS:origin,QA_MEDIA_MANIFEST:JSON.stringify([media])},app=createPlatformHandler({now:()=>now})
  const call=(path,{method='GET',data,cookie='',headers={},environment=env}={})=>app.fetch(new Request('https://worker.example.test/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),environment)
  const signin=async(id,pw=password,extra={},environment=env)=>{
   const response=await call('/auth/login',{method:'POST',data:{email:id+'@example.test',password:pw,...extra},environment})
   return{status:response.status,body:await response.json(),rawCookie:response.headers.get('set-cookie'),cookie:response.headers.get('set-cookie')?.split(';')[0]}
  }
  const admin=await signin('admin'),student=await signin('student-a'),other=await signin('student-b',password,{role:'admin',isAdmin:true,userId:'admin'}),dual=await signin('dual')
  for(const login of [admin,student,other,dual])assert.equal(login.status,200)
  assert.match(admin.rawCookie,/^__Host-rv30_session=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600$/)
  assert.equal(other.body.isAdmin,false);assert.deepEqual(dual.body.roles,['admin','student'])
  const account=async(cookie)=>(await(await call('/account',{cookie})).json())
  const requestClock=createPlatformHandler(),originalClock=Date.now
  try{
   Date.now=()=>initial+1234
   const live=await requestClock.fetch(new Request(origin+'/api/student/dashboard',{headers:{Cookie:student.cookie}}),env)
   assert.equal((await live.json()).generatedAt,new Date(initial+1234).toISOString(),'o relógio é resolvido por solicitação, sem capturar Date.now na inicialização')
  }finally{Date.now=originalClock}
  assert.deepEqual((await account(admin.cookie)).account.entitlements,[])
  assert.deepEqual((await account(dual.cookie)).account.entitlements,['rv30'])
  assert.equal((await call('/admin/students',{cookie:student.cookie})).status,403)
  assert.equal((await call('/admin/students',{cookie:admin.cookie})).status,200)
  assert.equal((await signin('unverified')).status,401)
  assert.equal((await signin('commercial')).status,401)
  assert.equal((await signin('student-a',password,{}, {...env,PLATFORM_ENV:'production'})).status,401)
  assert.equal((await signin('commercial',password,{}, {...env,PLATFORM_ENV:'production'})).status,200)
  assert.equal((await call('/account',{cookie:'__Host-rv30_session='+'f'.repeat(64)})).status,401)
  assert.equal((await call('/account',{cookie:'__Host-rv30_qa_session='+'f'.repeat(64)})).status,401)
  assert.equal((await call('/auth/login',{method:'POST',data:{email:'admin@example.test',password},headers:{Origin:'https://evil.example.test'}})).status,403)
  assert.equal((await call('/auth/signup',{method:'POST',data:{email:'attacker@example.test',password,role:'admin'}})).status,503)
  assert.equal((await db.prepare("select count(*) as n from qa_users where email='attacker@example.test'").first()).n,0)
  assert.equal((await call('/courses/rv30/progress/1',{method:'PUT',cookie:other.cookie,data:{complete:true,userId:'student-a'}})).status,200)
  assert.equal((await db.prepare("select count(*) as n from qa_progress where user_id='student-a'").first()).n,0)
  assert.equal((await db.prepare("select count(*) as n from qa_progress where user_id='student-b'").first()).n,1)
  const patch=(id,data)=>call('/admin/students/'+id,{method:'PATCH',cookie:admin.cookie,data})
  assert.equal((await patch('student-b',{access:'revoke'})).status,200)
  assert.equal((await call('/courses/rv30/days/1/media',{cookie:other.cookie,headers:{Range:'bytes=0-1'}})).status,403)
  assert.equal((await patch('student-b',{access:'grant'})).status,200)
  assert.equal((await call('/courses/rv30/days/1/media',{cookie:other.cookie,headers:{Range:'bytes=0-1'}})).status,206)
  assert.equal((await patch('student-b',{status:'blocked'})).status,200)
  assert.equal((await call('/account',{cookie:other.cookie})).status,401)
  assert.equal((await signin('student-b')).status,401)
  assert.equal((await patch('student-b',{status:'active'})).status,200)
  assert.equal((await call('/account',{cookie:other.cookie})).status,401,'desbloqueio não restaura sessão revogada')
  assert.equal((await signin('student-b')).status,200)
  const issue=async purpose=>{const response=await call('/admin/identity-tokens',{method:'POST',cookie:admin.cookie,data:{userId:'student-a',purpose}});assert.equal(response.status,200);return response.json()}
  const obsolete=await issue('recovery'),token=await issue('recovery')
  assert.equal(token.delivery,'manual_private');assert(!token.message.includes('foi enviado.\n'))
  assert.equal((await call('/auth/accept',{method:'POST',data:{token:obsolete.token,password:'NewStrongFixturePassword1'}})).status,400)
  await call('/auth/accept?token='+token.token)
  assert.equal((await db.prepare('select used_at from identity_tokens where token_hash=?').bind(await sha(token.token)).first()).used_at,null,'GET não consome convite')
  assert.equal((await call('/auth/accept',{method:'POST',data:{token:token.token,password:'123456'}})).status,400)
  const attempts=await Promise.all(['NewStrongFixturePassword1','NewStrongFixturePassword2'].map(pw=>call('/auth/accept',{method:'POST',data:{token:token.token,password:pw,userId:'admin',role:'admin'}})))
  assert.deepEqual(attempts.map(x=>x.status).sort(),[200,400],'o token só pode alterar uma senha uma vez mesmo com concorrência')
  assert.equal((await call('/account',{cookie:student.cookie})).status,401)
  assert.equal((await signin('student-a')).status,401)
  const winner=attempts[0].ok?'NewStrongFixturePassword1':'NewStrongFixturePassword2'
  const changed=await signin('student-a',winner);assert.equal(changed.status,200);assert.equal(changed.body.isAdmin,false)
  assert.equal((await db.prepare("select count(*) as n from identity_events where action='recovery_accepted' and user_id='student-a'").first()).n,1)
  assert.equal((await call('/auth/accept',{method:'POST',data:{token:token.token,password:winner}})).status,400)
  const logout=await call('/auth/logout',{method:'POST',cookie:changed.cookie,data:{}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/)
  assert.equal((await call('/account',{cookie:changed.cookie})).status,401)
  const old=await signin('dual');now+=1800001
  assert.equal((await call('/account',{cookie:old.cookie})).status,401,'sessão inativa expira no servidor')
  now=initial;await db.prepare("update enrollments set expires_at=? where user_id='dual'").bind(now+1).run();const boundary=await signin('dual');now++
  assert.equal((await account(boundary.cookie)).isAdmin,true)
  assert.deepEqual((await account(boundary.cookie)).account.entitlements,[],'expiração da matrícula não remove o papel administrativo')
  assert.equal((await call('/courses/rv30/days/1/media',{cookie:boundary.cookie})).status,403)
  await db.prepare("delete from user_roles where user_id='dual' and role='admin'").run()
  assert.equal((await call('/admin/students',{cookie:boundary.cookie})).status,403,'papéis são consultados no servidor, sem confiar no login antigo')
  now=initial+3600001;assert.equal((await call('/account',{cookie:admin.cookie})).status,401)
  const limited=[];for(let attempt=0;attempt<9;attempt++)limited.push((await signin('unknown')).status)
  assert.deepEqual(limited,[401,401,401,401,401,401,401,401,429],'tentativas repetidas são limitadas antes de novos hashes de senha')
  const text=JSON.stringify(await account(''));assert(!/password_hash|password_salt|AUTH_PASSWORD_PEPPER/.test(text))
  console.log('Identidade: contas gerais, papéis múltiplos, isolamento, CSRF, ambientes separados, bloqueio, revogação, expiração, cookie protegido, recuperação de uso único concorrente, senha forte e logout aprovados em D1/R2 locais.')
 }finally{await mf.dispose()}
})().catch(error=>{console.error(error);process.exitCode=1})
