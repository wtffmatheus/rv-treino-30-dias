'use strict'
const {chromium, expect} = require('@playwright/test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const {PASSWORD} = require('./qa-platform-repro-server')
// Defaults keep the original run; QA_OUT_DIR/QA_PLATFORM_URL/QA_DEMO_URL isolate a new run without overwriting it.
const root = process.env.QA_OUT_DIR ? path.resolve(process.env.QA_OUT_DIR) : path.resolve(__dirname,'../output/codex-redesign-completo')
const platform=process.env.QA_PLATFORM_URL||'http://127.0.0.1:18421', demo=process.env.QA_DEMO_URL||'http://127.0.0.1:18420'
const sizes=[[1440,900],[390,844],[320,700],[375,812],[430,932],[768,1024],[1024,768],[1280,800],[1366,768],[1536,864],[1920,1080]]
const checks=[], issues=[], shots=[], motions=[], preferences=[], playback=[]
const mediaSessions=new WeakMap()
const expectedHttp=new Set(['/api/account','/api/admin/metrics'])
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function login(context,email){
  const res=await context.request.post(platform+'/api/auth/login',{headers:{Origin:platform},data:{email,password:PASSWORD}})
  assert.equal(res.status(),200,'Login da fixture')
}
async function context(browser,role,video){
  const c=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',...(video?{recordVideo:{dir:path.join(root,'videos'),size:{width:1440,height:900}}}:{})})
  await c.route('**/*',r=>{
    const url=new URL(r.request().url())
    if (url.origin===demo && url.pathname==='/api/config') return r.fulfill({json:{ok:true,configured:false,salesEnabled:false}})
    if (![platform,demo].includes(url.origin) || (url.origin===demo && url.pathname.startsWith('/api/'))) return r.abort()
    return r.continue()
  })
  if(role)await login(c,role==='admin'?'equipe@example.test':role==='revoked'?'revoked@example.test':'golden@example.test')
  const p=await c.newPage();p.setDefaultTimeout(5000)
  const cdp=await c.newCDPSession(p)
  mediaSessions.set(p,cdp)
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'no-preference'}]})
  p.on('pageerror',e=>issues.push({page:new URL(p.url()).pathname,error:e.message}))
  p.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('Failed to load resource'))issues.push({page:new URL(p.url()).pathname,error:msg.text()})})
  p.on('response',r=>{const pathname=new URL(r.url()).pathname;if(r.status()>=400&&!(r.status()===401&&expectedHttp.has(pathname)))issues.push({page:new URL(p.url()).pathname,http:r.status(),pathname})})
  await p.addInitScript(()=>{window.studioMotion=[];document.addEventListener('animationstart',e=>window.studioMotion.push(e.animationName))})
  return {c,p,cdp}
}
async function screen(p,id,url,ready,selector){
  if(process.env.RV_QA_ONLY && !id.includes(process.env.RV_QA_ONLY))return
  await p.setViewportSize({width:1440,height:900})
  if(url)await p.goto(url)
  await p.locator(ready).first().waitFor({state:'visible'})
  await p.evaluate(()=>document.fonts.ready)
  if(['player','admin-revisao-midia'].includes(id)){
    const video=p.locator('video').first()
    await video.evaluate(async el=>{el.muted=true;await el.play()})
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(.25)
    await video.evaluate(el=>el.pause())
  }
  for(const [width,height] of sizes){
    await p.setViewportSize({width,height})
    if(selector)await p.locator(selector).first().evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}))
    else await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}))
    const label=width===1440?'desktop':width===390?'mobile':null
    if(label){
      await pause(420)
      const file='screenshots/'+label+'/'+id+'.png'
      await p.screenshot({path:path.join(root,file)})
      shots.push({id,label,file})
      await p.screenshot({path:path.join(root,'qa',id+'-'+label+'-inteira.png'),fullPage:true})
    }
    if([390,768,1366,1440,1920].includes(width)){
      const dir=path.resolve(root,'../qa-previews/codex-completo',String(width))
      fs.mkdirSync(dir,{recursive:true})
      const file=path.join(dir,id+'.png')
      if(label)fs.copyFileSync(path.join(root,'screenshots',label,id+'.png'),file)
      else await p.screenshot({path:file})
    }
    const result=await p.evaluate(()=>{
      const rect=document.documentElement
      const clipping=[...document.querySelectorAll('input,select,textarea,button,a')].filter(el=>{
        if(!el.getClientRects().length||el.closest('[inert],[aria-hidden=true]')||el.matches('.skip-link'))return false
        const box=el.getBoundingClientRect()
        if(box.bottom<0||box.top>innerHeight||box.width<=1||el.closest('.admin-table-wrap,.platform-table-wrap'))return false
        return box.right>innerWidth+1 || box.left < -1
      }).slice(0,5).map(el=>el.tagName+'.'+el.className)
      const obscured=[...document.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],summary')].filter(el=>{
        if(el.closest('[inert],[aria-hidden=true]')||el.matches('.skip-link')||getComputedStyle(el).visibility!=='visible')return false
        const dialog=document.querySelector('dialog[open]')
        if(dialog&&!dialog.contains(el))return false
        const box=el.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2
        if(box.width<10||box.height<10||x<0||x>=innerWidth||y<0||y>=innerHeight)return false
        const top=document.elementFromPoint(x,y)
        return top&&!el.contains(top)&&!top.contains(el)&&['fixed','sticky'].includes(getComputedStyle(top).position)
      }).map(el=>el.tagName+'.'+el.className)
      return {overflow:rect.scrollWidth-innerWidth,clipping,obscured,bg:getComputedStyle(document.body).backgroundColor,
        broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src'))}
    })
    checks.push({id,width,...result})
    if(result.overflow>1||result.clipping.length||result.broken.length||result.obscured.length)issues.push({id,width,...result})
  }
  const emulation=mediaSessions.get(p)
  await emulation.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]})
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const prefs=await p.evaluate(()=>({running:document.getAnimations().filter(a=>a.playState==='running').length,
    activeEffects:document.getAnimations().filter(a=>a.playState==='running').map(a=>({kind:a.constructor.name,name:a.animationName||a.transitionProperty||'',element:a.effect?.target?.tagName||''})),
    blurred:[...document.querySelectorAll('.glass')].some(el=>getComputedStyle(el).backdropFilter!=='none')}))
  preferences.push({id,...prefs});if(prefs.running||prefs.blurred)issues.push({id,...prefs})
  await emulation.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'},{name:'prefers-reduced-transparency',value:'no-preference'}]})
  motions.push({id,events:await p.evaluate(()=>[...new Set(window.studioMotion)])})
}
async function stop(c,p,file){
  const video=p.video();await c.close();if(video){await video.saveAs(path.join(root,'videos',file+'.webm'));await video.delete()}
}
async function publicPages(b){
  const {c,p,cdp}=await context(b,null,true)
  await screen(p,'landing',platform+'/','#hero-title')
  await p.locator('#proposta').scrollIntoViewIfNeeded();await pause(350);await p.locator('summary').first().click()
  await screen(p,'login-aluno',platform+'/entrar','[data-login-form]')
  await screen(p,'login-equipe',platform+'/admin/entrar','[data-admin-login-form]')
  await screen(p,'checkout-fechado',platform+'/checkout/rv30','.checkout-card')
  await screen(p,'privacidade',platform+'/privacidade','.legal-shell')
  await screen(p,'termos',platform+'/termos','.legal-shell')
  await screen(p,'404',platform+'/404.html','.error-card')
  assert.equal((await c.request.get(platform+'/pagina-ausente-rv30')).status(),404)
  await p.goto(platform+'/entrar')
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'},{name:'prefers-reduced-motion',value:'reduce'}]})
  assert.equal(await p.locator('.glass').evaluate(e=>getComputedStyle(e).backdropFilter),'none')
  await stop(c,p,'acessos-e-publico')
}
async function emailForms(b){
  const {c,p}=await context(b)
  // Alternate configuration of the same login. Only read-only configuration is replaced.
  await p.route(platform+'/api/config',r=>r.fulfill({json:{ok:true,configured:true,salesEnabled:false}}))
  await p.goto(platform+'/entrar')
  for(const [id,form] of [['cadastro-publico','signup']]){
    const details=p.locator('details').filter({has:p.locator('[data-'+form+'-form]')})
    await details.locator('summary').click()
    await screen(p,id,null,'[data-'+form+'-form]','[data-'+form+'-form]')
    await details.locator('summary').click()
  }
  await c.close()
}
async function studentPages(b){
  const {c,p,cdp}=await context(b,'student',true)
  const denied=await c.request.get(platform+'/api/admin/metrics');assert.equal(denied.status(),403)
  for(const day of [1,15,25,29]){
    await p.goto(platform+'/curso/rv30?day='+day)
    const v=p.locator('video')
    await v.waitFor()
    await expect(p.locator('[data-activity-status]')).toContainText(/Aula aberta|salvo no servidor/)
    await v.evaluate(async el=>{el.muted=true;await el.play()})
    await expect.poll(()=>v.evaluate(el=>el.currentTime)).toBeGreaterThan(.15)
    await expect.poll(()=>v.evaluate(el=>el.webkitAudioDecodedByteCount)).toBeGreaterThan(0)
    await v.evaluate(el=>el.pause())
    const seekSaved=p.waitForResponse(res=>res.url().endsWith('/activity/event') && res.request().postDataJSON()?.event==='seek' && res.request().postDataJSON()?.positionSeconds>=1.2 && res.ok())
    await v.evaluate(el=>{el.currentTime=1.4})
    await seekSaved
    await p.reload()
    await expect.poll(()=>v.evaluate(el=>el.currentTime)).toBeCloseTo(1.4,1)
    const range=await c.request.get(platform+'/api/courses/rv30/days/'+day+'/media',{headers:{Range:'bytes=0-63'}})
    assert.equal(range.status(),206)
    playback.push({day,range:range.status(),resumedAt:await v.evaluate(el=>el.currentTime),audioDecoded:true})
    if(day===1){
      const done=p.locator('[data-complete]')
      if(await done.getAttribute('aria-pressed')!=='true')await done.click()
      await expect(done).toHaveAttribute('aria-pressed','true')
    }
  }
  await screen(p,'dashboard-aluno',platform+'/meus-cursos','.student-program')
  await screen(p,'jornada',null,'.student-plan','.student-plan')
  await screen(p,'historico',null,'.student-history','.student-history')
  await screen(p,'meus-cursos',platform+'/meus-cursos','[data-my-courses] article','[data-my-courses]')
  await screen(p,'curso-adicional',platform+'/curso/mobilidade-essencial','.course-lessons li')
  await screen(p,'player',platform+'/curso/rv30?day=15','video')
  await p.setViewportSize({width:1440,height:900})
  await p.locator('[data-tab-trigger=materiais]').click()
  await p.locator('[data-tab-trigger=sobre]').click()
  await p.locator('.course-day-list summary').last().click()
  await screen(p,'calculadora',null,'[data-cardio-form]','#calculadora-cardiaca')
  await p.locator('[name=age]').fill('35');await p.locator('[name=resting]').fill('70');await p.locator('[name=level]').selectOption('treinado')
  await p.locator('[data-cardio-form] button[type=submit]').click();await expect(p.locator('[data-cardio-results]')).toBeVisible()
  await screen(p,'aula-pendente',platform+'/curso/rv30?day=30','.course-video-placeholder')
  assert.equal(await p.locator('video').count(),0)
  await screen(p,'suporte-aluno',platform+'/suporte','.platform-support-page')
  const form=p.locator('form').filter({has:p.locator('[name=subject]')})
  const thread=p.locator('.platform-thread').filter({hasText:'Dúvida de validação local'}).first()
  if(await thread.count())await thread.click()
  else {
    await form.locator('[name=subject]').fill('Dúvida de validação local');await form.locator('[name=body]').fill('Onde encontro o histórico das aulas?')
    await form.locator('button[type=submit]').click()
  }
  await expect(p.locator('.platform-message').first()).toBeVisible()
  await screen(p,'conversa-aluno',null,'.platform-thread-detail','.platform-thread-detail')
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await p.goto(platform+'/meus-cursos');await p.locator('.student-program').waitFor();await pause(50)
  assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0)
  await stop(c,p,'aluno-player-e-suporte')
  const locked=await context(b,'revoked')
  await screen(locked.p,'acesso-revogado',platform+'/meus-cursos','.student-program')
  assert.equal(await locked.p.locator('.student-next-lesson').count(),0)
  const revokedRange=await locked.c.request.get(platform+'/api/courses/rv30/days/1/media',{headers:{Range:'bytes=0-63'}})
  assert.equal(revokedRange.status(),403)
  await locked.c.close()
}
async function adminPages(b){
  const {c,p}=await context(b,'admin',true)
  const views={dashboard:'admin-visao-geral',students:'admin-alunos',courses:'admin-cursos',content:'admin-curso',media:'admin-biblioteca',support:'admin-atendimento',orders:'admin-pedidos',audit:'admin-auditoria'}
  for(const [view,id] of Object.entries(views)){
    await screen(p,id,platform+'/admin?view='+view,'.admin-view[data-view='+view+']')
    await p.setViewportSize({width:1440,height:900})
    if(view==='dashboard'){await p.getByLabel('Período',{exact:true}).selectOption('7');await p.locator('.platform-linechart,.platform-barchart,.platform-empty').first().waitFor()}
    if(view==='students'){
      await p.getByLabel('Nome ou e-mail').fill('golden');await p.getByRole('button',{name:'Buscar',exact:true}).click()
      await p.locator('.platform-table a').first().click();await screen(p,'admin-perfil',null,'.platform-private')
    }
    if(view==='content'){await p.getByLabel('Aula',{exact:true}).selectOption('15');await p.getByRole('button',{name:'Visualizar rascunho'}).click();await screen(p,'admin-previa',null,'dialog[open]','dialog[open]');await p.keyboard.press('Escape')}
    if(view==='media'){
      await p.getByRole('button',{name:'Conferir mídia'}).first().click()
      await screen(p,'admin-revisao-midia',null,'dialog[open]','dialog[open]')
      await p.keyboard.press('Escape')
      await p.getByText('Enviar novo arquivo',{exact:true}).click()
      await screen(p,'admin-envio',null,'input[type=file]','input[type=file]')
    }
    if(view==='support'){await p.locator('.platform-thread').first().click();await screen(p,'admin-conversa',null,'.platform-message','.platform-thread-detail')}
  }
  const guest=await context(b)
  for(const purpose of ['invitation','recovery']){
    const response=await c.request.post(platform+'/api/admin/identity-tokens',{headers:{Origin:platform},data:{userId:'no-enrollment',purpose}})
    assert(response.ok(),'Emissão local de convite')
    const {token}=await response.json()
    await guest.p.goto('about:blank')
    await guest.p.goto(platform+'/entrar#'+new URLSearchParams({token,type:purpose}))
    await guest.p.locator('[data-verify-form]').waitFor()
    assert(!guest.p.url().includes('#'))
    await screen(guest.p,purpose==='recovery'?'recuperacao-privada':'ativacao-privada',null,'[data-verify-form]')
  }
  await guest.c.close()
  await stop(c,p,'administracao')
}
async function demoPages(b){
  const {c,p}=await context(b,null,true)
  await screen(p,'checkout-formulario',demo+'/checkout/rv30','[data-checkout-form]')
  const form=p.locator('[data-checkout-form]')
  await form.locator('[name=name]').fill('Aluno de validação');await form.locator('[name=email]').fill('compra@example.test')
  await form.locator('[name=phone]').fill('11999999999');await form.locator('[name=terms]').check();await form.locator('button').click()
  await p.locator('[data-simulate-payment]').click();await screen(p,'criar-acesso',null,'.auth-card--success')
  const access=p.locator('[data-create-access-form]')
  await access.locator('[name=password]').fill(PASSWORD)
  await access.locator('[name=confirm]').fill(PASSWORD)
  await access.locator('button').click()
  await p.locator('[data-login-form] [name=email]').fill('compra@example.test')
  await p.locator('[data-login-form] [name=password]').fill(PASSWORD)
  await p.locator('[data-login-form] button[type=submit]').click()
  await screen(p,'cursos-demo',null,'[data-course-list] a')
  await screen(p,'suporte-demo-aluno',demo+'/suporte','[data-threads]')
  await p.goto(demo+'/admin/entrar')
  await p.evaluate(async()=>{const config=window.RV_COURSE_CONFIG.demoAdmin;await window.RVCourseStore.adminLogin(config.email,config.password)})
  await screen(p,'admin-demonstracao',demo+'/admin','[data-admin-logout]')
  await screen(p,'revisao-de-videos',demo+'/admin/videos','[data-manifest]')
  await screen(p,'suporte-demo-equipe',demo+'/admin/suporte','[data-threads]')
  await stop(c,p,'checkout-e-rotas-locais')
}
async function main(){
 for(const dir of ['screenshots/desktop','screenshots/mobile','comparativos','videos','qa'])fs.mkdirSync(path.join(root,dir),{recursive:true})
 const b=await chromium.launch()
 try{
   for(const flow of [publicPages,studentPages,adminPages,demoPages,emailForms]){
    try{await flow(b)}catch(e){issues.push({flow:flow.name,error:e.message});console.log(flow.name,e.message.slice(0,260))}
   }
 }finally{
   await b.close()
   fs.writeFileSync(path.join(root,'qa','validacao.json'),JSON.stringify({checks,shots,motions,preferences,playback,issues},null,2))
 }
 console.log(checks.length+' medições, '+shots.length+' capturas, '+issues.length+' ocorrências')
 if(issues.length)process.exitCode=1
}
main().catch(e=>{console.error(e.message);process.exitCode=1})

