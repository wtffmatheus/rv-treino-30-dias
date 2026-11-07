'use strict'
// Local preparation only. Does not upload, publish lessons or grant access.
const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const {spawn}=require('node:child_process')
const {parseDay}=require('./check-private-videos')
const root=path.resolve(__dirname,'..')
function inventory(names){
  const days=new Map(),rejected=[]
  for(const name of names){
    const day=parseDay(name)
    if(day===null||day<1||day>30){rejected.push(name);continue}
    if(!days.has(day))days.set(day,[])
    days.get(day).push(name)
  }
  const conflicts=[...days].filter(([,names])=>names.length!==1).map(([day])=>day)
  const items=[...days].filter(([,names])=>names.length===1).map(([day,names])=>({day,name:names[0]})).sort((a,b)=>a.day-b.day)
  return{items,rejected,conflicts,missingDays:Array.from({length:30},(_,i)=>i+1).filter(day=>!items.some(item=>item.day===day))}
}
function privateOutput(directory){
  const target=path.resolve(directory),relative=path.relative(root,target)
  if(relative===''||(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)&&relative!=='output'&&!relative.startsWith('output'+path.sep)))throw new Error('Use output/ ou uma pasta fora do repositório para mídia privada.')
  fs.mkdirSync(target,{recursive:true})
  const real=fs.realpathSync(target),realRelative=path.relative(root,real)
  if(realRelative===''||(!realRelative.startsWith('..'+path.sep)&&!path.isAbsolute(realRelative)&&realRelative!=='output'&&!realRelative.startsWith('output'+path.sep)))throw new Error('Destino privado não pode apontar para arquivos publicados.')
  return real
}
async function digest(file,algorithm){
  const hash=crypto.createHash(algorithm)
  for await(const chunk of fs.createReadStream(file))hash.update(chunk)
  return hash.digest('hex')
}
function command(executable,args){
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']})
    let out='',err=''
    child.stdout.on('data',chunk=>{out+=chunk})
    child.stderr.on('data',chunk=>{err=(err+chunk).slice(-4000)})
    child.on('error',reject)
    child.on('close',code=>code===0?resolve(out):reject(new Error('Falha na preparação da mídia: '+err)))
  })
}
async function probe(executable,file){
  const data=JSON.parse(await command(executable,['-v','error','-show_format','-show_streams','-of','json',file]))
  const video=data.streams?.find(s=>s.codec_type==='video'),audio=data.streams?.find(s=>s.codec_type==='audio')
  if(!video||!Number.isFinite(Number(data.format?.duration))||Number(data.format.duration)<=0)throw new Error('Vídeo sem duração válida.')
  return{codec:video.codec_name,pixelFormat:video.pix_fmt,width:video.width,height:video.height,audio:audio?.codec_name||null,duration:Number(data.format.duration)}
}
async function prepare({source,out,ffmpeg,ffprobe,profile='source'}){
  if(!['source','streaming-720p'].includes(profile))throw new Error('Perfil de preparação inválido.')
  const directory=fs.realpathSync(source),destination=privateOutput(out)
  const found=inventory(fs.readdirSync(directory,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name))
  if(found.conflicts.length)throw new Error('Dias com mais de um arquivo: '+found.conflicts.join(', '))
  if(!found.items.length)throw new Error('Nenhum vídeo numerado de 1 a 30 encontrado.')
  const manifest={schemaVersion:1,courseId:'rv30',profile,preparedAt:new Date().toISOString(),sourceVerified:'local_only',editoriallyApproved:false,uploaded:false,items:[],missingDays:found.missingDays,rejectedCount:found.rejected.length}
  const report=path.join(destination,'manifest.private.json')
  for(const entry of found.items){
    const original=path.join(directory,entry.name),before=fs.statSync(original)
    const sourceSha256=await digest(original,'sha256'),sourceInfo=await probe(ffprobe,original)
    const file=path.join(destination,`dia-${String(entry.day).padStart(2,'0')}-${sourceSha256.slice(0,16)}${profile==='streaming-720p'?'-720p':''}.mp4`)
    if(!fs.existsSync(file)){
      const temporary=file+'.partial.mp4'
      // A partial file is never reused as a valid completed video.
      if(fs.existsSync(temporary))throw new Error('Preparação interrompida: mova o arquivo .partial.mp4 antes de retomar.')
      const videoOptions=profile==='streaming-720p'
        ? ['-vf',"scale=w='if(gte(iw,ih),min(1280,iw),min(720,iw))':h=-2",'-preset','fast','-crf','23','-maxrate','2400k','-bufsize','4800k']
        : ['-preset','veryfast','-crf','20']
      await command(ffmpeg,['-nostdin','-hide_banner','-v','error','-n','-i',original,'-map','0:v:0','-map','0:a:0?','-c:v','libx264',...videoOptions,'-pix_fmt','yuv420p','-threads','4','-c:a','aac','-b:a','128k','-movflags','+faststart','-map_metadata','-1',temporary])
      fs.renameSync(temporary,file)
    }
    const info=await probe(ffprobe,file)
    if(info.codec!=='h264'||info.pixelFormat!=='yuv420p'||info.audio&&info.audio!=='aac'||Math.abs(info.duration-sourceInfo.duration)>0.5)throw new Error('Codec ou duração diverge no dia '+entry.day)
    // Decode the entire output, including audio, to catch truncated/corrupt media.
    await command(ffmpeg,['-nostdin','-v','error','-xerror','-i',file,'-map','0:v:0','-map','0:a:0?','-f','null','-'])
    if(await digest(original,'sha256')!==sourceSha256)throw new Error('O original mudou durante a preparação.')
    const sha256=await digest(file,'sha256'),md5=await digest(file,'md5')
    manifest.items.push({day:entry.day,sourceName:entry.name,sourceBytes:before.size,sourceSha256,file,bytes:fs.statSync(file).size,sha256,md5,objectKey:`rv30/dia-${String(entry.day).padStart(2,'0')}/${sha256}.mp4`,...info})
    fs.writeFileSync(report,JSON.stringify(manifest,null,2)+'\n',{mode:0o600})
    console.log(`Dia ${entry.day}: MP4 H.264 validado (${Math.round(info.duration)}s).`)
  }
  console.log(`Preparados ${manifest.items.length}/30; faltam: ${found.missingDays.join(', ')||'nenhum'}. Sem upload ou publicação.`)
  return manifest
}
if(require.main===module){
  const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,i,all)=>i%2?pairs:[...pairs,[value.replace(/^--/,''),all[i+1]]],[]))
  if(!args.source||!args.ffmpeg||!args.ffprobe){console.error('Uso: node scripts/prepare-private-videos.js --source PASTA --ffmpeg EXECUTAVEL --ffprobe EXECUTAVEL [--out output/rv30-media/prepared]');process.exitCode=2}
  else prepare({source:args.source,ffmpeg:args.ffmpeg,ffprobe:args.ffprobe,out:args.out||'output/rv30-media/prepared',profile:args.profile||'source'}).catch(error=>{console.error(error.message);process.exitCode=1})
}
module.exports={inventory,privateOutput,prepare}
