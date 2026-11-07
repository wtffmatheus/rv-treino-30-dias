const HEADERS={
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()','X-Robots-Tag':'noindex, nofollow, noarchive'
}
function reply(body,status=200,type='text/plain; charset=utf-8',extra={}){return new Response(body,{status,headers:{...HEADERS,'Content-Type':type,...extra}})}
function catalog(env){
  let items
  try{items=JSON.parse(env.REVIEW_MEDIA_MANIFEST||'[]')}catch{return null}
  if(!Array.isArray(items)||!items.length||items.length>30)return null
  const days=new Set(),keys=new Set()
  for(const item of items){
    if(!Number.isInteger(item.day)||item.day<1||item.day>30||days.has(item.day)||keys.has(item.key)||
      !new RegExp(`^rv30/dia-${String(item.day).padStart(2,'0')}/[a-f0-9]{64}\\.mp4$`).test(item.key)||
      !Number.isInteger(item.bytes)||item.bytes<1||!Number.isFinite(item.duration)||item.duration<=0)return null
    days.add(item.day);keys.add(item.key)
  }
  return items
}
export function createReviewHandler({html,css,js,logo,qaHtml,qaJs}){
  return {async fetch(request,env,ctx){
    try{
      // The platform supplies ctx.access after authenticating this invocation.
      // Browser headers, cookies or local storage cannot create this context.
      if(!env.ACCESS_AUD||!env.ADMIN_EMAIL||!ctx.access||ctx.access.aud!==env.ACCESS_AUD)return reply('Autenticação necessária.',403)
      const identity=await ctx.access.getIdentity()
      if(!identity?.email||identity.email.trim().toLowerCase()!==env.ADMIN_EMAIL.trim().toLowerCase())return reply('Acesso restrito à revisão do RV 30.',403)
      const pathname=new URL(request.url).pathname
      if(pathname==='/api/qa/set-password'&&request.method==='POST'){
        if(request.headers.get('origin')!==new URL(request.url).origin)return reply('Origem não autorizada.',403)
        if(!request.headers.get('content-type')?.startsWith('application/json'))return reply('Formulário inválido.',415)
        const reader=request.body?.getReader();let size=0,text=''
        const decoder=new TextDecoder()
        if(reader)for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();return reply('Formulário muito grande.',413)}text+=decoder.decode(part.value,{stream:true})}
        text+=decoder.decode()
        let input;try{input=JSON.parse(text)}catch{return reply('Formulário inválido.',400)}
        if(typeof input?.password!=='string'||input.password.length<12||input.password.length>128)return reply('Use uma senha de 12 a 128 caracteres.',400)
        if(!env.QA_CONTROL)return reply('A conta está sendo preparada.',503)
        await env.QA_CONTROL.setPassword(input.password)
        return reply(JSON.stringify({ok:true,message:'Senha definida. Entre no site com aluno@rv.com.br.'}),200,'application/json; charset=utf-8')
      }
      if(!['GET','HEAD'].includes(request.method))return reply('Método não permitido.',405,undefined,{Allow:'GET, HEAD'})
      if(pathname==='/conta-teste'&&qaHtml)return reply(request.method==='HEAD'?null:qaHtml,200,'text/html; charset=utf-8')
      if(pathname==='/qa-account.js'&&qaJs)return reply(request.method==='HEAD'?null:qaJs,200,'text/javascript; charset=utf-8')
      const url=new URL(request.url),items=catalog(env)
      if(!items||!env.VIDEOS)return reply('Os vídeos estão sendo preparados.',503)
      if(url.pathname==='/'||url.pathname==='/revisao')return reply(request.method==='HEAD'?null:html,200,'text/html; charset=utf-8')
      if(url.pathname==='/review.css')return reply(request.method==='HEAD'?null:css,200,'text/css; charset=utf-8')
      if(url.pathname==='/review.js')return reply(request.method==='HEAD'?null:js,200,'text/javascript; charset=utf-8')
      if(url.pathname==='/rv30-logo.png')return reply(request.method==='HEAD'?null:logo,200,'image/png')
      if(url.pathname==='/api/lessons'){
        const lessons=Array.from({length:30},(_,i)=>{const item=items.find(x=>x.day===i+1);return{day:i+1,title:`Dia ${String(i+1).padStart(2,'0')}`,available:!!item,duration:item?.duration||null,videoPath:item?`/media/${i+1}`:null}})
        return reply(request.method==='HEAD'?null:JSON.stringify({ok:true,mode:'private_review',lessons}),200,'application/json; charset=utf-8')
      }
      const match=url.pathname.match(/^\/media\/([1-9]|[12]\d|30)$/)
      if(!match)return reply('Página não encontrada.',404)
      const item=items.find(x=>x.day===Number(match[1]))
      if(!item)return reply('Este vídeo ainda está pendente.',404)
      return streamVideo(request,env.VIDEOS,item)
    }catch{return reply('Não foi possível carregar este conteúdo. Tente novamente.',503)}
  }}
}
export async function streamVideo(request,bucket,item){
      const head=await bucket.head(item.key)
      if(!head||head.size!==item.bytes)return reply('Vídeo temporariamente indisponível.',503)
      const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Disposition':'inline','ETag':head.httpEtag}
      let range
      const raw=request.headers.get('Range')
      if(raw&&(!request.headers.get('If-Range')||request.headers.get('If-Range')===head.httpEtag)){
        const parts=raw.match(/^bytes=(\d*)-(\d*)$/)
        if(!parts||!parts[1]&&!parts[2])return reply(null,416,undefined,{'Content-Range':`bytes */${head.size}`})
        const start=parts[1]?Number(parts[1]):Math.max(0,head.size-Number(parts[2]))
        const end=parts[1]?(parts[2]?Math.min(Number(parts[2]),head.size-1):head.size-1):head.size-1
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start> end||start>=head.size)return reply(null,416,undefined,{'Content-Range':`bytes */${head.size}`})
        range={offset:start,length:end-start+1}
        headers['Content-Range']=`bytes ${start}-${end}/${head.size}`
      }
      headers['Content-Length']=String(range?range.length:head.size)
      if(request.method==='HEAD')return reply(null,range?206:200,'video/mp4',headers)
      const object=await bucket.get(item.key,range?{range}:undefined)
      if(!object||!object.body||object.size!==item.bytes||object.httpEtag!==head.httpEtag)return reply('Vídeo temporariamente indisponível.',503)
      return reply(object.body,range?206:200,'video/mp4',headers)
}
export {catalog}
