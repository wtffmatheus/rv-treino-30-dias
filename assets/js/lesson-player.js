(() => {
 'use strict'
 const mounted=new WeakMap()
 const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node}
 window.RVLessonPlayer={
  unmount(shell){const current=mounted.get(shell);if(current){mounted.delete(shell);current.dispose()}},
  mount(shell,{url,title,day,onRetry}){
   this.unmount(shell)
   const video=element('video'),status=element('p','Preparando o vídeo…'),controller={dispose}
   const listeners=[];let failed=false,timer
   video.controls=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-label',title)
   status.className='lesson-player-status';status.setAttribute('role','status')
   shell.replaceChildren(video,status);shell.setAttribute('aria-busy','true');mounted.set(shell,controller)
   const listen=(event,handler)=>{listeners.push([event,handler]);video.addEventListener(event,handler)}
   const ready=()=>{if(!failed){status.hidden=true;shell.setAttribute('aria-busy','false')}}
   const waiting=()=>{if(!failed){status.hidden=false;status.textContent=navigator.onLine?'Carregando o vídeo…':'Conexão interrompida. Aguardando a rede…';shell.setAttribute('aria-busy','true')}}
   function release(){const saved=window.RVLessonActivity?.detach();Promise.resolve(saved).finally(()=>{video.removeAttribute('src');video.load()})}
   function dispose(){clearInterval(timer);for(const [event,handler]of listeners)video.removeEventListener(event,handler);video.pause();release();shell.removeAttribute('aria-busy')}
   async function failure(){
    if(failed||mounted.get(shell)!==controller)return
    failed=true;clearInterval(timer);video.pause();window.RVLessonActivity?.detach()
    const access=await window.RVApi.request(window.RVApi.platformMode?'/api/student/dashboard':'/api/account')
    if(mounted.get(shell)!==controller)return
    const login=!access.ok&&['AUTH_REQUIRED','SESSION_INVALID','ACCOUNT_BLOCKED'].includes(access.code)
    const enrollment=access.enrollment?.status
    const denied=access.ok&&(enrollment&&enrollment!=='active'||access.account&&!access.account.entitlements?.includes('rv30'))
    const box=element('div');box.className='course-video-placeholder lesson-player-error';box.setAttribute('role','alert')
    box.append(element('strong',login?'Sua sessão terminou':denied?'Acesso à aula indisponível':'Não foi possível carregar o vídeo.'))
    const message=login?'Entre novamente para continuar de onde parou.':enrollment==='revoked'?'Sua matrícula foi revogada. Consulte a equipe pelo suporte.':enrollment==='expired'?'Seu prazo de acesso terminou. Consulte sua matrícula em Meus cursos.':denied?'Esta conta não tem matrícula ativa para esta aula.':'Confira sua conexão e tente carregar a aula novamente. Sua última posição registrada permanece salva.'
    box.append(element('small',message))
    if(login||denied){const link=element('a',login?'Entrar novamente':'Ver minha matrícula');link.className='button button--primary';link.href=login?'/entrar?next='+encodeURIComponent('/curso/rv30?day='+day):'/meus-cursos';box.append(link)}
    else{const retry=element('button','Tentar novamente');retry.type='button';retry.className='button button--primary';retry.addEventListener('click',onRetry,{once:true});box.append(retry)}
    for(const [event,handler]of listeners)video.removeEventListener(event,handler)
    release();shell.setAttribute('aria-busy','false');shell.replaceChildren(box)
   }
   listen('loadeddata',ready);listen('canplay',ready);listen('playing',ready);listen('pause',()=>{if(video.readyState>=2)ready()});listen('waiting',waiting);listen('stalled',waiting);listen('error',failure)
   timer=setInterval(async()=>{
    if(failed||video.paused)return
    const access=await window.RVApi.request('/api/account')
    if(access.ok&&!access.account?.entitlements?.includes('rv30')||!access.ok&&['AUTH_REQUIRED','SESSION_INVALID','ACCOUNT_BLOCKED'].includes(access.code))await failure()
   },30000)
   video.src=url;window.RVLessonActivity?.mount(video,day)
   return video
  }
 }
})()
