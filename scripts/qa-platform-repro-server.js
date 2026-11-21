'use strict'
// Real-backend harness for the PLATFORM (multi-student) system: wraps the ACTUAL
// backend/platform/worker.mjs handler (createPlatformHandler) behind a plain HTTP
// server, backed by a local, throwaway Miniflare D1 + R2 instance. No /api/** mocks.
// Built to reproduce, in isolation, the distinct backend states that can make a
// student's videos not appear (missing role, missing/mismatched enrollment, revoked,
// expired) using the real access-control logic in backend/platform/auth.mjs.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { root, files } = require('./site-files')

const PORT = Number(process.env.PORT || 8093)
const ORIGIN = `http://127.0.0.1:${PORT}`
const PEPPER = 'platform-fixture-pepper-'.repeat(2)
const PASSWORD = 'TestPassword123!'

const aliases = {
  '/': '/index.html', '/entrar': '/login.html', '/meus-cursos': '/aluno.html',
  '/curso/rv30': '/area.html', '/admin': '/admin.html', '/admin/entrar': '/admin-login.html'
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

const SCENARIOS = [
  { id: 'golden', email: 'golden@example.test', role: 'student', enrollment: 'active', label: 'matrícula ativa (caminho feliz)' },
  { id: 'no-role', email: 'norole@example.test', role: null, enrollment: 'active', label: 'matrícula ativa mas SEM role=student' },
  { id: 'no-enrollment', email: 'noenroll@example.test', role: 'student', enrollment: null, label: 'role=student mas SEM matrícula em rv30' },
  { id: 'revoked', email: 'revoked@example.test', role: 'student', enrollment: 'revoked', label: 'matrícula revogada' },
  { id: 'expired', email: 'expired@example.test', role: 'student', enrollment: 'expired', label: 'matrícula expirada' }
]

async function setup() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'platform-repro-fixture', modules: true,
    script: 'export default {fetch(){return new Response("fixture")}}',
    compatibilityDate: '2026-10-26', d1Databases: ['QA_DB'], r2Buckets: ['VIDEOS']
  }))
  const db = await mf.getD1Database('QA_DB')
  const bucket = await mf.getR2Bucket('VIDEOS')
  const { createPlatformHandler } = await import('../backend/platform/worker.mjs')
  const { hashPassword } = await import('../backend/qa/core.mjs')
  for (const file of ['backend/qa/schema.sql', 'backend/platform/student-schema.sql', 'backend/platform/identity-schema.sql']) {
    for (const sql of fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split(';').filter((x) => x.trim())) {
      await db.prepare(sql).run()
    }
  }
  const now = Date.now()
  const hash = await hashPassword(PASSWORD, PEPPER)
  for (const s of SCENARIOS) {
    await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)')
      .bind(s.id, s.email, 'Aluno Fixture', hash.salt, hash.hash, now).run()
    await db.prepare("insert into identity_metadata(user_id,kind,verified_at,verification_method) values(?,'validation',?,'owner_provisioned')")
      .bind(s.id, now).run()
    if (s.role) await db.prepare("insert into user_roles(user_id,role,assigned_at) values(?,?,?)").bind(s.id, s.role, now).run()
    if (!s.enrollment) continue
    const starts = s.enrollment === 'scheduled' ? now + 86400000 : s.enrollment === 'expired' ? now - 2 * 86400000 : now
    const expires = s.enrollment === 'expired' ? now - 86400000 : now + 365 * 86400000
    await db.prepare('insert into enrollments(user_id,course_id,source,starts_at,expires_at,updated_at,revoked) values(?,?,?,?,?,?,?)')
      .bind(s.id, 'rv30', 'owner_validation', starts, expires, now, s.enrollment === 'revoked' ? 1 : 0).run()
  }
  const item = { day: 1, key: 'rv30/dia-01/' + 'a'.repeat(64) + '.mp4', bytes: 10, duration: 60 }
  await bucket.put(item.key, '0123456789')
  const env = {
    QA_DB: db, VIDEOS: bucket, AUTH_PASSWORD_PEPPER: PEPPER, PLATFORM_ENV: 'staging',
    PUBLIC_SITE_URL: ORIGIN, PREVIEW_ORIGINS: ORIGIN, QA_MEDIA_MANIFEST: JSON.stringify([item])
  }
  const app = createPlatformHandler()
  return { app, env }
}

async function main() {
  const { app, env } = await setup()
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, String(v))
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = chunks.length ? Buffer.concat(chunks) : undefined
      const response = await app.fetch(new Request(ORIGIN + req.url, { method: req.method, headers, body }), env)
      res.writeHead(response.status, Object.fromEntries(response.headers))
      if (response.body) res.end(Buffer.from(await response.arrayBuffer()))
      else res.end()
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
    const url = new URL(req.url, ORIGIN)
    const route = aliases[url.pathname] || url.pathname
    const name = route.slice(1)
    const allowed = files.includes(name) && !name.startsWith('_')
    const file = path.join(root, allowed ? name : '404.html')
    res.writeHead(allowed ? 200 : 404, { 'Content-Type': types[path.extname(file)] || 'text/plain' })
    if (req.method === 'HEAD') res.end()
    else fs.createReadStream(file).pipe(res)
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Platform repro fixture: ${ORIGIN}`)
    console.log(`Scenarios: ${SCENARIOS.map((s) => `${s.id}=${s.email} (${s.label})`).join(' | ')}`)
    console.log(`Password for all: ${PASSWORD}`)
  })
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1 })
module.exports = { SCENARIOS, PASSWORD, PORT, ORIGIN }
