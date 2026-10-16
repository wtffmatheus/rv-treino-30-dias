(() => {
  'use strict'
  const KEY = 'rv-cursos-media-review-v1'
  const allowed = () => window.RV_COURSE_CONFIG?.testMode === true && window.RVCourseStore?.isAdminLoggedIn()
  const config = (id) => window.RV_COURSE_CONFIG?.courses?.find((course) => course.id === id && Number.isInteger(course.totalDays))
  const failure = (message) => ({ ok: false, message })
  const read = () => {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  }
  function driveFileId(value) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password) return null
      return url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || null
    } catch { return null }
  }
  function parseDay(name) {
    const normalized = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    // Aceita 1.mov ... 30.mov, alem do padrao anterior "video aula 01.mp4".
    // Apenas um numero sozinho com extensao valida vira "Dia N".
    const numeric = normalized.match(/^(\d{1,3})\.(?:mov|mp4|m4v|webm)$/)
    if (numeric) return Number(numeric[1])
    const match = normalized.match(/^(?:video[ _-]*)?(?:aula|dia)[ _-]*(\d{1,3})(?=[ _.-]|$)/)
    return match ? Number(match[1]) : null
  }
  window.RVMediaReview = {
    storageKey: KEY,
    parseDay,
    driveFileId,
    list(courseId) {
      if (!allowed()) return []
      return read()[courseId]?.items || []
    },
    import(courseId, files) {
      if (!allowed()) return failure('Sessão administrativa necessária.')
      const course = config(courseId)
      if (!course || !Array.isArray(files) || !files.length || files.length > course.totalDays + 1) return failure('Lista de vídeos inválida.')
      const days = new Set()
      const staged = []
      for (const file of files) {
        const day = parseDay(file.name)
        if (!/\.(mp4|mov|webm|m4v)$/i.test(file.name || '') || day === null || day > course.totalDays || days.has(day)) {
          return failure(`Nome inválido ou dia duplicado: ${String(file.name || '').slice(0, 120)}. Use 1.mov até ${course.totalDays}.mov (introdução 0.mov opcional).`)
        }
        if (file.driveUrl && !driveFileId(file.driveUrl)) return failure('Use o link privado de um arquivo do Google Drive.')
        days.add(day)
        staged.push({ day, name: String(file.name).slice(0, 240), driveUrl: file.driveUrl || '',
          revision: String(file.revision || `${file.size || 0}:${file.lastModified || 0}`).slice(0, 120),
          approved: false, approvedAt: null })
      }
      const db = read()
      const old = db[courseId]?.items || []
      // Uma reimportacao invalida o aceite, inclusive quando o nome nao mudou.
      const items = [...old.filter((i) => !days.has(i.day)), ...staged].sort((a, b) => a.day - b.day)
      const ids = items.map((i) => driveFileId(i.driveUrl)).filter(Boolean)
      if (new Set(ids).size !== ids.length) return failure('Um mesmo arquivo do Drive nao pode ocupar varias aulas.')
      db[courseId] = { items, batchApprovedAt: null }
      localStorage.setItem(KEY, JSON.stringify(db))
      return { ok: true, count: staged.length }
    },
    update(courseId, day, changes) {
      if (!allowed()) return failure('Sessão administrativa necessária.')
      const db = read()
      const item = db[courseId]?.items.find((i) => i.day === day)
      if (!item) return failure('Vídeo não encontrado.')
      if (Object.hasOwn(changes, 'driveUrl')) {
        const id = changes.driveUrl ? driveFileId(changes.driveUrl) : null
        if (changes.driveUrl && !id) return failure('Link inválido. Use https://drive.google.com/file/d/ID/view.')
        if (id && db[courseId].items.some((i) => i.day !== day && driveFileId(i.driveUrl) === id)) {
          return failure('Este arquivo do Drive ja foi associado a outra aula.')
        }
        item.driveUrl = changes.driveUrl || ''
        item.approved = false
        item.approvedAt = null
      }
      if (Object.hasOwn(changes, 'approved')) {
        if (changes.approved && !driveFileId(item.driveUrl)) return failure('Vincule o arquivo no Drive antes de aprovar.')
        item.approved = changes.approved === true
        item.approvedAt = item.approved ? new Date().toISOString() : null
      }
      db[courseId].batchApprovedAt = null
      localStorage.setItem(KEY, JSON.stringify(db))
      return { ok: true }
    },
    approveBatch(courseId) {
      if (!allowed()) return failure('Sessão administrativa necessária.')
      const course = config(courseId)
      const db = read()
      const batch = db[courseId]
      // Os 30 dias sao obrigatorios. Introducao (dia 00) so precisa de
      // arquivo/aprovacao quando foi efetivamente fornecida.
      const validDays = Array.from({ length: course.totalDays }, (_, i) => i + 1)
      const intro = batch?.items?.find((i) => i.day === 0)
      if (!course || !batch || (batch.items.length !== course.totalDays && batch.items.length !== course.totalDays + 1) ||
        validDays.some((day) => !batch.items.some((i) => i.day === day && i.approved && driveFileId(i.driveUrl))) ||
        (intro && (!intro.approved || !driveFileId(intro.driveUrl)))) {
        return failure('Revise e aprove todos os 30 vídeos. A introdução é opcional; se adicionada, também precisa ser aprovada.')
      }
      batch.batchApprovedAt = new Date().toISOString()
      localStorage.setItem(KEY, JSON.stringify(db))
      return { ok: true }
    },
    manifest(courseId) {
      if (!allowed()) return null
      const batch = read()[courseId]
      return { schemaVersion: 1, courseId, status: batch?.batchApprovedAt ? 'approved_for_ingestion' : 'draft',
        approvedAt: batch?.batchApprovedAt || null, published: false, items: batch?.items || [] }
    }
  }
})()
