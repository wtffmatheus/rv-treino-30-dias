(() => {
  'use strict'
  const KEY = 'rv-cursos-media-review-v1'
  const allowed = () => window.RV_COURSE_CONFIG?.testMode === true && window.RVCourseStore?.isAdminLoggedIn()
  const config = (id) => window.RV_COURSE_CONFIG?.courses?.find((course) => course.id === id && Number.isInteger(course.totalDays))
  const failure = (message) => ({ ok: false, message })
  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    } catch { return {} }
  }
  function driveFileId(value) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || url.port) return null
      return url.pathname.match(/^\/file\/d\/([\w-]+)\/?(?:(?:view|preview)\/?)?$/)?.[1] || null
    } catch { return null }
  }
  function parseDay(name) {
    const normalized = String(name || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (!/\.(?:mov|mp4|m4v|webm)$/.test(normalized)) return null
    const stem = normalized.replace(/\.[^.]+$/, '')
    // Dois números (ex.: "dia 12 - versao 2") exigem revisão humana.
    // Nunca escolher o primeiro número silenciosamente.
    if ((stem.match(/\d+/g) || []).length !== 1) return null
    const match = stem.match(/^(?:(?:video[ _-]*)?(?:aula|dia)[ _-]*)?(\d{1,3})(?=[ _.-]|$)/)
    return match ? Number(match[1]) : null
  }
  function inventory(files, totalDays = 30) {
    const issues = []
    const candidates = []
    if (!Array.isArray(files) || files.length > 1000 || !Number.isInteger(totalDays) || totalDays < 1 || totalDays > 365) {
      return { items: [], issues: [{ code: 'INVALID_LIST', message: 'Lista de arquivos inválida.' }], missingDays: Array.from({ length: 30 }, (_, i) => i + 1), linked: 0 }
    }
    for (const file of files) {
      const name = typeof file?.name === 'string' ? file.name.trim().slice(0, 240) : ''
      const day = parseDay(name)
      if (day === null || day < 0 || day > totalDays) {
        issues.push({ code: 'AMBIGUOUS_NUMBER', name, message: `Numeração ausente, ambígua ou fora de 0 a ${totalDays}: ${name || '(sem nome)'}.` })
        continue
      }
      if (Object.hasOwn(file, 'day') && file.day !== day) {
        issues.push({ code: 'DAY_MISMATCH', name, day, message: `O dia declarado não corresponde ao nome ${name}.` })
        continue
      }
      const driveUrl = typeof file.driveUrl === 'string' ? file.driveUrl.trim() : ''
      if (driveUrl && !driveFileId(driveUrl)) {
        issues.push({ code: 'INVALID_DRIVE_URL', name, day, message: `Link privado inválido no dia ${day}.` })
        continue
      }
      candidates.push({ ...file, name, day, driveUrl })
    }
    const dayCounts = new Map()
    const sourceCounts = new Map()
    candidates.forEach((item) => {
      dayCounts.set(item.day, (dayCounts.get(item.day) || 0) + 1)
      const id = driveFileId(item.driveUrl)
      if (id) sourceCounts.set(id, (sourceCounts.get(id) || 0) + 1)
    })
    const items = candidates.filter((item) => {
      if (dayCounts.get(item.day) > 1) {
        issues.push({ code: 'DUPLICATE_DAY', day: item.day, name: item.name, message: `Dia ${item.day} duplicado: ${item.name}. Nenhuma alternativa foi escolhida.` })
        return false
      }
      if (sourceCounts.get(driveFileId(item.driveUrl)) > 1) {
        issues.push({ code: 'DUPLICATE_SOURCE', day: item.day, name: item.name, message: `Arquivo reutilizado no dia ${item.day}. As associações conflitantes foram excluídas.` })
        return false
      }
      return true
    }).sort((a, b) => a.day - b.day)
    const missingDays = Array.from({ length: totalDays }, (_, i) => i + 1).filter((day) => !items.some((item) => item.day === day && driveFileId(item.driveUrl)))
    return { items, issues, missingDays, linked: totalDays - missingDays.length }
  }
  window.RVMediaReview = {
    storageKey: KEY,
    parseDay,
    driveFileId,
    inventory,
    list(courseId) {
      if (!allowed()) return []
      return JSON.parse(JSON.stringify(read()[courseId]?.items || []))
    },
    import(courseId, files) {
      if (!allowed()) return failure('Sessão administrativa necessária.')
      const course = config(courseId)
      if (!course || !Array.isArray(files) || !files.length || files.length > course.totalDays + 1) return failure('Lista de vídeos inválida.')
      const analyzed = inventory(files, course.totalDays)
      if (analyzed.issues.length) return { ...failure(analyzed.issues[0].message), issues: analyzed.issues }
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
    importAvailable(courseId, files) {
      if (!allowed()) return failure('Sessão administrativa necessária.')
      const course = config(courseId)
      if (!course) return failure('Curso inválido.')
      const analyzed = inventory(files, course.totalDays)
      const existing = this.list(courseId)
      let available = analyzed.items
      // Conflitos com lotes anteriores não devem descartar os outros arquivos
      // válidos. Uma exclusão pode preservar uma associação anterior e revelar
      // outro conflito; repetir até que o conjunto final esteja consistente.
      while (available.length) {
        const replacedDays = new Set(available.map((item) => item.day))
        const retained = existing.filter((item) => !replacedDays.has(item.day))
        const filtered = available.filter((item) => {
          const source = driveFileId(item.driveUrl)
          const conflict = source && retained.find((previous) => driveFileId(previous.driveUrl) === source)
          if (!conflict) return true
          analyzed.issues.push({ code: 'EXISTING_SOURCE_CONFLICT', day: item.day, name: item.name,
            message: `Dia ${item.day}: arquivo já vinculado ao dia ${conflict.day}. O vínculo anterior foi preservado e a nova associação foi excluída.` })
          return false
        })
        if (filtered.length === available.length) break
        available = filtered
      }
      if (!available.length) return { ...failure('Nenhum arquivo sem conflito foi encontrado.'), issues: analyzed.issues }
      const result = this.import(courseId, available)
      return { ...result, issues: analyzed.issues, missingDays: result.ok ? this.summary(courseId).missingDays : analyzed.missingDays }
    },
    summary(courseId) {
      if (!allowed()) return null
      const course = config(courseId)
      if (!course) return null
      const items = this.list(courseId)
      const analyzed = inventory(items, course.totalDays)
      return { totalDays: course.totalDays, files: items.length, linked: analyzed.linked,
        approved: items.filter((item) => item.approved).length, missingDays: analyzed.missingDays,
        unimportedDays: Array.from({ length: course.totalDays }, (_, i) => i + 1).filter((day) => !items.some((item) => item.day === day)) }
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
      if (!course) return failure('Curso inválido.')
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
