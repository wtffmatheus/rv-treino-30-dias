'use strict'
const assert=require('node:assert/strict')
const {validate,parseDriveUrl}=require('../scripts/check-private-videos')
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
const invalid={...full,items:full.items.map((x,i)=>i===0?{...x,driveUrl:'https://drive.google.com.evil.test/file/d/x/view'}:x)}
assert.equal(validate(invalid).readyForEditorialReview,false)
assert.equal(parseDriveUrl('javascript:alert(1)'),null)
assert.equal(parseDriveUrl('https://evil@drive.google.com/file/d/real_file_123456/view'),null)
assert.equal(parseDriveUrl('https://drive.google.com/file/d/media_test_unique_day_30/view'),'media_test_unique_day_30')
const logging=JSON.stringify(pending)
assert.equal(logging.includes('drive.google.com'),false)
assert.equal(logging.includes('media_test_unique_day'),false)
console.log('Media private-check: 30 links validos, 29 links pendentes, URLs maliciosas e duplicadas bloqueadas.')
