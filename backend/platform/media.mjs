import {fail,rateLimit,requireAdmin} from './auth.mjs'
import {text,audit,adminWrite} from './admin-common.mjs'
export const PART_BYTES=5*1024*1024,MAX_VIDEO_BYTES=2*1024*1024*1024
const ascii=(bytes,start,count)=>String.fromCharCode(...bytes.subarray(start,start+count))
// Parse bounded MP4 metadata, not executable data or client supplied durations.
// Uploads must have faststart and H.264/AAC; decoding/editorial review remains explicit.
export function inspectMP4(buffer,totalBytes){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),boxes=(start,end,allowPartial=false)=>{
  const result=[];let cursor=start
  while(cursor+8<=end){let size=view.getUint32(cursor),header=8;const type=ascii(bytes,cursor+4,4)
   if(size===1){if(cursor+16>end)break;const wide=view.getBigUint64(cursor+8);if(wide>BigInt(Number.MAX_SAFE_INTEGER))fail(400,'MP4_INVALID','O vídeo contém metadados inválidos.');size=Number(wide);header=16}
   if(size===0)size=totalBytes-cursor
   if(size<header||cursor+size>totalBytes)fail(400,'MP4_INVALID','O vídeo contém caixas MP4 inválidas.')
   if(!allowPartial&&cursor+size>end)fail(400,'MP4_INVALID','O vídeo contém metadados incompletos.')
   result.push({type,start:cursor+header,end:cursor+size,complete:cursor+size<=end});if(cursor+size>end)break;cursor+=size
  }
  return result
 }
 const top=boxes(0,bytes.length,true),ftyp=top.find(x=>x.type==='ftyp'),moov=top.find(x=>x.type==='moov'&&x.complete)
 if(!ftyp||ftyp.start!==8||!moov)fail(400,'FASTSTART_REQUIRED','Use MP4 com faststart, metadados iniciais de até 4 MiB e codecs H.264/AAC. Prepare o arquivo antes de enviar.')
 const tracks=[]
 for(const trak of boxes(moov.start,moov.end).filter(x=>x.type==='trak')){
  const children=boxes(trak.start,trak.end),mdia=children.find(x=>x.type==='mdia'),tkhd=children.find(x=>x.type==='tkhd');if(!mdia)continue
  const md=boxes(mdia.start,mdia.end),hdlr=md.find(x=>x.type==='hdlr'),mdhd=md.find(x=>x.type==='mdhd'),minf=md.find(x=>x.type==='minf');if(!hdlr||!mdhd||!minf||hdlr.end-hdlr.start<12)continue
  const handler=ascii(bytes,hdlr.start+8,4),version=bytes[mdhd.start],offset=version===1?20:12
  if(![0,1].includes(version)||mdhd.end<mdhd.start+offset+(version===1?12:8))fail(400,'MP4_INVALID','Duração MP4 inválida.')
  const scale=view.getUint32(mdhd.start+offset),duration=version===1?Number(view.getBigUint64(mdhd.start+offset+4)):view.getUint32(mdhd.start+offset+4)
  const stbl=boxes(minf.start,minf.end).find(x=>x.type==='stbl'),stsd=stbl&&boxes(stbl.start,stbl.end).find(x=>x.type==='stsd');if(!stsd||stsd.end-stsd.start<16)continue
  const codecs=boxes(stsd.start+8,stsd.end).map(x=>x.type)
  const width=tkhd&&tkhd.end-tkhd.start>=8?view.getUint32(tkhd.end-8)/65536:0,height=tkhd&&tkhd.end-tkhd.start>=8?view.getUint32(tkhd.end-4)/65536:0
  tracks.push({handler,codecs,duration:scale?duration/scale:0,width,height})
 }
 const video=tracks.find(x=>x.handler==='vide'),audio=tracks.find(x=>x.handler==='soun')
 if(!video||!video.codecs.length||video.codecs.some(x=>!['avc1','avc3'].includes(x))||!audio||audio.codecs.some(x=>x!=='mp4a')||!audio.codecs.length||audio.duration<=0||video.duration<=0||video.duration>8*3600||video.width<=0||video.height<=0||video.width>4096||video.height>4096)fail(400,'CODEC_UNSUPPORTED','Use vídeo H.264 com áudio AAC, dimensão até 4096 px e duração de até oito horas.')
 return{duration:video.duration,width:video.width,height:video.height,format:'video/mp4'}
}
export function inspectImage(buffer){
 const b=new Uint8Array(buffer),v=new DataView(buffer)
 if(b.length>=45&&[137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)&&ascii(b,12,4)==='IHDR'&&v.getUint32(8)===13){
  const width=v.getUint32(16),height=v.getUint32(20);let at=8,data=false,ended=false
  while(at+12<=b.length){const size=v.getUint32(at),end=at+12+size;if(end>b.length)break;const type=ascii(b,at+4,4);let crc=0xffffffff
   for(let i=at+4;i<end-4;i++){crc^=b[i];for(let j=0;j<8;j++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}
   if(((crc^0xffffffff)>>>0)!==v.getUint32(end-4))fail(400,'IMAGE_INVALID','A capa PNG está corrompida.')
   if(type==='IDAT'&&size>0)data=true;if(type==='IEND'){ended=size===0&&end===b.length;break}at=end
  }
  if(data&&ended&&width>0&&height>0&&width<=6000&&height<=6000)return{width,height,format:'image/png',duration:null}
 }
 if(b[0]===255&&b[1]===216&&b.at(-2)===255&&b.at(-1)===217){let at=2,dimensions=null;while(at+4<b.length){if(b[at]!==255)break;const marker=b[at+1],size=v.getUint16(at+2);if(size<2||at+2+size>b.length)break;if([192,193,194].includes(marker)&&size>=7){const height=v.getUint16(at+5),width=v.getUint16(at+7);if(width>0&&height>0&&width<=6000&&height<=6000)dimensions={width,height,format:'image/jpeg',duration:null}}if(marker===218&&dimensions)return dimensions;at+=size+2}}
 fail(400,'IMAGE_INVALID','Use uma capa PNG ou JPEG válida, até 6000 px e 5 MiB. SVG não é aceito.')
}
export async function boundedBody(request,maximum){
 const reader=request.body?.getReader();if(!reader)fail(400,'UPLOAD_EMPTY','Selecione um arquivo.')
 const chunks=[];let length=0
 for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maximum){await reader.cancel();fail(413,'UPLOAD_TOO_LARGE','O bloco enviado excede o limite.')}chunks.push(value)}
 const result=new Uint8Array(length);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length}return result.buffer
}
export async function mediaList(env){
 const rows=await env.QA_DB.prepare('select id,kind,label,state,bytes,duration,width,height,format,created_at,reviewed_at from media_records order by created_at desc,id limit 300').all()
 return{ok:true,media:rows.results,limit:300,partBytes:PART_BYTES,maxVideoBytes:MAX_VIDEO_BYTES}
}
export async function uploadBegin(env,session,input,now){
 await adminWrite(env,session,now);await rateLimit(env,'media-new:'+session.user.id,10,now,86400000)
 const bytes=input.bytes,label=text(input.label,'o nome da mídia',160,true),kind=input.kind
 if(!['video','image'].includes(kind)||!Number.isInteger(bytes)||bytes<1||bytes>(kind==='image'?PART_BYTES:MAX_VIDEO_BYTES))fail(400,'UPLOAD_SIZE','Use vídeo até 2 GiB ou imagem até 5 MiB.')
 const quota=await env.QA_DB.prepare("select count(*) as active,coalesce(sum(expected_bytes),0) as bytes from media_uploads where owner_id=? and created_at>? and state!='aborted'").bind(session.user.id,now-86400000).first()
 if(quota.bytes+bytes>4*1024*1024*1024)fail(429,'UPLOAD_QUOTA','O limite diário de envio é 4 GiB por administrador.')
 const opened=await env.QA_DB.prepare("select count(*) as n from media_uploads where owner_id=? and state='open' and expires_at>?").bind(session.user.id,now).first();if(opened.n>=3)fail(409,'UPLOAD_ACTIVE','Conclua ou cancele os envios anteriores.')
 const id=crypto.randomUUID(),key=`rv30/uploads/${id}.${kind==='video'?'mp4':'image'}`,upload=await env.VIDEOS.createMultipartUpload(key,{httpMetadata:{contentType:kind==='video'?'video/mp4':'application/octet-stream'}})
 try{await env.QA_DB.batch([env.QA_DB.prepare("insert into media_uploads(id,owner_id,object_key,upload_id,kind,label,expected_bytes,state,created_at,expires_at) values(?,?,?,?,?,?,?,'open',?,?)").bind(id,session.user.id,key,upload.uploadId,kind,label,bytes,now,now+86400000),audit(env.QA_DB,session,'media',id,'upload_started',{kind,bytes},now)])}catch(error){await upload.abort();throw error}
 return{ok:true,id,partBytes:PART_BYTES,parts:Math.ceil(bytes/PART_BYTES),expiresAt:new Date(now+86400000).toISOString()}
}
async function ownedUpload(env,session,id,now){
 const row=await env.QA_DB.prepare('select * from media_uploads where id=? and owner_id=?').bind(id,session.user.id).first();if(!row)fail(404,'UPLOAD_NOT_FOUND','Envio não localizado.');if(row.expires_at<=now&&row.state!=='completed')fail(410,'UPLOAD_EXPIRED','O envio expirou. Cancele-o e inicie novamente.');return row
}
export async function uploadPart(env,session,id,number,request,now){
 requireAdmin(session,now,true);await rateLimit(env,'upload-part:'+session.user.id,600,now,60000);const row=await ownedUpload(env,session,id,now)
 if(row.state!=='open')fail(409,'UPLOAD_CLOSED','Este envio não aceita novos blocos.')
 const count=Math.ceil(row.expected_bytes/PART_BYTES);if(!Number.isInteger(number)||number<1||number>count)fail(400,'PART_INVALID','Bloco de envio inválido.')
 const expected=number===count?row.expected_bytes-(count-1)*PART_BYTES:PART_BYTES,body=await boundedBody(request,PART_BYTES)
 if(body.byteLength!==expected)fail(400,'PART_SIZE','O tamanho do bloco não corresponde ao arquivo informado.')
 const part=await env.VIDEOS.resumeMultipartUpload(row.object_key,row.upload_id).uploadPart(number,body),parts=JSON.parse(row.parts);parts[number]={partNumber:part.partNumber,etag:part.etag,bytes:body.byteLength}
 const saved=await env.QA_DB.prepare("update media_uploads set parts=?,revision=revision+1 where id=? and revision=? and state='open'").bind(JSON.stringify(parts),id,row.revision).run()
 if(saved.meta.changes!==1)fail(409,'UPLOAD_CONFLICT','Outro bloco foi salvo. Repita este bloco sequencialmente.')
 return{ok:true,part:number,uploadedBytes:Object.values(parts).reduce((sum,x)=>sum+x.bytes,0)}
}
async function inspectObject(env,row){
 const object=await env.VIDEOS.head(row.object_key);if(!object||object.size!==row.expected_bytes)fail(409,'UPLOAD_INCOMPLETE','O arquivo não foi concluído com o tamanho esperado.')
 const sample=await env.VIDEOS.get(row.object_key,{range:{offset:0,length:Math.min(row.expected_bytes,row.kind==='image'?PART_BYTES:4*1024*1024)}}),buffer=await sample.arrayBuffer()
 return row.kind==='video'?inspectMP4(buffer,row.expected_bytes):inspectImage(buffer)
}
export async function uploadFinish(env,session,id,now){
 await adminWrite(env,session,now);const db=env.QA_DB,row=await ownedUpload(env,session,id,now)
 if(row.state==='completed')return{ok:true,id}
 if(!['open','finalizing'].includes(row.state))fail(409,'UPLOAD_CLOSED','Este envio foi encerrado.')
 if(row.state==='open'){
  const parts=Object.values(JSON.parse(row.parts)).sort((a,b)=>a.partNumber-b.partNumber)
  if(parts.length!==Math.ceil(row.expected_bytes/PART_BYTES)||parts.reduce((sum,x)=>sum+x.bytes,0)!==row.expected_bytes)fail(409,'UPLOAD_INCOMPLETE','Envie todos os blocos antes de concluir.')
  const claim=await db.prepare("update media_uploads set state='finalizing' where id=? and state='open' and revision=?").bind(id,row.revision).run();if(!claim.meta.changes)fail(409,'UPLOAD_CONFLICT','O envio está sendo concluído. Consulte novamente.')
  try{await env.VIDEOS.resumeMultipartUpload(row.object_key,row.upload_id).complete(parts.map(({partNumber,etag})=>({partNumber,etag})))}catch(error){if(!await env.VIDEOS.head(row.object_key))throw error}
 }
 let metadata
 try{metadata=await inspectObject(env,row)}catch(error){if(error.code){await db.batch([db.prepare("update media_uploads set state='failed' where id=?").bind(id),audit(db,session,'media',id,'upload_rejected',{code:error.code},now)])}throw error}
 await db.batch([
  db.prepare("insert into media_records(id,object_key,kind,label,state,bytes,duration,width,height,format,created_by,created_at) values(?,?,?,?,'review',?,?,?,?,?,?,?) on conflict(id) do nothing").bind(id,row.object_key,row.kind,row.label,row.expected_bytes,metadata.duration,metadata.width,metadata.height,metadata.format,session.user.id,now),
  db.prepare("update media_uploads set state='completed' where id=? and state='finalizing'").bind(id),audit(db,session,'media',id,'upload_completed',{state:'review',bytes:row.expected_bytes},now)
 ])
 return{ok:true,id,state:'review',message:'Arquivo privado recebido. Confira a prévia e confirme a revisão antes de associar a uma aula.'}
}
export async function mediaReview(env,session,id,input,now){
 await adminWrite(env,session,now);const row=await env.QA_DB.prepare('select * from media_records where id=?').bind(id).first();if(!row)fail(404,'MEDIA_NOT_FOUND','Mídia não localizada.')
 if(!['ready','rejected'].includes(input.state)||input.reviewed!==true)fail(400,'REVIEW_REQUIRED','Confira a prévia e confirme a revisão.')
 if(input.state==='ready')await inspectObject(env,{...row,expected_bytes:row.bytes})
 await env.QA_DB.batch([env.QA_DB.prepare('update media_records set state=?,reviewed_at=? where id=?').bind(input.state,now,id),audit(env.QA_DB,session,'media',id,'media_reviewed',{state:input.state},now)])
 return{ok:true}
}
export async function uploadCancel(env,session,id,now){
 await adminWrite(env,session,now);const row=await env.QA_DB.prepare('select * from media_uploads where id=? and owner_id=?').bind(id,session.user.id).first();if(!row)fail(404,'UPLOAD_NOT_FOUND','Envio não localizado.')
 if(row.state==='aborted')return{ok:true};if(row.state!=='open')fail(409,'UPLOAD_CLOSED','Somente envios abertos podem ser cancelados.')
 const claim=await env.QA_DB.prepare("update media_uploads set state='aborted' where id=? and state='open'").bind(id).run();if(!claim.meta.changes)fail(409,'UPLOAD_CONFLICT','O envio foi alterado. Reabra a biblioteca.')
 await env.VIDEOS.resumeMultipartUpload(row.object_key,row.upload_id).abort();await audit(env.QA_DB,session,'media',id,'upload_cancelled',{},now).run();return{ok:true}
}
export async function uploadList(env,session){const rows=await env.QA_DB.prepare("select id,label,kind,expected_bytes,parts,state,created_at,expires_at from media_uploads where owner_id=? and state in('open','finalizing') order by created_at desc limit 10").bind(session.user.id).all();return{ok:true,uploads:rows.results.map(x=>({...x,parts:Object.keys(JSON.parse(x.parts)).map(Number)}))}}
export async function privateImage(request,env,id,review=false){
 const row=await env.QA_DB.prepare("select object_key,format,bytes from media_records where id=? and kind='image' and (state='ready' or (?=1 and state='review'))").bind(id,review?1:0).first();if(!row)fail(404,'IMAGE_NOT_FOUND','Capa não localizada.')
 const object=await env.VIDEOS.get(row.object_key);if(!object)fail(404,'IMAGE_NOT_FOUND','Capa não localizada.')
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':row.format,'Content-Length':String(object.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'X-Robots-Tag':'noindex'}})
}
