'use strict'
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const output = path.resolve(__dirname,'../output')
const gallery = '/codex-redesign-completo/comparativos/index.html'
const types = {'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.webm':'video/webm','.png':'image/png'}
const allowed = [
  /^\/codex-redesign-completo\/screenshots\/(?:desktop|mobile)\/[\w-]+\.png$/,
  /^\/codex-redesign-completo\/qa\/(?:validacao\.json|[\w-]+-(?:desktop|mobile)-inteira\.png)$/,
  /^\/codex-redesign-completo\/videos\/(?:percurso|acessos-e-publico|aluno-player-e-suporte|administracao|checkout-e-rotas-locais)\.webm$/,
  /^\/rv30-redesign-final\/screenshots\/(?:desktop|mobile)\/[\w-]+-full\.png$/
]
http.createServer((req,res)=>{
  const name = new URL(req.url,'http://127.0.0.1').pathname
  if (name === '/') {res.writeHead(302,{Location:gallery});res.end();return}
  if (!['GET','HEAD'].includes(req.method) || (name!==gallery && !allowed.some(pattern=>pattern.test(name)))) {
    res.writeHead(404);res.end();return
  }
  const file = path.join(output,name)
  fs.stat(file,(err,stat)=>{
    if (err || !stat.isFile()) {res.writeHead(404);res.end();return}
    const headers = {'Content-Type':types[path.extname(file)],'Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}
    const bounds={}
    let status=200
    if(file.endsWith('.webm')){
      headers['Accept-Ranges']='bytes'
      if(req.headers.range){
        const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range)
        bounds.start=match?Number(match[1]):NaN
        bounds.end=match && match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1
        if(!Number.isSafeInteger(bounds.start)||bounds.start<0||bounds.end<bounds.start){
          res.writeHead(416,{'Content-Range':'bytes */'+stat.size});res.end();return
        }
        headers['Content-Range']='bytes '+bounds.start+'-'+bounds.end+'/'+stat.size
        headers['Content-Length']=bounds.end-bounds.start+1
        status=206
      }
    }
    res.writeHead(status,headers)
    if (req.method==='HEAD') return res.end()
    const stream=fs.createReadStream(file,bounds)
    res.on('close',()=>stream.destroy())
    stream.on('error',()=>res.destroy())
    stream.pipe(res)
  })
}).listen(18422,'127.0.0.1')

