'use strict'
const assert=require('node:assert/strict')
const {validate,parseDriveUrl,parseDay}=require('../scripts/check-private-videos')
const full={schemaVersion:1,courseId:'rv30',items:Array.from({length:30},(_,i)=>({name:(i+1)+'.MOV',driveUrl:'https://drive.google.com/file/d/media_test_unique_day_'+(i+1)+'/view',revision:''}))}
const ready=validate(full)
assert.equal(ready.readyForEditorialReview,true)
assert.equal(ready.linked,30)
assert.deepEqual(ready.missingDays,[])
const partial={...full,items:full.items.map((x,i)=>i===29?{...x,driveUrl:''}:x)}
const pending=validate(partial)
assert.equal(pending.readyForEditorialReview,false)
assert.deepEqual(pending.missingDays,[30])
assert.equal(pending.linked,29)
const reused={...full,items:full.items.map((x,i)=>i===1?{...x,driveUrl:full.items[0].driveUrl}:x)}
assert.equal(validate(reused).readyForEditorialReview,false)
assert.equal(validate(reused).linked,28,'as duas associações conflitantes não podem contar como válidas')
assert.deepEqual(validate(reused).missingDays,[1,2])
const invalid={...full,items:full.items.map((x,i)=>i===0?{...x,driveUrl:'https://drive.google.com.evil.test/file/d/x/view'}:x)}
assert.equal(validate(invalid).readyForEditorialReview,false)
assert.equal(parseDriveUrl('javascript:alert(1)'),null)
assert.equal(parseDriveUrl('https://evil@drive.google.com/file/d/real_file_123456/view'),null)
assert.equal(parseDriveUrl('https://drive.google.com/file/d/media_test_unique_day_30/view'),'media_test_unique_day_30')
const logging=JSON.stringify(pending)
assert.equal(logging.includes('drive.google.com'),false)
assert.equal(logging.includes('media_test_unique_day'),false)
const mixed={...full,items:full.items.map((item,index)=>({...item,name:index%4===0?`${index+1} - Mobilidade.mp4`:index%4===1?`dia ${index+1}.webm`:index%4===2?`video aula ${index+1}.m4v`:item.name})).reverse()}
assert.equal(validate(mixed).readyForEditorialReview,true,'mesmos formatos e ordenação numérica do editor')
assert.deepEqual(validate(mixed).linkedDays,Array.from({length:30},(_,index)=>index+1))
const optionalIntro={...mixed,items:[...mixed.items,{name:'0.mp4',driveUrl:'https://drive.google.com/file/d/private_intro_test_unique/view'}]}
assert.equal(validate(optionalIntro).readyForEditorialReview,true,'introdução opcional não altera os30 dias')
assert.equal(validate(optionalIntro).linked,30)
assert.equal(validate(optionalIntro).introLinked,true)
assert.equal(validate({...optionalIntro,items:optionalIntro.items.map(item=>item.name==='0.mp4'?{...item,driveUrl:''}:item)}).readyForEditorialReview,false)
const gap={...full,items:full.items.filter((_,index)=>index!==2)}
assert.equal(validate(gap).linked,29)
assert.deepEqual(validate(gap).missingDays,[3])
assert.equal(validate(gap).linkedDays.includes(12),true,'dia12 não se desloca quando falta dia3')
const ambiguous={...full,items:full.items.map((item,index)=>index===11?{...item,name:'12 - versao 2.mov'}:item)}
assert.deepEqual(validate(ambiguous).missingDays,[12])
assert.equal(validate({...full,items:full.items.map((item,index)=>index===0?{...item,day:2}:item)}).readyForEditorialReview,false)
assert.equal(parseDay('video aula 12 - versao 2.mov'),null)
assert.equal(parseDay('31.mp4'),31)
const emptyTemplate={...full,items:full.items.map(item=>({...item,driveUrl:''}))}
assert.equal(validate(emptyTemplate).linked,0,'nomes do modelo não são vídeos verificados')
assert.equal(validate(emptyTemplate).missingDays.length,30)
console.log('Media private-check: 30 links únicos exigidos, formatos mistos, introdução opcional, lacunas e conflitos contados sem expor IDs.')
