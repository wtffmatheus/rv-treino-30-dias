'use strict'

// A auditoria de lancamento e intencionalmente conservadora: falhar significa
// "NAO PUBLICAR". Nao vincula pagamentos nem cria acesso por conta propria.
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8') }
function check() {
  const findings = []
  function add(code, passed, detail, type = 'blocker') {
    findings.push({ code, status: passed ? 'PASS' : 'FAIL', type, detail })
  }
  const cfg = read('assets/js/config.js')
  const content = read('assets/js/content.js')
  const course = read('area.html')
  const checkout = read('checkout.html')
  const student = read('assets/js/area.js')
  const landing = read('index.html')
  const videoTemplate = JSON.parse(read('assets/data/rv30-videos-template.json'))
  const vids = [...content.matchAll(/"videoUrl"\s*:\s*"([^"]*)"/g)].map(x => x[1])
  const dayList = videoTemplate.items.map(x => Number(String(x.name).match(/^(\d+)\.(?:mov|mp4|m4v|webm)$/i)?.[1]))
  const publicURLs = videoTemplate.items.filter(x => Boolean(x.driveUrl))
  // Um URL do Drive no bundle publico nao e controle de acesso e tambem nao
  // prova que o usuario possui entitlement. Mantemos URLs privadas fora do Git.
  add('price_gateway_configured', !/paymentUrl:\s*''/.test(cfg) && /paymentProvider:/.test(cfg),
    'A oferta precisa de link real de pagamento ou checkout server-side testado.')
  add('production_auth', !/auth-demo\.js/.test(course) && !/auth-demo\.js/.test(checkout),
    'Autenticacao e matricula de producao devem substituir o adaptador de demonstracao.')
  add('protected_video_delivery', vids.length >= 30 && vids.slice(1, 31).every(x => x && !x.includes('drive.google.com')),
    'Videos dos 30 dias exigem playback privado autenticado; links Drive nao bastam.')
  add('drive_manifest_unique_30', dayList.length === 30 && dayList.every((day, i) => day === i + 1),
    'Modelo editorial deve conter exatamente um arquivo por dia, de 1 a 30.')
  add('no_private_drive_links_publicly', publicURLs.length === 0,
    'IDs reais e URLs privadas nao devem ser publicados em assets/data.')
  add('onboarding_cardio', /data-cardio-section/.test(course) && /RVCardio\?\.mount/.test(student),
    'Calculadora deve ser testada com consentimento e aparecer no primeiro acesso.', 'quality')
  add('launch_visual_review', false, 'Comparar landing, checkout e area com o moodboard aprovado em mobile e desktop.', 'manual')
  add('day_30_drive_verified', false, 'No inventario autenticado foram encontrados 1.MOV a 29.MOV; 30.MOV ausente.', 'manual')
  add('legal_health_content_approved', false,
    'Revisao juridica/comercial e da profissional: resultados, privacidade, consentimento e prescricao.', 'manual')
  return { verdict: findings.some(x => x.type === 'blocker' && x.status === 'FAIL') ? 'NO_GO' : 'REVIEW_REQUIRED',
    findings, checkedFiles: ['assets/js/config.js','assets/js/content.js','area.html',
      'checkout.html','assets/js/area.js','index.html','assets/data/rv30-videos-template.json'] }
}
if (require.main === module) {
  const result = check()
  console.log(JSON.stringify(result, null, 2))
  if (result.verdict !== 'GO') process.exitCode = 2
}
module.exports = { check }
