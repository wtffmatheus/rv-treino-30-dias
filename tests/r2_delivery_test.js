'use strict'
const assert=require('node:assert/strict'),crypto=require('node:crypto')
const {createR2MediaClient}=require('../backend/server/r2')
const {buildSQL}=require('../scripts/prepare-r2-lesson-import')
const env={R2_ACCOUNT_ID:'a'.repeat(32),R2_BUCKET_NAME:'rv30-videos-private',R2_ACCESS_KEY_ID:'fixtureAccessKey123456',R2_SECRET_ACCESS_KEY:'fixtureSecretKeyNotReal12345678901234567890'}
const now=()=>Date.parse('2026-11-07T12:00:00Z')
const lesson={day:1,storage_path:'rv30/dia-01/'+'b'.repeat(64)+'.mp4',storage_bytes:100,storage_etag:'c'.repeat(32)}
const sign=(key,value)=>crypto.createHmac('sha256',key).update(value).digest()
function checkSignature(input,method){
 const u=new URL(input),signature=u.searchParams.get('X-Amz-Signature');u.searchParams.delete('X-Amz-Signature')
 const query=[...u.searchParams].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')
 const canonical=[method,u.pathname,query,'host:'+u.host+'\n','host','UNSIGNED-PAYLOAD'].join('\n')
 const scope='20261107/auto/s3/aws4_request'
 const stringToSign=['AWS4-HMAC-SHA256','20261107T120000Z',scope,crypto.createHash('sha256').update(canonical).digest('hex')].join('\n')
 const key=sign(sign(sign(sign('AWS4'+env.R2_SECRET_ACCESS_KEY,'20261107'),'auto'),'s3'),'aws4_request')
 assert.equal(signature,sign(key,stringToSign).toString('hex'))
}
;(async()=>{
 const client=createR2MediaClient({env,now})
 assert.equal(client.configured,true)
 for(const patch of [{R2_ACCOUNT_ID:'https://evil.test'},{R2_BUCKET_NAME:'other'},{R2_ACCESS_KEY_ID:''},{R2_SECRET_ACCESS_KEY:''}])assert.equal(createR2MediaClient({env:{...env,...patch}}).configured,false)
 const url=await client.sign(lesson,120);checkSignature(url,'GET')
 assert.equal(new URL(url).searchParams.get('X-Amz-Expires'),'120')
 assert(!url.includes(env.R2_SECRET_ACCESS_KEY))
 assert.equal(new URL(url).hostname,env.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com')
 for(const ttl of [0,121,1.5])await assert.rejects(()=>client.sign(lesson,ttl))
 for(const patch of [{day:2},{storage_path:'../private.mp4'},{storage_bytes:0},{storage_etag:'invalid'}])await assert.rejects(()=>client.sign({...lesson,...patch},30))
 await assert.rejects(()=>client.sign(lesson,30,'PUT'))
 let headURL
 const verified=createR2MediaClient({env,now,fetchImpl:async(url,options)=>{assert.equal(options.method,'HEAD');headURL=url;return{ok:true,headers:new Headers({'Content-Length':'100','Content-Type':'video/mp4',ETag:'"'+lesson.storage_etag+'"'})}}})
 assert.equal(await verified.verify(lesson),true);checkSignature(headURL,'HEAD')
 const wrong=createR2MediaClient({env,now,fetchImpl:async()=>({ok:true,headers:new Headers({'Content-Length':'99','Content-Type':'video/mp4',ETag:'"'+lesson.storage_etag+'"'})})})
 assert.equal(await wrong.verify(lesson),false)
 const failed=createR2MediaClient({env,fetchImpl:async()=>{throw new Error(env.R2_SECRET_ACCESS_KEY)}})
 assert.equal(await failed.verify(lesson),false)
 const item={day:1,sourceName:'1.MOV',objectKey:lesson.storage_path,bytes:100,md5:lesson.storage_etag,sha256:'b'.repeat(64),duration:12.5}
 const receipt={bucket:env.R2_BUCKET_NAME,allRemoteChecksPassed:true,uploaded:[{day:1,key:item.objectKey,bytes:item.bytes,md5:item.md5,sha256:item.sha256,remoteVerified:true}]}
 const manifest={schemaVersion:1,courseId:'rv30',items:[item]}
 const batch=buildSQL(manifest,receipt,{publish:true})
 assert.equal(batch.count,1);assert(batch.missingDays.includes(30));assert(batch.sql.includes('begin;'));assert(batch.sql.includes('rv30_lesson_media_history'))
 assert(!batch.sql.includes('set title='),'título profissional existente deve ser preservado')
 assert.throws(()=>buildSQL({...manifest,items:[item,item]},receipt))
 assert.throws(()=>buildSQL({...manifest,items:[{...item,day:2}]},receipt))
 assert.throws(()=>buildSQL(manifest,{...receipt,allRemoteChecksPassed:false}))
 assert.throws(()=>buildSQL(manifest,{...receipt,uploaded:[{...receipt.uploaded[0],md5:'d'.repeat(32)}]}))
 console.log('R2 compradores: SigV4 conferida por HMAC independente, TTL, HEAD/versão, configuração fechada e geração SQL privada passaram com fixtures; sem credenciais R2 reais.')
})().catch(e=>{console.error(e);process.exitCode=1})
