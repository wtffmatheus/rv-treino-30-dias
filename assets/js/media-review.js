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
          return failure(`Nome inválido ou dia duplicado: ${String(file.name || '').slice(0, 120)}. Use video aula 00.mp4 até video aula ${course.totalDays}.mp4.`)
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
        if (changes.driveUrl && !driveFileId(changes.driveUrl)) return failure('Link inválido. Use https://drive.google.com/file/d/ID/view.')
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
      if (!course || !batch || batch.items.length !== course.totalDays + 1 ||
        Array.from({ length: course.totalDays + 1 }, (_, day) => day).some((day) => !batch.items.some((i) => i.day === day && i.approved && driveFileId(i.driveUrl)))) {
        return failure('Revise e aprove todos os vídeos, incluindo a introdução (aula 00).')
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
