'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ctx = { window: {} }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/cardio.js'), 'utf8'), ctx)
const { calculate, compare } = ctx.window.RVCardio
const sedentary = calculate({ age: 30, resting: 86, maxMeasured: 187, level: 'sedentario' })
assert.equal(sedentary.lower, 137)
assert.equal(sedentary.upper, 157)
const trained = calculate({ age: 28, resting: 62, maxMeasured: 194, level: 'treinado' })
assert.equal(trained.lower, 141)
assert.equal(trained.upper, 168)
const estimated = calculate({ age: 40, resting: 70, maxMeasured: '', level: 'sedentario' })
assert.equal(estimated.max, 180)
assert.equal(estimated.measured, false)
assert.equal(estimated.lower, 125)
assert.equal(estimated.upper, 147)
assert.equal(compare(124, estimated), 'abaixo')
assert.equal(compare(125, estimated), 'dentro')
assert.equal(compare(147, estimated), 'dentro')
assert.equal(compare(148, estimated), 'acima')
for (const bad of [
 { age: '', resting: 65, level: 'sedentario' },
 { age: 12, resting: 65, level: 'sedentario' },
 { age: 40, resting: 0, level: 'treinado' },
 { age: 40, resting: 90, maxMeasured: 95, level: 'treinado' },
 { age: 40, resting: 65, maxMeasured: 'abc', level: 'atleta' },
 { age: 40, resting: 65, level: 'cardiopata' }
]) assert.throws(() => calculate(bad))
assert.throws(() => compare('', estimated))
assert.throws(() => compare(260, estimated))
console.log('Cardio: exemplos de Karvonen, validacao e comparacao OK.')
