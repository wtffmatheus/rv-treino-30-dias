'use strict'
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
;(async()=>{
 const {createReviewHandler}=await import('../backend/review/handler.mjs')
 const app=createReviewHandler({html:'<html>private viewer</html>',css:'body{}',js:'void 0'})
 const item={day:1,key:'rv30/dia-01/'+ 'a'.repeat(64)+'.mp4',bytes:10,duration:12}
 let reads=0
 const bucket={head:async()=>{reads++;return{size:10,httpEtag:'"abc"'}},get:async(key,options)=>{reads++;const data='0123456789';return{size:10,httpEtag:'"abc"',body:options?.range?data.slice(options.range.offset,options.range.offset+options.range.length):data}}}
 const env={ACCESS_AUD:'fixture-audience',ADMIN_EMAIL:'admin@example.test',REVIEW_MEDIA_MANIFEST:JSON.stringify([item]),VIDEOS:bucket}
 const ctx={access:{aud:'fixture-audience',getIdentity:async()=>({email:'admin@example.test'})}}
 const call=(route,headers={},context=ctx,variables=env,method='GET')=>app.fetch(new Request('https://review.example.test'+route,{headers,method}),variables,context)
 for(const route of ['/','/api/lessons','/media/1'])assert.equal((await call(route,{'Cf-Access-Authenticated-User-Email':'admin@example.test','Cf-Access-Jwt-Assertion':'forged'},{})).status,403)
 assert.equal(reads,0,'sem contexto autenticado, nenhum objeto é consultado')
 assert.equal((await call('/media/1',{}, {access:{...ctx.access,aud:'other'}})).status,403)
 assert.equal((await call('/media/1',{}, {access:{...ctx.access,getIdentity:async()=>({email:'student@example.test'})}})).status,403)
 assert.equal((await call('/media/1',{},ctx,{...env,ADMIN_EMAIL:''})).status,403)
 assert.equal(reads,0)
 const catalog=await(await call('/api/lessons')).json()
 assert.equal(catalog.lessons.length,30);assert.equal(catalog.lessons[0].videoPath,'/media/1');assert.equal(catalog.lessons[29].available,false)
 assert(!JSON.stringify(catalog).includes(item.key),'o catálogo não revela a chave privada')
 const full=await call('/media/1');assert.equal(full.status,200);assert.equal(await full.text(),'0123456789');assert.equal(full.headers.get('cache-control'),'private, no-store')
 for(const [range,expected] of [['bytes=2-4','234'],['bytes=-3','789'],['bytes=8-','89']]){const r=await call('/media/1',{Range:range});assert.equal(r.status,206);assert.equal(await r.text(),expected);assert.equal(Number(r.headers.get('content-length')),expected.length)}
 for(const range of ['bytes=11-','bytes=5-2','bytes=0-1,5-6','bytes=-0','bytes=abc'])assert.equal((await call('/media/1',{Range:range})).status,416)
 assert.equal((await call('/media/1',{Range:'bytes=0-1','If-Range':'"old-version"'})).status,200)
 const before=reads;assert.equal((await call('/media/30')).status,404);assert.equal((await call('/media/../secret')).status,404);assert.equal(reads,before)
 const head=await call('/media/1',{},ctx,env,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'')
 assert.equal((await call('/media/1',{},ctx,env,'POST')).status,405)
 assert.equal((await call('/media/1',{},ctx,{...env,REVIEW_MEDIA_MANIFEST:JSON.stringify([{...item,key:'other/private.mp4'}])})).status,503)
 assert.equal((await call('/media/1',{},ctx,{...env,VIDEOS:{head:async()=>({size:1})}})).status,503)
 const html=await call('/');assert.equal(html.status,200);assert.match(html.headers.get('content-security-policy'),/media-src 'self'/)
 new vm.Script(fs.readFileSync(path.join(__dirname,'../backend/review/viewer.js.txt'),'utf8'))
 console.log('Revisão privada: contexto Access, administrador, catálogo sem chaves, streaming, HEAD, ranges, dia ausente e falhas fechadas passaram com fixtures.')
})().catch(e=>{console.error(e);process.exitCode=1})
