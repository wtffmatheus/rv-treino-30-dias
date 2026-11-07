// Player error/authorization UI contracts with fixture APIs and invalid media.
// Actual decoding, audio, seek, ranges and access revocation require staging tests.
const {test,expect}=require('@playwright/test')
async function fixture(page,mode){
 let accounts=0,videoRequests=0
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(path==='/api/config')return json({ok:true,configured:true,platformMode:mode==='revoked',qaOnly:true,salesEnabled:false})
  if(path==='/api/account'){
   if(++accounts>1&&mode==='expired')return json({ok:false,code:'SESSION_INVALID',message:'Sua sessão terminou.'},401)
   return json({ok:true,account:{id:'fixture',name:'Aluno',status:'active',entitlements:['rv30'],testAccount:true},isAdmin:false})
  }
  if(path==='/api/courses/rv30')return json({ok:true,lessons:[{day:1,title:'Dia 1',available:true}],progress:[]})
  if(path==='/api/student/dashboard')return json({ok:true,enrollment:{status:'revoked'}})
  if(path.endsWith('/activity/open'))return json({ok:true,sessionId:'fixture',sequence:0,positionSeconds:0})
  if(path.endsWith('/activity/event'))return json({ok:true})
  if(path.endsWith('/video')){
   videoRequests++
   if(videoRequests>1)return json({ok:false,message:'A conexão com a aula está indisponível.'},503)
   return json({ok:true,url:'/api/courses/rv30/days/1/media'})
  }
  if(path.endsWith('/media'))return route.fulfill({status:200,contentType:'video/mp4',body:'invalid-fixture-media'})
  return json({ok:false},404)
 })
 return()=>videoRequests
}
test('Player: sessão encerrada oferece novo login preservando a aula de destino',async({page})=>{
 await fixture(page,'expired');await page.goto('/curso/rv30?day=1')
 await expect(page.getByRole('alert')).toContainText('Sua sessão terminou')
 await expect(page.getByRole('link',{name:'Entrar novamente'})).toHaveAttribute('href','/entrar?next=%2Fcurso%2Frv30%3Fday%3D1')
 await expect(page.locator('video')).toHaveCount(0)
})
test('Player: matrícula revogada interrompe a mídia e mostra o estado real',async({page})=>{
 await fixture(page,'revoked');await page.goto('/curso/rv30?day=1')
 await expect(page.getByRole('alert')).toContainText('Sua matrícula foi revogada')
 await expect(page.getByRole('link',{name:'Ver minha matrícula'})).toHaveAttribute('href','/meus-cursos')
 await expect(page.locator('video')).toHaveCount(0)
})
test('Player: falha de mídia permite nova tentativa sem repetir solicitações automaticamente',async({page})=>{
 const requests=await fixture(page,'network');await page.goto('/curso/rv30?day=1')
 await expect(page.getByRole('button',{name:'Tentar novamente'})).toBeVisible();expect(requests()).toBe(1)
 await page.getByRole('button',{name:'Tentar novamente'}).click()
 await expect(page.locator('[data-course-video]')).toContainText('A conexão com a aula está indisponível.')
 expect(requests()).toBe(2)
})
