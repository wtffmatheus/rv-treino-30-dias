'use strict'
// One-off documentation reorganization (2026-11-22). Uses `git mv` so history
// is preserved, rewrites links to moved files in every tracked Markdown file
// and marks archived reports as historical. Idempotent: skips moved files.
const { execFileSync } = require('node:child_process'), fs = require('node:fs'), path = require('node:path')
const root = path.resolve(__dirname, '..')
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const plan = {
  'docs/architecture': ['ARQUITETURA.md', 'docs/PLATAFORMA_INTEGRAL_RV30.md', 'backend/API_CONTRACT.md', 'backend/SECURE_BACKEND_RV30.md', 'backend/SUPPORT_API.md', 'backend/CARDIO_ONBOARDING.md', 'docs/REVISAO_SEGURANCA_RV30.md'],
  'docs/payments': ['backend/ASAAS_ACCESS365.md', 'backend/STONE_ACCESS365.md', 'backend/PAYMENT_PROVIDERS_PLAN.md', 'backend/KIWIFY_WEBHOOK_PLANO.md', 'docs/MERCADO_PAGO_RV30.md', 'docs/COMPRAS_FUTURAS_RV30_20261107.md'],
  'docs/media': ['backend/VIDEOS_DRIVE.md', 'backend/ETAPA4_VIDEOS_PRIVADOS.md', 'docs/VIDEOS_RV30.md', 'docs/VIDEOAULAS_RV30_INTEGRAL.md', 'docs/UPLOAD_VIDEOS_RV30_20261107.md', 'docs/REPRODUCAO_PRIVADA_RV30_20261107.md'],
  'docs/design': ['DESIGN_RV_PERFORMANCE.md', 'docs/DESIGN_RV30.md', 'docs/DESIGN_SYSTEM_PETROLEO_RV30.md', 'reports/REDESIGN-CHECKPOINT.md', 'reports/CODEX-REDESIGN-COMPLETO-CHECKPOINT.md'],
  'docs/design/referencias': ['reports/PROMPT_CLAUDE_REDESIGN_GUIADO_PELO_CODIGO.md'],
  'docs/deployment': ['backend/PRODUCAO_CHECKLIST.md', 'CHECKLIST_LANCAMENTO_COMERCIAL_RV30.md', 'docs/AUTORIZACAO_PUBLICACAO_RV30.md', 'docs/CLOUDFLARE_BUILD_FIX.md'],
  'docs/testing': ['docs/VALIDACAO_RV30.md', 'docs/VALIDACAO_NAVEGADOR_RV30.md', 'docs/CONTA_TESTE_RV30_20261107.md'],
  'docs/archive': ['AUDITORIA.md', 'AUDITORIA_LANCAMENTO_ETAPA_1.md', 'QA_RELEASE_STATUS_2026-10-16.md', 'docs/AUDITORIA_MARCA_PUBLICACAO_20261107.md', 'docs/AUDITORIA_RELEASE_RV30.md', 'docs/ENTREGA_RV30_20261025.md', 'docs/RELATORIO_VALIDACAO_RV30_20261110.md', 'docs/RETOMADA_RV30_20261107.md', 'docs/REVISAO_AZUL_PUBLICACAO_20261026.md', 'docs/REVISAO_PREMIUM_RV30_20261107.md', 'docs/REVISAO_REQUISITOS_RV30_20261027.md', 'reports/RV30-AUDITORIA-FASE-2.md', 'reports/RV30-REDESIGN-TOTAL.md', 'reports/RV30-REDESIGN-VISUAL-FASE-2B.md']
}
const moves = Object.entries(plan).flatMap(([dir, files]) => files.map(from => ({ from, to: dir + '/' + path.basename(from) })))
const manifest = []
for (const { from, to } of moves) {
  if (!fs.existsSync(path.join(root, from))) continue
  fs.mkdirSync(path.join(root, path.dirname(to)), { recursive: true })
  git('mv', from, to); manifest.push(`| \`${from}\` | \`${to}\` |`)
}
// Rewrite references (links and backticked paths) in every tracked Markdown file.
const byName = new Map(moves.map(m => [path.basename(m.from), m.to]))
const names = [...byName.keys()].map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const pattern = new RegExp('([(`<\\s])((?:\\.{1,2}/|[\\w.-]+/)*)(' + names + ')(#[\\w-]*)?(?=[)`>\\s:,.]|$)', 'g')
for (const file of git('ls-files', '*.md').split('\n').filter(Boolean)) {
  if (/^(skills|agent-skills)\//.test(file)) continue
  const full = path.join(root, file), before = fs.readFileSync(full, 'utf8')
  const after = before.replace(pattern, (match, lead, prefix, name, hash = '') => {
    const target = byName.get(name), relative = path.posix.relative(path.posix.dirname(file), target)
    return lead + (relative.startsWith('.') ? relative : relative) + hash
  })
  if (after !== before) fs.writeFileSync(full, after)
}
// Archived reports are history, not the current state.
const banner = '> **Documento histórico** — arquivado em 22/11/2026. Não descreve o estado atual do RV30; consulte [`docs/ESTADO_ATUAL.md`](../ESTADO_ATUAL.md).\n\n'
for (const file of plan['docs/archive']) {
  const full = path.join(root, 'docs/archive', path.basename(file)), text = fs.readFileSync(full, 'utf8')
  if (!text.startsWith('> **Documento histórico**')) fs.writeFileSync(full, banner + text)
}
console.log(manifest.length ? manifest.join('\n') : 'Nada a mover (já organizado).')
