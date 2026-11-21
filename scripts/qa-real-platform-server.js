'use strict'
// Real-backend harness: wraps the ACTUAL backend/qa/core.mjs Worker (same code that
// serves real QA/homologation previews) behind a plain HTTP server backed by a local,
// throwaway Miniflare D1 + R2 instance. No mocks of /api/**, no real Supabase/R2/Cloudflare
// account involved. Lets a real browser exercise real auth/session/entitlement/media logic.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { Miniflare, convertV4MiniflareOptions } = require('miniflare')
const { root, files } = require('./site-files')

const PORT = Number(process.env.PORT || 8092)
const ORIGIN = `http://127.0.0.1:${PORT}`
const PEPPER = 'p'.repeat(64)

const aliases = {
  '/': '/index.html', '/entrar': '/login.html', '/meus-cursos': '/aluno.html',
  '/curso/rv30': '/area.html', '/admin': '/admin.html', '/admin/entrar': '/admin-login.html',
  '/admin/videos': '/admin-videos.html', '/suporte': '/suporte.html'
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

const SCENARIOS = [
  { id: 'aluno-completo', email: 'aluno.completo@example.test', password: 'TestPassword123!', grant: 'active' },
  { id: 'aluno-sem-matricula', email: 'aluno.semmatricula@example.test', password: 'TestPassword123!', grant: 'none' },
  { id: 'aluno-expirado', email: 'aluno.expirado@example.test', password: 'TestPassword123!', grant: 'expired' },
  { id: 'aluno-revogado', email: 'aluno.revogado@example.test', password: 'TestPassword123!', grant: 'revoked' }
]
const ADMIN = { email: 'admin.preview@example.test', password: 'AdminTestPassword123!' }

async function setup() {
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'qa-real-fixture', modules: true,
    script: 'export default {fetch(){return new Response("fixture")}}',
    compatibilityDate: '2026-10-26', d1Databases: ['QA_DB'], r2Buckets: ['VIDEOS']
  }))
  const db = await mf.getD1Database('QA_DB')
  const bucket = await mf.getR2Bucket('VIDEOS')
  const { createQaHandler, hashPassword } = await import('../backend/qa/core.mjs')
  for (const statement of fs.readFileSync(path.join(__dirname, '../backend/qa/schema.sql'), 'utf8').split(';').filter((x) => x.trim())) {
    await db.prepare(statement).run()
  }
  const now = Date.now()
  for (const scenario of SCENARIOS) {
    const credentials = await hashPassword(scenario.password, PEPPER)
    await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)')
      .bind(scenario.id, scenario.email, 'Aluno Fixture', credentials.salt, credentials.hash, now).run()
    if (scenario.grant === 'none') continue
    const expiresAt = scenario.grant === 'expired' ? now - 86400000 : now + 86400000
    await db.prepare('insert into qa_grants(user_id,source,expires_at,revoked) values(?,?,?,?)')
      .bind(scenario.id, 'owner_validation', expiresAt, scenario.grant === 'revoked' ? 1 : 0).run()
  }
  const adminCreds = await hashPassword(ADMIN.password, PEPPER, { preview: true })
  await db.prepare('insert into qa_users(id,email,name,password_salt,password_hash,created_at) values(?,?,?,?,?,?)')
    .bind('admin-fixture', ADMIN.email, 'Administrador Fixture', adminCreds.salt, adminCreds.hash, now).run()

  const manifest = []
  for (let day = 1; day <= 29; day++) {
    const key = `rv30/dia-${String(day).padStart(2, '0')}/${crypto.randomBytes(32).toString('hex')}.mp4`
    const bytes = Buffer.from(`fixture-video-day-${day}-`.repeat(64))
    await bucket.put(key, bytes)
    manifest.push({ day, key, bytes: bytes.length, duration: 60 })
  }

  const env = {
    QA_DB: db, VIDEOS: bucket, QA_EMAIL: SCENARIOS[0].email, QA_PASSWORD_PEPPER: PEPPER,
    PUBLIC_SITE_URL: ORIGIN, QA_MEDIA_MANIFEST: JSON.stringify(manifest),
    QA_PREVIEW: 'true', QA_ADMIN_EMAIL: ADMIN.email, PREVIEW_ORIGINS: ORIGIN
  }
  const app = createQaHandler()
  return { app, env, mf }
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
      const request = new Request(ORIGIN + req.url, { method: req.method, headers, body })
      const response = await app.fetch(request, env)
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
    console.log(`QA real-backend fixture: ${ORIGIN}`)
    console.log(`Scenarios: ${SCENARIOS.map((s) => `${s.id}=${s.email}`).join(', ')}, admin=${ADMIN.email}`)
  })
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1 })
module.exports = { SCENARIOS, ADMIN, PORT, ORIGIN }
