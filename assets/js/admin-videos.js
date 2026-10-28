(async () => {
  'use strict'
  await window.RVApi?.ready
  const serverMode = window.RVApi?.serverMode === true || !window.RV_COURSE_CONFIG?.testMode
  if (serverMode) {
    document.querySelectorAll('[data-local-video-editor]').forEach((element) => { element.hidden = true })
    const note = document.querySelector('[data-video-environment-note]')
    try {
      const response = await fetch('/api/account', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      if (response.status === 401 || response.status === 403) { location.replace('/admin/entrar'); return }
      if (!response.ok) throw new Error('configuration')
      const account = await response.json()
      if (!account.isAdmin) { location.replace('/admin/entrar'); return }
      if (note) note.textContent = 'Os vídeos pagos são publicados no servidor após revisão e preparação do armazenamento privado. O editor de demonstração não altera aulas reais. Consulte a documentação de preparação do RV 30 e use a verificação de entrega no painel.'
      document.querySelector('[data-summary]').textContent = 'RV 30 · 30 dias. Catálogo privado gerenciado no servidor.'
      document.querySelector('[data-exit]')?.addEventListener('click', async () => {
        try { await window.RVApi?.logout(); location.replace('/admin/entrar') } catch { if (note) note.textContent = 'Não foi possível encerrar a sessão. Tente novamente.' }
      })
    } catch {
      if (note) note.textContent = 'A gestão privada de vídeos ainda não foi configurada no servidor. Nenhum vídeo foi publicado por esta tela.'
    }
    return
  }
  document.querySelectorAll('[data-local-video-editor]').forEach((element) => { element.hidden = false })
  const store = window.RVCourseStore
  const media = window.RVMediaReview
  const $ = (s) => document.querySelector(s)
  const login = () => location.replace(window.RVRoute.resolve('/admin/entrar'))
  if (!store?.isAdminLoggedIn()) { login(); return }
  const courses = window.RV_COURSE_CONFIG.courses.filter((c) => Number.isInteger(c.totalDays))
  courses.forEach((c) => $('[data-course]').add(new Option(c.title, c.id)))
  const courseId = () => $('[data-course]').value
  const batchReady = (course, items) => {
    if (!course || items.length < course.totalDays) return false
    return Array.from({ length: course.totalDays }, (_, i) => i + 1)
      .every((day) => items.some((item) => item.day === day && item.approved)) &&
      items.every((item) => item.approved)
  }
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  function perform(action) {
    $('[data-error]').textContent = ''
    $('[data-feedback]').textContent = ''
    try {
      const result = action()
      if (!result?.ok) $('[data-error]').textContent = result?.message || 'Não foi possível salvar.'
      return result
    } catch { $('[data-error]').textContent = 'Não foi possível ler ou salvar os dados. Verifique o arquivo e o armazenamento do navegador.'; return { ok: false } }
  }
  function render() {
    if (!store.isAdminLoggedIn()) { login(); return }
    const course = courses.find((c) => c.id === courseId())
    $('[data-drive]').hidden = courseId() !== 'rv30'
    const items = media.list(courseId())
    const approved = items.filter((i) => i.approved).length
    const summary = media.summary(courseId())
    $('[data-summary]').textContent = `${course.title} · ${course.totalDays} aulas (introdução opcional)`
    $('[data-count]').textContent = `${items.length} arquivos · ${summary.linked} vinculados · ${approved} aprovados`
    $('[data-missing-days]').textContent = summary.missingDays.length
      ? `Dias sem arquivo vinculado: ${summary.missingDays.map((day) => String(day).padStart(2, '0')).join(', ')}. A numeração original será preservada.`
      : 'Todos os 30 dias têm um arquivo vinculado para revisão. A reprodução privada ainda depende da preparação no servidor.'
    $('[data-approve]').disabled = !$('[data-confirm]').checked || !batchReady(course, items)
    const list = $('[data-video-list]')
    list.replaceChildren()
    if (!items.length) { list.append(el('p', 'Nenhum vídeo importado. Os conteúdos seguem em rascunho.', 'support-empty')); return }
    items.forEach((item) => {
      const row = el('article', '', 'media-row')
      const number = el('span', String(item.day).padStart(2, '0'), 'media-day')
      const details = el('div', '', 'media-detail')
      details.append(el('h3', item.name), el('small', item.approved ? 'Aprovado para preparação' : 'Aguardando revisão'))
      const form = el('form', '', 'media-source-form')
      const label = el('label', `Link privado · aula ${item.day}`)
      const input = el('input')
      input.type = 'url'; input.value = item.driveUrl; input.placeholder = 'https://drive.google.com/file/d/…/view'
      label.append(input)
      const save = el('button', 'Vincular', 'button button--secondary'); save.type = 'submit'
      form.append(label, save)
      form.addEventListener('submit', (event) => { event.preventDefault(); if (perform(() => media.update(courseId(), item.day, { driveUrl: input.value.trim() })).ok) { $('[data-confirm]').checked = false; render() } })
      details.append(form)
      if (item.driveUrl) { const link = el('a', 'Revisar no Drive', 'text-link'); link.href = item.driveUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; details.append(link) }
      const approval = el('label', '', 'consent-label')
      const check = el('input'); check.type = 'checkbox'; check.checked = item.approved
      check.addEventListener('change', () => { const result = perform(() => media.update(courseId(), item.day, { approved: check.checked })); if (!result.ok) check.checked = item.approved; else { $('[data-confirm]').checked = false; render() } })
      approval.append(check, document.createTextNode(`Aprovar aula ${String(item.day).padStart(2, '0')}`))
      row.append(number, details, approval)
      list.append(row)
    })
  }
  function importFiles(selectedCourse, files) {
    const result = perform(() => media.importAvailable(selectedCourse, files))
    const issues = result.issues || []
    if (issues.length) $('[data-error]').textContent = issues.map((issue) => issue.message).join(' ')
    if (result.ok) {
      $('[data-confirm]').checked = false
      render()
      $('[data-feedback]').textContent = `${result.count} arquivos sem conflito importados, em ordem numérica. ${issues.length ? 'Os arquivos com problemas foram excluídos desta importação e precisam de revisão.' : 'Nenhuma aula foi publicada.'}`
    }
  }
  $('[data-files]').addEventListener('change', (event) => {
    const files = Array.from(event.target.files).map((file) => ({ name: file.name, size: file.size, lastModified: file.lastModified }))
    if (files.length) importFiles(courseId(), files)
    event.target.value = ''
  })
  $('[data-manifest]').addEventListener('change', async (event) => {
    const input = event.target
    const file = input.files[0]
    const selectedCourse = courseId()
    if (!file) return
    try {
      if (file.size > 256000) throw new Error('size')
      const data = JSON.parse(await file.text())
      if (courseId() !== selectedCourse || data.courseId !== selectedCourse || data.schemaVersion !== 1) throw new Error('course')
      importFiles(selectedCourse, data.items)
    } catch { $('[data-error]').textContent = 'Manifesto inválido: use schemaVersion 1, o curso selecionado e um arquivo de até 256 KB.' }
    input.value = ''
  })
  $('[data-confirm]').addEventListener('change', () => {
    const course = courses.find((c) => c.id === courseId())
    $('[data-approve]').disabled = !$('[data-confirm]').checked || !batchReady(course, media.list(courseId()))
  })
  $('[data-course]').addEventListener('change', () => { $('[data-confirm]').checked = false; render() })
  $('[data-approve]').addEventListener('click', () => {
    if (!$('[data-confirm]').checked) return
    if (perform(() => media.approveBatch(courseId())).ok) $('[data-feedback]').textContent = 'Lote aprovado. Exporte o manifesto para a etapa de preparação. Nenhuma aula foi publicada.'
  })
  $('[data-export]').addEventListener('click', () => {
    const data = media.manifest(courseId())
    if (!data) { login(); return }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = el('a'); link.href = url; link.download = `${courseId()}-videos-${data.status}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
  $('[data-exit]').addEventListener('click', () => { store.adminLogout(); login() })
  window.addEventListener('storage', (event) => { if (event.key === media.storageKey || event.key === store.storage.adminSession) render() })
  setInterval(() => { if (!store.isAdminLoggedIn()) login() }, 30000)
  render()
})()
