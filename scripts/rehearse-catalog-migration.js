'use strict'
// Rehearses backend/platform/catalog-schema.sql on a LOCAL copy of a D1 export
// (`wrangler d1 export ... --output file.private.sql`). Nothing remote is touched.
// Proves: every existing row and credential is preserved, the migration is
// idempotent, and the real platform handler answers on the migrated copy.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { createHash } = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const backup = process.argv[2]
if (!backup || !fs.existsSync(backup)) { console.error('Uso: node scripts/rehearse-catalog-migration.js <export.private.sql>'); process.exit(2) }
;(async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ name: 'migration-rehearsal', modules: true, script: 'export default {fetch(){return new Response("x")}}', compatibilityDate: '2026-10-26', d1Databases: ['QA_DB'] }))
  try {
    const db = await mf.getD1Database('QA_DB')
    const statements = fs.readFileSync(backup, 'utf8').split(/;\r?\n/).map(x => x.trim()).filter(x => x && !/^PRAGMA/i.test(x))
    for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50).map(sql => db.prepare(sql)))
    const tables = (await db.prepare("select name from sqlite_master where type='table' and name not like '\\_cf%' escape '\\' and name not like 'sqlite%' order by name").all()).results.map(x => x.name)
    const snapshot = async () => { const out = {}; for (const t of tables) out[t] = (await db.prepare(`select count(*) as n from "${t}"`).first()).n; return out }
    const credentials = async () => createHash('sha256').update(JSON.stringify((await db.prepare('select id,password_salt,password_hash,credential_version,status from qa_users order by id').all()).results)).digest('hex')
    const before = await snapshot(), credBefore = await credentials()
    const migration = fs.readFileSync(path.join(__dirname, '../backend/platform/catalog-schema.sql'), 'utf8').replace(/--[^\n]*/g, '').split(';').filter(x => x.trim())
    for (let run = 1; run <= 2; run++) for (const sql of migration) await db.prepare(sql).run()
    const after = await snapshot()
    for (const t of tables) assert.equal(after[t], before[t], `tabela ${t} preservada`)
    assert.equal(await credentials(), credBefore, 'senhas, credential_version e status intactos')
    const courses = (await db.prepare('select id,state,legacy from courses').all()).results
    assert.deepEqual(courses, [{ id: 'rv30', state: 'published', legacy: 1 }], 'somente o RV30 é registrado, publicado e marcado como legado')
    for (const t of ['course_enrollments', 'course_lessons', 'course_progress', 'recovery_codes']) assert.equal((await db.prepare(`select count(*) as n from ${t}`).first()).n, 0, t + ' começa vazia')
    // The real handler on the migrated copy: config and catalog queries succeed.
    const { createPlatformHandler } = await import('../backend/platform/worker.mjs')
    const env = { QA_DB: db, VIDEOS: { head: async () => null }, AUTH_PASSWORD_PEPPER: 'x'.repeat(40), PLATFORM_ENV: 'staging', PLATFORM_ADMIN_ENABLED: 'true', PREVIEW_ORIGINS: 'https://local.test' }
    const config = await (await createPlatformHandler().fetch(new Request('https://local.test/api/config'), env)).json()
    assert.equal(config.ok, true, 'configuração responde no banco migrado')
    const { adminCourses } = await import('../backend/platform/courses.mjs')
    const catalog = await adminCourses(env)
    assert.equal(catalog.courses[0].id, 'rv30')
    console.log(`Ensaio da migração: ${tables.length} tabelas e ${Object.values(before).reduce((a, b) => a + b, 0)} linhas preservadas, credenciais idênticas, migração idempotente (2 execuções), RV30 com ${catalog.courses[0].enrollments} matrícula(s) e ${catalog.courses[0].published_lessons} aula(s) publicada(s).`)
  } finally { await mf.dispose() }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
