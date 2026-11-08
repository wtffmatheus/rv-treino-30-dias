// UI contracts with fixture APIs; connected D1/R2 journeys are verified separately.
const{test,expect}=require('@playwright/test')
async function setup(page,{support=false}={}){
 const calls=[],document={title:'Dia 01',description:'Descrição',objective:'Objetivo',instructions:'Orientações',materials:[],warnings:[],durationLabel:'',order:1,mediaId:null,coverId:null,editorialReviewed:false}
 await page.route('**/api/**',route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();calls.push({path,method,body:method==='POST'||method==='PUT'?request.postDataJSON():null})
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(path==='/api/config')return json({ok:true,configured:true,qaOnly:true,platformMode:true,platformIdentity:true,platformAdmin:true,salesEnabled:false})
  if(path==='/api/account')return json({ok:true,isAdmin:!support,account:{id:'admin',name:'Conta de fixture',roles:support?['student']:['admin'],entitlements:[],testAccount:true}})
  if(path==='/api/admin/metrics')return json({ok:true,totals:{students:2,blocked:0,activeEnrollments:1,expiredEnrollments:0,newStudents:2,activeStudents:1,lessonsStarted:3,lessonsCompleted:1,averageProgress:2,completionRate:0,averageActivitySeconds:21,pendingSupport:0},activity:[],lessons:[],orders:[],definitions:{activity:'Atividade de fixture',period:'Período de fixture',notCompleted:'Sem conclusão'}})
  if(path==='/api/admin/students'&&method==='POST')return json({ok:false,message:'Já existe uma conta com esse e-mail.'},409)
  if(path==='/api/admin/students')return json({ok:true,students:[],total:0,page:1})
  if(path==='/api/admin/orders')return json({ok:true,orders:[],message:'Gateway não homologado.'})
  if(path==='/api/admin/content')return json({ok:true,course:{revision:1,draft:{title:'RV 30',description:'',priceCents:39900,accessDurationDays:365}},lessons:[{day:1,revision:1,draft:document,published:null}]})
  if(path==='/api/admin/media')return json({ok:true,media:[]})
  if(path.endsWith('/versions'))return json({ok:true,versions:[]})
  if(path==='/api/admin/content/lesson/1'&&method==='PUT')return json({ok:false,message:'Outra alteração foi salva. Recarregue antes de editar novamente.'},409)
  if(path==='/api/support')return json({ok:true,threads:[{id:'thread',subject:'Dúvida segura',status:'answered',updated_at:1,unread:1}]})
  if(path==='/api/support/thread'&&method==='GET')return json({ok:true,thread:{subject:'Dúvida segura'},messages:[{sender_role:'admin',body:'<img src=x onerror=alert(1)>',at:1}]})
  if(path==='/api/support/thread')return json({ok:true})
  return json({ok:false,message:'Não localizado'},404)
 })
 return calls
}
test('Administração: indicadores do contrato, período e navegação mobile por teclado',async({page})=>{
 const calls=await setup(page);await page.goto('/admin');await expect(page.locator('.platform-metric')).toHaveCount(12)
 await page.getByLabel('Período',{exact:true}).selectOption('7');await expect.poll(()=>calls.filter(x=>x.path==='/api/admin/metrics').length).toBe(2)
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)}
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.platform-navigation')).toHaveJSProperty('open',false);await page.locator('.platform-navigation summary').focus();await page.keyboard.press('Enter');await expect(page.locator('.platform-navigation')).toHaveJSProperty('open',true);await page.getByRole('link',{name:'Alunos',exact:true}).click();await expect(page.getByRole('heading',{name:'Alunos',exact:true})).toBeVisible()
})
test('Administração: criação usa o servidor e apresenta conflito sem anunciar sucesso',async({page})=>{
 const calls=await setup(page);await page.goto('/admin?view=students');await page.getByLabel('Nome',{exact:true}).fill('Conta de fixture');await page.getByLabel('E-mail',{exact:true}).fill('fixture@example.test');await page.getByRole('button',{name:'Criar perfil',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Já existe uma conta'})).toBeVisible()
 expect(calls.filter(x=>x.path==='/api/admin/students'&&x.method==='POST')).toHaveLength(1)
})
test('Administração: página curta mantém o conteúdo junto ao menu no mobile',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await page.goto('/admin?view=orders');await expect(page.getByRole('heading',{name:'Pedidos e pagamentos',exact:true})).toBeVisible()
 const gap=await page.evaluate(()=>document.querySelector('main').getBoundingClientRect().top-document.querySelector('.platform-navigation').getBoundingClientRect().bottom)
 expect(Math.abs(gap)).toBeLessThanOrEqual(1)
})
test('Administração: conflito de revisão impede publicação e preserva o rascunho no formulário',async({page})=>{
 const calls=await setup(page);await page.goto('/admin?view=content');await page.getByLabel('Título',{exact:true}).fill('Rascunho local');await page.getByRole('button',{name:'Salvar e publicar aula',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Outra alteração foi salva'})).toBeVisible();await expect(page.getByLabel('Título',{exact:true})).toHaveValue('Rascunho local')
 const writes=calls.filter(x=>x.path==='/api/admin/content/lesson/1');expect(writes).toHaveLength(1);expect(writes[0].body.action).toBe('save');expect(writes[0].body.revision).toBe(1)
})
test('Suporte: resposta é texto inerte e envio da mensagem usa o atendimento selecionado',async({page})=>{
 const calls=await setup(page,{support:true});await page.goto('/suporte');await page.getByRole('button',{name:/Dúvida segura/}).click();await expect(page.getByText('<img src=x onerror=alert(1)>',{exact:true})).toBeVisible();await expect(page.locator('.platform-messages img')).toHaveCount(0)
 const reply=page.getByRole('heading',{name:'Enviar resposta',exact:true}).locator('..');await reply.getByLabel('Mensagem',{exact:true}).fill('Resposta da conta de fixture');await reply.getByRole('button',{name:'Enviar',exact:true}).click();await expect.poll(()=>calls.filter(x=>x.path==='/api/support/thread'&&x.method==='POST').length).toBe(1)
})
for(const professional of [false,true])test('Acesso '+(professional?'administrativo':'do aluno')+': envio aguarda inicialização e não faz POST nativo',async({page})=>{
 let release;const pending=new Promise(resolve=>{release=resolve}),native=[],logins=[]
 page.on('request',request=>{if(request.method()==='POST'&&!new URL(request.url()).pathname.startsWith('/api/'))native.push(request.url())})
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path==='/api/config'){await pending;return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,configured:true,platformMode:true,platformIdentity:true,platformAdmin:true})})}
  if(path==='/api/auth/login')logins.push(path)
  return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,message:'Credenciais recusadas na fixture',code:'AUTH_REQUIRED'})})
 })
 await page.goto(professional?'/admin/entrar':'/entrar');const form=page.locator(professional?'[data-admin-login-form]':'[data-login-form]'),submit=form.locator('button[type=submit]')
 await expect(submit).toBeDisabled();await form.evaluate(node=>node.requestSubmit());expect(native).toEqual([]);expect(logins).toEqual([])
 release();await expect(submit).toBeEnabled();await form.locator('[name=email]').fill('fixture@example.test');await form.locator('[name=password]').fill('OnlyFixturePassword123');await submit.click();await expect(page.getByRole('alert').filter({hasText:'Credenciais recusadas na fixture'})).toBeVisible();expect(native).toEqual([]);expect(logins).toHaveLength(1)
})
