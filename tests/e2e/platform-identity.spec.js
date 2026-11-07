// UI contracts with fixture responses. Real identity flows are validated separately.
const {test,expect}=require('@playwright/test')
async function fixture(page,{admin=false,enrolled=false}={}){
 const calls=[]
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;calls.push({path,method:route.request().method()})
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(path==='/api/config')return json({ok:true,configured:true,qaOnly:true,platformMode:true,platformIdentity:true,salesEnabled:false,registrationEnabled:false})
  if(path==='/api/account')return json({ok:true,isAdmin:admin,account:{id:'fixture',name:'Conta de validação',status:'active',testAccount:true,roles:admin?['admin','student']:['student'],entitlements:enrolled?['rv30']:[]}})
  if(path==='/api/courses/rv30')return json({ok:true,lessons:[],progress:[]})
  if(path==='/api/admin/students')return json({ok:true,students:[]})
  if(path==='/api/student/dashboard')return json({ok:true,course:{title:'RV 30'},enrollment:{status:enrolled?'active':'none',source:enrolled?'owner_validation':null,startsAt:enrolled?'2026-11-07T15:00:00Z':null,expiresAt:enrolled?'2027-11-07T15:00:00Z':null},progress:{completedDays:0,percent:0},activity:{validatedSeconds:0,lastLessonDay:null,lastActivityAt:null},resume:enrolled?{day:1,positionSeconds:0}:null,history:[],upcoming:[],messages:[]})
  return json({ok:false},404)
 })
 return calls
}
test('Identidade: administrador sem matrícula vê seu estado sem receber acesso fictício',async({page})=>{
 await fixture(page,{admin:true});await page.goto('/meus-cursos')
 await expect(page.getByText('Sem matrícula',{exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:'Administração',exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:'Começar meu programa'})).toHaveCount(0)
})
test('Identidade: conta com ambos os papéis alterna contextos e mantém a matrícula',async({page})=>{
 await fixture(page,{admin:true,enrolled:true});await page.goto('/meus-cursos')
 await expect(page.getByText('Matrícula ativa',{exact:true})).toBeVisible()
 await page.locator('[data-role-context]').click();await expect(page).toHaveURL(/\/admin(?:\.html)?$/)
 await expect(page.locator('[data-role-context]')).toHaveText('Área do aluno')
 await page.locator('[data-role-context]').click();await expect(page).toHaveURL(/\/(?:meus-cursos|aluno\.html)$/)
 await expect(page.getByText('Matrícula ativa',{exact:true})).toBeVisible()
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)}
})
test('Identidade: convite não é consumido no GET e exige nova senha antes de pedir login',async({page})=>{
 const calls=[]
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;calls.push({path,method:route.request().method()})
  const body=path==='/api/config'?{ok:true,configured:true,qaOnly:true,platformMode:true,platformIdentity:true,salesEnabled:false}:path==='/api/auth/accept'?{ok:true,message:'Senha definida.'}:{ok:false,code:'AUTH_REQUIRED'}
  return route.fulfill({status:path==='/api/account'?401:200,contentType:'application/json',body:JSON.stringify(body)})
 })
 await page.goto('/entrar#token='+'f'.repeat(64)+'&type=invitation')
 await expect(page.getByRole('heading',{name:'Ativar meu acesso'})).toBeVisible()
 expect(calls.some(x=>x.path==='/api/auth/accept')).toBe(false)
 expect(new URL(page.url()).hash).toBe('')
 await page.getByLabel('Nova senha',{exact:true}).fill('SenhaForteDeFixture123')
 await page.locator('[data-verify-form] button').click()
 await expect(page).toHaveURL(/\/entrar\?senha=definida$/)
 expect(calls.filter(x=>x.path==='/api/auth/accept'&&x.method==='POST')).toHaveLength(1)
 await expect(page.getByText('Senha definida. Entre com seu e-mail e a nova senha.',{exact:true})).toBeVisible()
})
test('Identidade: logout continua disponível enquanto o histórico está carregando',async({page})=>{
 let authenticated=true,release
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(path==='/api/config')return json({ok:true,configured:true,qaOnly:true,platformMode:true,platformIdentity:true,salesEnabled:false})
  if(path==='/api/account')return authenticated?json({ok:true,isAdmin:false,account:{id:'fixture',name:'Conta de validação',testAccount:true,entitlements:[]}}):json({ok:false,code:'AUTH_REQUIRED'},401)
  if(path==='/api/student/dashboard'){await new Promise(resolve=>{release=resolve});return json({ok:false,message:'Histórico indisponível.'},503)}
  if(path==='/api/auth/logout'){authenticated=false;return json({ok:true})}
  return json({ok:false},404)
 })
 try{
  await page.goto('/meus-cursos');await expect(page.getByText('Carregando seu programa…')).toBeVisible()
  await page.getByRole('button',{name:'Sair',exact:true}).click()
  await expect(page.locator('[data-login-form]')).toBeVisible();expect(authenticated).toBe(false)
 }finally{release?.()}
})
