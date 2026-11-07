// Frontend contract checks with fixture API responses. Live D1/player validation
// is recorded separately; these tests do not claim remote service coverage.
const {test,expect}=require('@playwright/test')
async function fixture(page,{failure=false,revoked=false}={}){
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(path==='/api/config')return json({ok:true,configured:true,qaOnly:true,platformMode:true,salesEnabled:false})
  if(path==='/api/account')return json({ok:true,account:{id:'fixture',name:'Aluno <script>teste</script>',email:'fixture@example.test',status:'active',entitlements:revoked?[]:['rv30'],testAccount:true},isAdmin:false})
  if(path==='/api/student/dashboard')return failure?json({ok:false,message:'Não foi possível carregar seu histórico.'},503):json({ok:true,course:{title:'Curso <img src=x>',totalDays:30},enrollment:{status:revoked?'revoked':'active',source:'owner_validation',startsAt:'2026-11-07T15:00:00Z',expiresAt:'2027-11-07T15:00:00Z'},progress:{completedDays:2,percent:7},activity:{validatedSeconds:75,lastLessonDay:15,lastActivityAt:'2026-11-07T16:00:00Z'},resume:revoked?null:{day:15,positionSeconds:45},history:[{day:15,completed:false,lastOpenedAt:'2026-11-07T16:00:00Z'}],upcoming:[16,17,18],messages:[{kind:'pending',text:'O dia 30 aguarda o arquivo.'},{kind:'privacy',text:'A página em segundo plano não soma tempo de atividade.'}]})
  return json({ok:false},404)
 })
}
test('Contrato do dashboard: dados do servidor, retomada, privacidade e texto sem HTML executável',async({page})=>{
 await fixture(page);await page.goto('/meus-cursos')
 await expect(page.getByRole('heading',{name:'Curso <img src=x>'})).toBeVisible()
 await expect(page.getByText('1 min 15 s',{exact:true})).toBeVisible()
 await expect(page.getByText('2 de 30 aulas concluídas · 7%',{exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:'Continuar de onde parei'})).toHaveAttribute('href','/curso/rv30?day=15')
 await expect(page.locator('.student-program-heading img')).toHaveCount(1)
 await page.getByText('Como registramos sua atividade',{exact:true}).click()
 await expect(page.getByText('A página em segundo plano não soma tempo de atividade.')).toBeVisible()
 for(const width of [320,375,390,430,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }
})
test('Contrato do dashboard: acesso revogado não oferece continuar aula',async({page})=>{
 await fixture(page,{revoked:true});await page.goto('/meus-cursos')
 await expect(page.getByText('Acesso revogado',{exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:'Continuar de onde parei'})).toHaveCount(0)
})
test('Contrato do dashboard: falha de API mostra erro acessível, sem indicadores inventados',async({page})=>{
 await fixture(page,{failure:true});await page.goto('/meus-cursos')
 await expect(page.getByRole('alert')).toHaveText('Não foi possível carregar seu histórico.')
 await expect(page.locator('.student-activity-summary')).toHaveCount(0)
 await expect(page.locator('[data-course-list]')).toHaveAttribute('aria-busy','false')
})
test('Cabeçalho mobile comporta ações extras de teste e fonte alternativa sem cortar controles',async({page})=>{
 await page.goto('/curso/rv30?demo=1')
 await expect(page.locator('[data-reset-demo]')).toBeVisible()
 await page.locator('body').evaluate(el=>el.style.fontFamily='Arial, sans-serif')
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  for(const control of await page.locator('.course-header-actions .button').all()){
   const rect=await control.boundingBox();expect(rect.x+rect.width).toBeLessThanOrEqual(width+1)
  }
 }
})
