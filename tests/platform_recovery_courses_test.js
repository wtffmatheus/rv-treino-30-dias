'use strict'
// Integration test of the real platform handler (backend/platform/worker.mjs)
// on a throwaway Miniflare D1/R2. The EMAIL binding below is a capturing test
// double: it proves what the Worker hands to the provider. Real delivery is
// validated separately against the configured provider.
const fs=require('node:fs'),assert=require('node:assert/strict'),{Miniflare,convertV4MiniflareOptions}=require('miniflare')
const SCHEMAS=['backend/qa/schema.sql','backend/platform/student-schema.sql','backend/platform/identity-schema.sql','backend/platform/admin-schema.sql','backend/platform/catalog-schema.sql']
;(async()=>{
 const{createPlatformHandler}=await import('../backend/platform/worker.mjs'),{hashPassword}=await import('../backend/qa/core.mjs'),{sixDigitCode}=await import('../backend/platform/recovery.mjs')
 const mf=new Miniflare(convertV4MiniflareOptions({name:'recovery-fixture',modules:true,script:'export default {fetch(){return new Response("fixture")}}',compatibilityDate:'2026-10-26',d1Databases:['QA_DB'],r2Buckets:['VIDEOS']}))
 try{
  const db=await mf.getD1Database('QA_DB'),bucket=await mf.getR2Bucket('VIDEOS'),origin='https://platform.example.test',pepper='recovery-fixture-pepper-'.repeat(3)
  let now=Date.UTC(2026,10,22,12),stamp=now
  for(const file of SCHEMAS)for(const sql of fs.readFileSync(file,'utf8').replace(/--[^\n]*/g,'').split(';').filter(x=>x.trim()))await db.prepare(sql).run()
  // Running the additive migration twice must be harmless (deploys may re-apply it).
  for(const sql of fs.readFileSync('backend/platform/catalog-schema.sql','utf8').replace(/--[^\n]*/g,'').split(';').filter(x=>x.trim()))await db.prepare(sql).run()
  const initial={admin:'AdminFixturePassword1',ana:'AnaOriginalPassword1',bruno:'BrunoOriginalPassword1'}
  for(const [id,password] of Object.entries(initial)){
   const hash=await hashPassword(password,pepper)
   await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)').bind(id,id+'@example.test','Perfil '+id,hash.salt,hash.hash,now).run()
   await db.prepare("insert into identity_metadata(user_id,kind,verified_at,verification_method) values(?,'validation',?,'owner_provisioned')").bind(id,now).run()
   await db.prepare('insert into user_roles(user_id,role,assigned_at) values(?,?,?)').bind(id,id==='admin'?'admin':'student',now).run()
   if(id!=='admin')await db.prepare("insert into enrollments(user_id,course_id,source,starts_at,expires_at,updated_at) values(?,'rv30','owner_validation',?,?,?)").bind(id,now,now+365*86400000,now).run()
  }
  await db.prepare("insert into qa_progress(user_id,day,completed_at) values('ana',1,?),('ana',2,?)").bind(now,now).run()
  const course={title:'RV 30',description:'Curso',priceCents:49900,currency:'BRL',accessDurationDays:365}
  await db.prepare("insert into course_records(id,draft,published,updated_at) values('rv30',?,?,?)").bind(JSON.stringify(course),JSON.stringify(course),now).run()
  for(let day=1;day<=30;day++){const doc={title:'Dia '+day,order:day,mediaId:null};await db.prepare('insert into lesson_records(day,draft,published,updated_at) values(?,?,null,?)').bind(day,JSON.stringify(doc),now).run()}
  const videoKey='cursos/mobilidade/aula-1.mp4',video=Buffer.from('0123456789abcdef');await bucket.put(videoKey,video)
  await db.prepare("insert into media_records(id,object_key,kind,label,state,bytes,duration,width,height,format,created_at) values('mob-video',?,'video','Mobilidade 1','ready',?,10,720,1280,'video/mp4',?)").bind(videoKey,video.length,now).run()
  const outbox=[],emailState={fail:false}
  const EMAIL={send:async message=>{if(emailState.fail)throw Object.assign(new Error('provider down'),{code:'E_DELIVERY'});outbox.push(message);return{messageId:'msg-'+outbox.length}}}
  const env={QA_DB:db,VIDEOS:bucket,AUTH_PASSWORD_PEPPER:pepper,PLATFORM_ENV:'staging',PLATFORM_ADMIN_ENABLED:'true',PREVIEW_ORIGINS:origin,EMAIL,EMAIL_FROM:'RV Treino 30 Dias <nao-responda@avisos.example.test>',EMAIL_ASSET_ORIGIN:'https://treino.example.test',EMAIL_DELIVERY_ENABLED:'true'}
  const app=createPlatformHandler({now:()=>now})
  const call=async(path,{cookie='',method='GET',body,headers={},environment=env,ip='198.51.100.7'}={})=>{
   const response=await app.fetch(new Request(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),environment)
   const type=response.headers.get('content-type')||''
   return{status:response.status,headers:response.headers,body:type.includes('json')?await response.json():await response.text()}
  }
  const login=(id,password)=>call('/auth/login',{method:'POST',body:{email:id+'@example.test',password}})
  const signin=async(id,password)=>{const result=await login(id,password);assert.equal(result.status,200,id+' deveria entrar');return result.headers.get('set-cookie').split(';')[0]}
  const passwordRow=id=>db.prepare('select password_hash,password_salt,credential_version from qa_users where id=?').bind(id).first()
  const tick=minutes=>{now+=minutes*60000}

  // ---- Senha: login, recusa, persistência --------------------------------
  let admin=await signin('admin',initial.admin)
  assert.equal((await login('ana','senha-errada-123')).status,401,'senha incorreta é recusada')
  assert.equal((await login('ana',' '+initial.ana)).status,401,'a senha não sofre trim: espaços fazem parte dela')
  const anaBefore=await passwordRow('ana')
  // Novo build/deploy = nova instância do handler sobre o mesmo D1: a senha continua válida.
  const rebuilt=createPlatformHandler({now:()=>now})
  const rebuiltLogin=await rebuilt.fetch(new Request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'ana@example.test',password:initial.ana})}),{...env})
  assert.equal(rebuiltLogin.status,200,'a senha sobrevive a um novo build/deploy do Worker')
  // Carregar o handler e aplicar a migração aditiva não toca credenciais.
  assert.deepEqual(await passwordRow('ana'),anaBefore,'inicialização e migração não redefinem senhas')
  let ana=await signin('ana',initial.ana)
  assert.equal((await call('/auth/logout',{method:'POST',cookie:ana,body:{}})).status,200)
  assert.equal((await call('/account',{cookie:ana})).status,401,'logout encerra a sessão')
  ana=await signin('ana',initial.ana)

  // ---- Catálogo de cursos ------------------------------------------------
  const a=(path,options={})=>call('/admin'+path,{cookie:admin,...options})
  assert.equal((await call('/admin/courses',{cookie:ana})).status,403,'aluno não administra cursos')
  let created=await a('/courses',{method:'POST',body:{title:'Mobilidade Essencial',description:'Curso adicional A'}})
  assert.equal(created.status,201);assert.equal(created.body.id,'mobilidade-essencial')
  assert.equal((await a('/courses',{method:'POST',body:{title:'Força em Casa',id:'forca-em-casa'}})).status,201)
  let list=await a('/courses');assert.deepEqual(list.body.courses.map(x=>x.id).sort(),['forca-em-casa','mobilidade-essencial','rv30'])
  let mob=list.body.courses.find(x=>x.id==='mobilidade-essencial')
  assert.equal((await a('/courses/mobilidade-essencial',{method:'PATCH',body:{state:'published',revision:mob.revision}})).status,400,'curso sem aula publicada não é publicado')
  assert.equal((await a('/courses/mobilidade-essencial/lessons',{method:'POST',body:{title:'Aula 1',position:1,published:true}})).status,400,'aula publicada exige vídeo validado')
  const lesson=await a('/courses/mobilidade-essencial/lessons',{method:'POST',body:{title:'Aula 1 · Quadril',description:'Mobilidade de quadril',position:1,mediaId:'mob-video',published:true}})
  assert.equal(lesson.status,201)
  await a('/courses/mobilidade-essencial/lessons',{method:'POST',body:{title:'Aula 2 · Rascunho',position:2}})
  assert.equal((await a('/courses/mobilidade-essencial',{method:'PATCH',body:{state:'published',revision:mob.revision}})).status,200)
  const forca=(await a('/courses')).body.courses.find(x=>x.id==='forca-em-casa')
  assert.equal((await a('/courses/rv30',{method:'PATCH',body:{state:'archived',revision:1}})).status,409,'o RV 30 não pode ser arquivado')
  assert.equal((await a('/courses/forca-em-casa',{method:'PATCH',body:{state:'archived',revision:forca.revision}})).status,200,'curso pode ser arquivado')

  // ---- Cadastro de alunos com cursos ---------------------------------------
  const newStudent=await a('/students',{method:'POST',body:{name:'Matheus Validação',email:'Novo.Aluno@Example.test',phone:'',courses:[{id:'rv30',days:30},{id:'mobilidade-essencial',days:90}]}})
  assert.equal(newStudent.status,201,JSON.stringify(newStudent.body));assert.equal(newStudent.body.invitation.sent,true)
  assert.equal(outbox.length,1);const invite=outbox[0]
  assert.equal(invite.to,'novo.aluno@example.test');assert.match(invite.subject,/Ative seu acesso/)
  assert.match(invite.html,/https:\/\/treino\.example\.test\/assets\/brand\/rv30-logo\.png/,'o e-mail usa a logo verdadeira do RV30')
  assert.match(invite.html,/Mobilidade Essencial/);assert.doesNotMatch(JSON.stringify(newStudent.body),/password|senha_temp/i,'o administrador não recebe senha')
  const inviteToken=invite.text.match(/#token=([a-f0-9]{64})&type=invitation/)[1]
  const dup=await a('/students',{method:'POST',body:{name:'Outro',email:'novo.aluno@example.test',courses:[]}})
  assert.equal(dup.status,409,'e-mail duplicado é impedido');assert.equal(dup.body.existingId,newStudent.body.id)
  assert.equal((await db.prepare("select count(*) as n from qa_users where email='novo.aluno@example.test'").first()).n,1)
  assert.equal((await a('/students',{method:'POST',body:{name:'X',email:'x@example.test',courses:[{id:'forca-em-casa',days:30}]}})).status,400,'curso arquivado não é liberado')
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:inviteToken,password:'curta'}})).status,400,'política: mínimo de 12 caracteres')
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:inviteToken,password:'x'.repeat(129)}})).status,400,'política: máximo de 128 caracteres')
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:inviteToken,password:'MinhaSenhaDoConvite1'}})).status,200)
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:inviteToken,password:'OutraSenhaQualquer12'}})).status,400,'convite é de uso único')
  const novo=(await call('/auth/login',{method:'POST',body:{email:'novo.aluno@example.test',password:'MinhaSenhaDoConvite1'}})).headers.get('set-cookie').split(';')[0]
  let mine=await call('/student/courses',{cookie:novo})
  assert.deepEqual(mine.body.courses.map(x=>[x.id,x.status]),[['rv30','active'],['mobilidade-essencial','active']])
  const mobCard=mine.body.courses[1];assert.equal(mobCard.totalLessons,1,'somente aulas publicadas contam');assert.equal(mobCard.href,'/curso/mobilidade-essencial')
  let detail=await call('/courses/mobilidade-essencial',{cookie:novo});assert.equal(detail.status,200);assert.deepEqual(detail.body.lessons.map(x=>x.title),['Aula 1 · Quadril'])
  const lessonId=detail.body.lessons[0].id
  const media=await call(`/courses/mobilidade-essencial/lessons/${lessonId}/media`,{cookie:novo,headers:{Range:'bytes=0-3'}});assert.equal(media.status,206,'aluno matriculado recebe o vídeo privado com Range')
  assert.equal((await call(`/courses/mobilidade-essencial/lessons/${lessonId}/media`,{headers:{Range:'bytes=0-3'}})).status,401,'vídeo privado exige sessão')
  assert.equal((await call(`/courses/mobilidade-essencial/lessons/${lessonId}/media`,{cookie:ana,headers:{Range:'bytes=0-3'}})).status,403,'isolamento: aluna sem matrícula não acessa')
  assert.equal((await call('/courses/mobilidade-essencial',{cookie:ana})).status,403)
  assert.equal((await call(`/courses/mobilidade-essencial/lessons/${lessonId}/progress`,{method:'PUT',cookie:novo,body:{complete:true}})).status,200)
  assert.equal((await call('/student/courses',{cookie:novo})).body.courses[1].percent,100)

  // ---- Matrículas: liberar, renovar, revogar; senha intocada ---------------
  const id=newStudent.body.id,enroll=(course,body)=>a(`/students/${id}/enrollments/${course}`,{method:'PUT',body})
  const pwBefore=await passwordRow(id)
  let row=await db.prepare("select expires_at from course_enrollments where user_id=? and course_id='mobilidade-essencial'").bind(id).first()
  assert.equal((await enroll('mobilidade-essencial',{action:'renew',days:30})).status,200)
  const renewed=await db.prepare("select expires_at from course_enrollments where user_id=? and course_id='mobilidade-essencial'").bind(id).first()
  assert.equal(renewed.expires_at,row.expires_at+30*86400000,'renovação soma ao vencimento vigente')
  assert.equal((await enroll('mobilidade-essencial',{action:'revoke'})).status,200)
  assert.equal((await call(`/courses/mobilidade-essencial/lessons/${lessonId}/media`,{cookie:novo,headers:{Range:'bytes=0-3'}})).status,403,'acesso cai imediatamente após revogação')
  assert.equal((await call('/student/courses',{cookie:novo})).body.courses[1].status,'revoked')
  assert.equal((await enroll('mobilidade-essencial',{action:'grant',days:10})).status,200,'liberação reativa a matrícula')
  assert.equal((await call(`/courses/mobilidade-essencial/lessons/${lessonId}/media`,{cookie:novo,headers:{Range:'bytes=0-3'}})).status,206)
  assert.equal((await enroll('rv30',{action:'renew',days:365})).status,200)
  assert.equal((await a(`/students/${id}`,{method:'PATCH',body:{action:'profile',name:'Matheus Editado',phone:'11999990000'}})).status,200)
  assert.deepEqual(await passwordRow(id),pwBefore,'matrícula e perfil não alteram senha nem credential_version')
  assert.equal((await call('/account',{cookie:novo})).status,200,'a sessão do aluno continua válida')
  // Matrícula não é pagamento: nenhuma ordem é criada e matrícula paga é imutável.
  assert.equal((await db.prepare('select count(*) as n from platform_orders').first()).n,0)
  await db.prepare("update course_enrollments set source='payment' where user_id=? and course_id='mobilidade-essencial'").bind(id).run()
  assert.equal((await enroll('mobilidade-essencial',{action:'renew',days:30})).status,403,'administrador não falsifica/renova compra')
  await db.prepare("update course_enrollments set source='administrative' where user_id=? and course_id='mobilidade-essencial'").bind(id).run()
  const studentDetail=await a('/students/'+id);assert.deepEqual(studentDetail.body.courses.map(x=>x.courseId),['rv30','mobilidade-essencial'])
  // Histórico do RV30 preservado.
  assert.equal((await db.prepare("select count(*) as n from qa_progress where user_id='ana'").first()).n,2)
  assert.equal((await call('/courses/rv30',{cookie:ana})).status,200,'RV30 continua respondendo pela rota original')

  // ---- Recuperação por código -------------------------------------------------
  outbox.length=0
  const ask=(email,ip)=>call('/auth/recovery/request',{method:'POST',body:{email},ip})
  const verify=(email,code)=>call('/auth/recovery/verify',{method:'POST',body:{email,code}})
  const unknown=await ask('ninguem@example.test'),known=await ask('ana@example.test')
  assert.equal(unknown.status,200);assert.deepEqual(unknown.body,known.body,'e-mail inexistente recebe a mesma resposta')
  assert.equal(outbox.length,1,'somente a conta existente recebe e-mail');assert.equal((await db.prepare("select count(*) as n from qa_users where email='ninguem@example.test'").first()).n,0,'recuperação não cria contas')
  const mail=outbox[0];assert.equal(mail.to,'ana@example.test');const code=mail.text.match(/recuperação: (\d{6})/)[1]
  assert.match(mail.html,/expira em 10 minutos/);assert.match(mail.html,/ignore este e-mail/);assert.match(mail.html,/rv30-logo\.png/)
  const stored=await db.prepare("select code_hash from recovery_codes where user_id='ana'").first();assert.notEqual(stored.code_hash,code);assert.doesNotMatch(stored.code_hash,new RegExp(code),'o código não é salvo em texto puro')
  assert.equal((await ask('ana@example.test')).status,200);assert.equal(outbox.length,1,'reenvio respeita intervalo mínimo de 60 s')
  const wrong=code==='000000'?'111111':'000000'
  assert.equal((await verify('ana@example.test',wrong)).status,400,'código incorreto é recusado')
  assert.equal((await verify('ninguem@example.test',code)).body.message,(await verify('ana@example.test',wrong)).body.message,'mensagem idêntica para e-mail inexistente')
  for(let i=0;i<3;i++)await verify('ana@example.test',wrong)
  assert.equal((await verify('ana@example.test',code)).status,400,'após 5 tentativas o código correto deixa de valer')
  tick(2);await ask('ana@example.test');const code2=outbox.at(-1).text.match(/recuperação: (\d{6})/)[1]
  assert.equal((await verify('ana@example.test',code)).status,400,'código anterior foi invalidado pelo novo envio')
  // Consumo duplo concorrente: apenas uma verificação vence.
  const race=await Promise.all([verify('ana@example.test',code2),verify('ana@example.test',code2)])
  assert.deepEqual(race.map(x=>x.status).sort(),[200,400],'código de uso único mesmo em paralelo')
  const reset=race.find(x=>x.status===200).body.token
  assert.equal((await verify('ana@example.test',code2)).status,400,'código já utilizado é recusado')
  assert.equal((await login('ana',initial.ana)).status,200,'a senha só muda após definir a nova senha')
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:reset,password:'curta'}})).status,400,'política de senha aplicada')
  const brunoBefore=await passwordRow('bruno')
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:reset,password:'AnaNovaSenhaSegura2026'}})).status,200)
  assert.equal((await call('/account',{cookie:ana})).status,401,'sessões antigas são invalidadas após a troca legítima')
  assert.equal((await login('ana',initial.ana)).status,401,'senha antiga deixa de funcionar')
  tick(1);ana=await signin('ana','AnaNovaSenhaSegura2026')
  assert.deepEqual(await passwordRow('bruno'),brunoBefore,'outro usuário não é afetado');await signin('bruno',initial.bruno)
  assert.equal((await db.prepare("select count(*) as n from qa_progress where user_id='ana'").first()).n,2,'troca de senha preserva o progresso')
  // Expiração de 10 minutos.
  tick(2);outbox.length=0;await ask('bruno@example.test');const code3=outbox[0].text.match(/recuperação: (\d{6})/)[1]
  tick(11);assert.equal((await verify('bruno@example.test',code3)).status,400,'código expirado é recusado')
  // Falha do provedor: nenhuma senha muda e o código é invalidado.
  tick(2);emailState.fail=true;const before=await passwordRow('bruno');assert.equal((await ask('bruno@example.test')).status,200)
  const failed=await db.prepare("select consumed_at from recovery_codes where user_id='bruno' order by created_at desc limit 1").first();assert.ok(failed.consumed_at,'código descartado quando o e-mail falha')
  assert.deepEqual(await passwordRow('bruno'),before);emailState.fail=false
  // Sem provedor configurado: falha fechada, sem simulação.
  assert.equal((await call('/config',{environment:{...env,EMAIL_DELIVERY_ENABLED:'false'}})).body.recoveryMode,'administrative_invite','sem confirmação de entrega, o site não promete e-mail')
  const noEmail={...env,EMAIL:undefined};assert.equal((await call('/auth/recovery/request',{method:'POST',body:{email:'bruno@example.test'},environment:noEmail})).status,503)
  assert.equal((await call('/config',{environment:noEmail})).body.recoveryMode,'administrative_invite');assert.equal((await call('/config')).body.recoveryMode,'email_code')
  // Limite por IP e por conta.
  let limited=0;for(let i=0;i<8;i++){if((await ask('limite@example.test','203.0.113.9')).status===429)limited++}
  assert.ok(limited>=3,'limite por conta aplicado (5 por 15 min)')
  // Administrador também recupera a própria conta.
  tick(20);outbox.length=0;await ask('admin@example.test');const adminCode=outbox[0].text.match(/recuperação: (\d{6})/)[1]
  const adminReset=await verify('admin@example.test',adminCode);assert.equal(adminReset.status,200)
  assert.equal((await call('/auth/accept',{method:'POST',body:{token:adminReset.body.token,password:'AdminNovaSenha2026!'}})).status,200)
  admin=await signin('admin','AdminNovaSenha2026!');assert.equal((await call('/admin/courses',{cookie:admin})).status,200,'papéis preservados após recuperação')
  // Códigos: 6 dígitos, distribuição sem viés aparente.
  const sample=new Set();for(let i=0;i<500;i++){const value=sixDigitCode();assert.match(value,/^\d{6}$/);sample.add(value)}assert.ok(sample.size>490)
  const events=(await db.prepare("select action from identity_events where user_id='ana' order by at").all()).results.map(x=>x.action)
  for(const action of ['recovery_code_issued','recovery_email_sent','recovery_code_verified','recovery_accepted'])assert.ok(events.includes(action),'evento auditado: '+action)
  const logs=JSON.stringify((await db.prepare('select * from identity_events').all()).results)+JSON.stringify((await db.prepare('select * from audit_events').all()).results)
  assert.ok(!logs.includes(code)&&!logs.includes(code2)&&!logs.includes(reset)&&!logs.includes(inviteToken),'eventos não registram códigos nem tokens')
  console.log('Plataforma: recuperação por código, convite por e-mail, catálogo multi-curso, matrículas e preservação de senhas passaram (%d s simulados).',Math.round((now-stamp)/1000))
 }finally{await mf.dispose()}
})().catch(error=>{console.error(error);process.exitCode=1})
