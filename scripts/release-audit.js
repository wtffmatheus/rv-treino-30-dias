'use strict'

// Auditoria estática: código preparado e testes com mocks não comprovam uma
// integração publicada. Nunca lê secrets nem transforma uma flag local em GO.
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8') }
function optional(file) { return fs.existsSync(path.join(root, file)) ? read(file) : '' }
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
  const api = optional('backend/server/api.js')
  const bridge = optional('assets/js/api-client.js')
  const migration = optional('backend/migrations/20261025_rv30_secure_foundation.sql')
  const videoTemplate = JSON.parse(read('assets/data/rv30-videos-template.json'))
  const inventoryRecord = JSON.parse(optional('assets/data/rv30-video-status.json') || '{}')
  const dayList = videoTemplate.items.map(item => Number(String(item.name).match(/^(\d+)\.(?:mov|mp4|m4v|webm)$/i)?.[1]))
  const publicURLs = videoTemplate.items.filter(item => Boolean(item.driveUrl))
  const catalogURLs = [...content.matchAll(/"videoUrl"\s*:\s*"([^"]*)"/g)].map(match => match[1])
  const linkedDays = Array.isArray(inventoryRecord.linkedDays)
    ? [...new Set(inventoryRecord.linkedDays.filter(day => Number.isInteger(day) && day >= 1 && day <= 30))].sort((a, b) => a - b)
    : []
  const pendingDays = Array.from({ length: 30 }, (_, index) => index + 1).filter(day => !linkedDays.includes(day))
  const serverPrepared = api.includes('createApi') && api.includes('/api/auth/login') && api.includes('/api/admin/delivery') && api.includes('email_confirmed_at')
  const bridgePrepared = bridge.includes('api.ready') && bridge.includes('api.configured || !config.testMode') && course.includes('api-client.js') && checkout.includes('api-client.js')
  const paymentPrepared = api.includes('/api/orders') && api.includes('/api/webhooks/mercado-pago') && api.includes('verifySignature') && api.includes('rv30_apply_payment')
  const privatePlaybackPrepared = api.includes('/storage/v1/object/sign/rv30-videos/') && api.includes('await access(user.id)')

  add('server_api_prepared', serverPrepared && bridgePrepared,
    'API e adaptador de sessão preparados no código. auth-demo.js pode coexistir no bundle: o modo servidor substitui o store e não usa o banco de demonstração.', 'quality')
  add('payment_adapter_prepared', paymentPrepared,
    'Checkout Mercado Pago, consulta autenticada ao provedor e transação idempotente preparados; ainda sem pagamento real de homologação verificado.', 'quality')
  add('private_playback_adapter_prepared', privatePlaybackPrepared,
    'Servidor preparado para conferir o direito de acesso e emitir URL temporária de bucket privado. Isso não comprova que exista um vídeo reproduzível.', 'quality')
  add('database_migration_prepared', migration.includes('enable row level security') && migration.includes('as restrictive') && migration.includes('for update;'),
    'Migração aditiva revisável com RLS, isolamento por ambiente e bloqueio transacional preparada. Não aplicada nem validada em uma base real.', 'quality')
  add('sales_disabled_by_default', /salesEnabled:\s*false/.test(cfg) && /productionAccessVerified:\s*false/.test(cfg),
    'Valores locais mantêm vendas desativadas. No modo servidor, a disponibilidade vem da configuração protegida e do produto comercial aprovado.', 'quality')

  // Códigos históricos preservados para os consumidores de check(). Os gates
  // exigem comprovação real, não a simples ausência de auth-demo.js no bundle.
  add('price_gateway_configured', false,
    'Implementação de checkout preparada; credenciais, provedor escolhido, preço comercial aprovado e pagamento de teste no ambiente publicado ainda precisam de verificação.')
  add('production_auth', false,
    'Autorização no servidor preparada. Cadastro, e-mail, recuperação, revogação e separação de contas ainda precisam ser verificados com o provedor real em homologação.')
  add('protected_video_delivery', false,
    `${linkedDays.length}/30 dias registrados como vinculados no inventário local atual; ${catalogURLs.filter(Boolean).length} URLs no catálogo estático. Reprodução privada, permissões e expiração ainda não verificadas com arquivos reais.`)
  add('sales_activation', false,
    'Ativação comercial no ambiente publicado não verificada. Não ativar por alteração de flag no JavaScript; exige configuração protegida e evidência do fluxo completo.')
  add('server_approved_access', false,
    'Pagamento e entrega foram exercitados com respostas simuladas. Falta comprovar, em homologação, compra aprovada gerando o direito de acesso correto sem duplicidade.')
  add('deployment_backend_verified', false,
    'Falta verificar uma implantação de homologação que execute a API, HTTPS/proxy e configuração protegida. O build estático dist/ sozinho não executa o backend.')
  add('database_policies_verified', false,
    'Faltam backup/restauração e execução da migração em homologação, seguidos de testes reais de RLS, contas distintas e acesso direto ao armazenamento.')
  add('drive_manifest_unique_30', dayList.length === 30 && dayList.every((day, index) => day === index + 1),
    'O modelo editorial contém um nome por dia, de 1 a 30; nomes de exemplo não são arquivos encontrados.')
  add('no_private_drive_links_publicly', publicURLs.length === 0,
    'O modelo público não contém links privados do Drive. IDs e manifestos reais devem permanecer fora de assets/data e do Git.')
  add('onboarding_cardio', /data-cardio-section/.test(course) && /RVCardio\?\.mount/.test(student),
    'Interface opcional da calculadora presente no código; esta constatação não aprova prescrição nem uso de dados reais de saúde.', 'quality')
  add('launch_visual_review', false,
    'Revisão visual final pela responsável ainda não registrada. Capturas e testes automatizados são evidências técnicas, não aprovação comercial.', 'manual')
  add('day_30_drive_verified', false,
    'Dia 30 não verificado nesta sessão. Não há acesso autenticado atual ao Drive; nenhum arquivo real está vinculado. Menções históricas a 29 arquivos não são inventário atual.', 'manual')
  add('legal_health_content_approved', false,
    'Condições comerciais, termos, privacidade e conteúdo profissional precisam de aprovação da responsável.', 'manual')
  return {
    verdict: findings.some(item => item.type === 'blocker' && item.status === 'FAIL') ? 'NO_GO' : 'REVIEW_REQUIRED',
    findings,
    checkedFiles: ['assets/js/config.js', 'assets/js/content.js', 'area.html', 'checkout.html', 'assets/js/area.js', 'index.html',
      'assets/data/rv30-videos-template.json', 'assets/data/rv30-video-status.json', 'assets/js/api-client.js', 'backend/server/api.js',
      'backend/migrations/20261025_rv30_secure_foundation.sql'],
    inventory: {
      scope: 'repository_record_only', source: inventoryRecord.source || 'not_recorded', verifiedAt: inventoryRecord.verifiedAt || null,
      authenticatedDriveChecked: false, verifiedFiles: Number.isInteger(inventoryRecord.verifiedFiles) ? inventoryRecord.verifiedFiles : 0,
      linkedDays, pendingDays,
      historicalNote: 'Documentos anteriores mencionam 29 arquivos. Essa informação não foi revalidada e não comprova vínculo ou reprodução nesta entrega.'
    },
    verification: { staticSourceOnly: true, backendDeploymentVerified: false, liveAuthVerified: false, liveDatabaseVerified: false, livePaymentVerified: false, liveVideoPlaybackVerified: false }
  }
}
if (require.main === module) {
  const result = check()
  console.log(JSON.stringify(result, null, 2))
  if (result.verdict !== 'GO') process.exitCode = 2
}
module.exports = { check }
