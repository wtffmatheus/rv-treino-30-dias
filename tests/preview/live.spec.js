// No request interception, simulated API or payment writes in this suite.
const {test,expect}=require('@playwright/test')
test('preview real: configuração, recursos e identidade renderizada',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto('/')
 await expect(page.locator('#hero-title')).toBeVisible()
 const config=await page.evaluate(async()=>{const response=await fetch('/api/config');return{status:response.status,body:await response.json()}})
 expect(config.status).toBe(200);expect(config.body.configured).toBe(true)
 expect(config.body.salesEnabled).toBe(false)
 expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(11, 29, 38)')
 expect(await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#27c6bd')
 await page.locator('body').evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>{image.loading='eager';return image.decode().catch(()=>{})}))})
 expect(await page.locator('img').evaluateAll(images=>images.filter(image=>image.naturalWidth===0).length)).toBe(0)
 expect(errors).toEqual([])
})
test('preview real autenticado: dashboard coerente com dados persistidos',async({page})=>{
 test.skip(!process.env.QA_STORAGE_STATE,'Exige sessão privada autorizada; não comprova autenticação sem ela.')
 await page.goto('/meus-cursos')
 const result=await page.evaluate(async()=>{const response=await fetch('/api/student/dashboard');return{status:response.status,body:await response.json()}})
 expect(result.status).toBe(200);expect(result.body.ok).toBe(true)
 await expect(page.locator('.student-program h3')).toHaveText(result.body.course.title)
 await expect(page.locator('.student-progress-caption')).toHaveText(`${result.body.progress.completedDays} de 30 aulas concluídas · ${result.body.progress.percent}%`)
 expect(await page.locator('.student-history-list li').count()).toBe(result.body.history.length)
 for(const width of [320,375,390,430,768,1024,1366,1440,1920]){
  await page.setViewportSize({width,height:900})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
 }
})
