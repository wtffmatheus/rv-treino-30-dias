'use strict'
// Generates reviewable PRIVATE SQL only; never connects to a database.
const fs=require('node:fs'),path=require('node:path')
const {validR2Lesson}=require('../backend/server/r2')
const {parseDay}=require('./check-private-videos')
const {privateOutput}=require('./prepare-private-videos')
const sql=value=>"'"+String(value).replaceAll("'","''")+"'"
function buildSQL(manifest,receipt,{publish=false}={}){
  if(manifest?.schemaVersion!==1||manifest.courseId!=='rv30'||!Array.isArray(manifest.items)||!manifest.items.length||manifest.items.length>30||
    receipt?.bucket!=='rv30-videos-private'||receipt.allRemoteChecksPassed!==true||!Array.isArray(receipt.uploaded))throw new Error('Manifesto e recibo remoto verificado são obrigatórios.')
  const seen=new Set(),rows=[]
  for(const item of [...manifest.items].sort((a,b)=>a.day-b.day)){
    const lesson={day:item.day,storage_path:item.objectKey,storage_bytes:item.bytes,storage_etag:item.md5}
    const matches=receipt.uploaded.filter(x=>x.day===item.day)
    const recorded=matches[0]
    if(!validR2Lesson(lesson)||seen.has(item.day)||parseDay(item.sourceName)!==item.day||!Number.isFinite(item.duration)||item.duration<=0||
      !/^[a-f0-9]{64}$/.test(item.sha256||'')||!item.objectKey.endsWith('/'+item.sha256+'.mp4')||matches.length!==1||
      recorded.remoteVerified!==true||recorded.key!==item.objectKey||recorded.bytes!==item.bytes||recorded.sha256!==item.sha256||recorded.md5!==item.md5)
      throw new Error('Versão, dia, tamanho ou recibo divergente; nenhum SQL foi gerado.')
    seen.add(item.day)
    const values=`'r2',${sql(item.objectKey)},${item.bytes},${sql(item.md5)},${item.duration},${publish?'true':'false'}`
    rows.push(`insert into public.rv30_lesson_media_history(product_id,day,previous_row)
select l.product_id,l.day,to_jsonb(l) from public.rv30_lessons l where l.product_id='rv30' and l.day=${item.day}
  and (l.storage_provider,l.storage_path,l.storage_bytes,l.storage_etag,l.duration_seconds,l.is_published)
  is distinct from (${values});
insert into public.rv30_lessons(product_id,day,title,source_filename,storage_provider,storage_path,storage_bytes,storage_etag,duration_seconds,is_published)
values('rv30',${item.day},${sql('Dia '+String(item.day).padStart(2,'0'))},${sql(item.sourceName)},${values})
on conflict(product_id,day) do update set source_filename=excluded.source_filename,storage_provider=excluded.storage_provider,
  storage_path=excluded.storage_path,storage_bytes=excluded.storage_bytes,storage_etag=excluded.storage_etag,
  duration_seconds=excluded.duration_seconds,is_published=excluded.is_published;`)
  }
  const missing=Array.from({length:30},(_,i)=>i+1).filter(day=>!seen.has(day))
  return{count:seen.size,missingDays:missing,publish,sql:`-- PRIVATE: object keys must stay outside Git and the public site.
-- Proposed only. Inspect schema, verify source approval, back up and rehearse in staging.
-- Requires all three rv30 migrations. No users, payments or access rights are modified.
-- Missing days: ${missing.join(', ')||'none'}. Existing titles/descriptions/progress are preserved.
begin;
set local standard_conforming_strings=on;
${rows.join('\n')}
commit;
`}
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),publish=args.includes('--publish'),input=args.filter(x=>x!=='--publish')
  if(input.length!==3)throw new Error('Uso: node scripts/prepare-r2-lesson-import.js MANIFESTO_PRIVADO RECIBO_PRIVADO SAIDA.sql [--publish]')
  const result=buildSQL(JSON.parse(fs.readFileSync(input[0],'utf8').replace(/^\uFEFF/,'')),JSON.parse(fs.readFileSync(input[1],'utf8').replace(/^\uFEFF/,'')),{publish})
  if(path.extname(input[2]).toLowerCase()!=='.sql')throw new Error('Use um arquivo .sql privado.')
  const dir=privateOutput(path.dirname(path.resolve(input[2]))),file=path.join(dir,path.basename(input[2]))
  fs.writeFileSync(file,result.sql,{mode:0o600})
  console.log(JSON.stringify({prepared:result.count,missingDays:result.missingDays,publish:result.publish,databaseChanged:false}))
 }catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={buildSQL}
