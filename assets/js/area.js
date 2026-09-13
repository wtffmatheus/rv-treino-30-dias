(() => {
  'use strict'

  const CONTENT = Array.isArray(window.RV30_CONTENT) ? window.RV30_CONTENT : []
  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const params = new URLSearchParams(location.search)
  const demoMode = window.RV_COURSE_CONFIG?.testMode === true && params.get('demo') === '1'
  const courseId = 'rv30'
  const DEMO_PROGRESS_KEY = 'rv30-demo-progress-v6'
  const DEMO_COMMENTS_KEY = 'rv30-demo-comments-v6'
  const $ = (selector) => document.querySelector(selector)
  const routeMatch = location.pathname.match(/^\/curso\/rv30(?:\/dia\/(\d+))?$/)
  const courseRoute = routeMatch ? '/curso/rv30' : 'area.html'

  if (!CONTENT.length) {
    document.body.innerHTML = '<main class="center-portal"><section class="auth-card"><h1>Conteúdo indisponível.</h1><p>O catálogo de aulas não foi carregado.</p></section></main>'
    return
  }

  if (!demoMode && (!auth?.isLoggedIn() || !auth?.hasAccess(courseId))) {
    const loginUrl = `/entrar?next=${encodeURIComponent('/curso/rv30')}`
    location.replace(window.RVRoute?.resolve(loginUrl) || loginUrl)
    return
  }

  const account = demoMode ? null : auth.account()
  const studentLabel = $('[data-course-student]')
  if (studentLabel) studentLabel.textContent = demoMode ? 'Demonstração' : account?.name || 'Aluno'

  let selectedDay = Math.min(30, Math.max(0, Number(params.get('day') || routeMatch?.[1]) || 0))

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
  }

  function progressDays() {
    if (!demoMode) return auth.progress(courseId)
    const days = readJson(DEMO_PROGRESS_KEY, [])
    return Array.isArray(days) ? days : []
  }

  function setProgressDay(day, complete) {
    if (!demoMode) return auth.setDayComplete(courseId, day, complete)
    const done = new Set(progressDays())
    complete ? done.add(day) : done.delete(day)
    writeJson(DEMO_PROGRESS_KEY, [...done].sort((a, b) => a - b))
    return { ok: true }
  }

  function userComments(day) {
    if (!demoMode) return auth.comments(courseId, day)
    const map = readJson(DEMO_COMMENTS_KEY, {})
    return Array.isArray(map[day]) ? map[day] : []
  }

  function addUserComment(day, text) {
    if (!demoMode) return auth.addComment(courseId, day, text)
    const clean = String(text || '').trim().slice(0, 600)
    if (!clean) return { ok: false }
    const map = readJson(DEMO_COMMENTS_KEY, {})
    map[day] = Array.isArray(map[day]) ? map[day] : []
    map[day].push({
      id: `demo_${Date.now()}`,
      name: 'Aluno (teste)',
      text: clean,
      createdAt: new Date().toISOString(),
      status: 'open'
    })
    writeJson(DEMO_COMMENTS_KEY, map)
    return { ok: true }
  }

  function renderSidebar() {
    const done = new Set(progressDays())
    const picker = $('[data-day-picker]')
    if (picker) {
      picker.replaceChildren(...CONTENT.map((item) => new Option(`${item.day === 0 ? 'Introdução' : `Dia ${item.day}`} - ${item.title}`, String(item.day))))
      picker.value = String(selectedDay)
    }
    const list = $('[data-day-list]')
    if (!list) return
    list.innerHTML = CONTENT.map((item) => {
      const complete = done.has(item.day)
      const active = selectedDay === item.day
      return `<button type="button" class="course-day-btn ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}" data-select-day="${item.day}" ${active ? 'aria-current="page"' : ''}>
        <span class="course-day-number">${item.day === 0 ? '00' : String(item.day).padStart(2, '0')}</span>
        <span><strong>${item.day === 0 ? 'Introdução' : `Dia ${item.day}`}</strong><small>${escapeHtml(item.phase)}</small></span>
        <span class="course-day-state" aria-label="${complete ? 'Concluído' : 'Pendente'}">${complete ? '✓' : ''}</span>
      </button>`
    }).join('')
  }

  function renderProgress() {
    const done = new Set(progressDays())
    const completedDays = [...done].filter((day) => day >= 1 && day <= 30).length
    const pct = Math.round((completedDays / 30) * 100)
    $('[data-progress-title]').textContent = `${completedDays} de 30`
    const progress = $('[data-progress-native]')
    progress.value = completedDays
    progress.setAttribute('aria-valuetext', `${pct}% concluído`)
    $('[data-progress-copy]').textContent = completedDays ? `${pct}% do projeto concluído.` : 'Conclua os conteúdos para acompanhar sua evolução.'
  }

  function embedVideo(url, title) {
    const shell = $('[data-course-video]')
    shell.replaceChildren()

    if (!url) {
      shell.innerHTML = `<div class="course-video-placeholder"><strong>${escapeHtml(title)}</strong><small>Vídeo em preparação pela equipe RV.</small></div>`
      return
    }

    if (/youtube\.com|youtu\.be/.test(url)) {
      const id = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/)?.[1]
      if (id) {
        shell.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${escapeHtml(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
        return
      }
    }

    if (/vimeo\.com/.test(url)) {
      const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]
      if (id) {
        shell.innerHTML = `<iframe src="https://player.vimeo.com/video/${id}" title="${escapeHtml(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
        return
      }
    }

    const video = document.createElement('video')
    video.controls = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = url
    shell.append(video)
  }

  function professionalComment(item) {
    return {
      professional: true,
      name: 'RV Fisiologia',
      text: item.day === 0
        ? 'Use este espaço para dúvidas sobre o funcionamento do projeto. Os comentários ficam ligados ao conteúdo correto.'
        : 'Se surgir uma dúvida específica sobre este conteúdo, registre aqui para que ela fique vinculada ao dia correto.',
      label: 'Comentário fixado'
    }
  }

  function formatDate(value) {
    if (!value) return 'Agora'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Agora'
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  }

  function renderComments(item) {
    const comments = [professionalComment(item), ...userComments(item.day)]
    $('[data-comment-count]').textContent = `${comments.length} ${comments.length === 1 ? 'comentário' : 'comentários'}`
    $('[data-comment-list]').innerHTML = comments.map((comment) => `
      <article class="comment-card ${comment.professional ? 'is-professional' : ''}">
        <div class="comment-avatar">${comment.professional ? 'RV' : 'AL'}</div>
        <div>
          <div class="comment-card-head"><strong>${escapeHtml(comment.name || 'Aluno')}</strong>${comment.professional ? '<span>PROFISSIONAL</span>' : comment.status === 'answered' ? `<span>${comment.adminReply ? 'RESPONDIDO' : 'TRATADO'}</span>` : ''}</div>
          <p>${escapeHtml(comment.text)}</p>
          <time>${escapeHtml(comment.label || formatDate(comment.createdAt))}</time>
          ${comment.adminReply ? `<div class="comment-reply"><small>RESPOSTA DA RV</small><p>${escapeHtml(comment.adminReply.text)}</p><time>${escapeHtml(formatDate(comment.adminReply.createdAt))}</time></div>` : ''}
        </div>
      </article>`).join('')
  }

  function renderContent() {
    const item = CONTENT[selectedDay]
    const done = new Set(progressDays())
    if (!item) return

    $('[data-day-pill]').textContent = item.day === 0 ? 'INTRODUÇÃO' : `DIA ${String(item.day).padStart(2, '0')}`
    $('[data-phase-label]').textContent = item.phase.toUpperCase()
    $('[data-title]').textContent = item.title
    $('[data-description]').textContent = item.description
    $('[data-time]').textContent = item.time
    $('[data-duration]').textContent = item.duration
    $('[data-type]').textContent = item.type
    $('[data-objective]').textContent = item.objective
    $('[data-content-status]').textContent = done.has(item.day) ? 'Conteúdo concluído' : 'Conteúdo disponível'
    $('[data-instructions]').innerHTML = item.instructions.map(([title, text]) => `<li><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div></li>`).join('')

    const button = $('[data-complete]')
    const complete = done.has(item.day)
    button.textContent = complete ? '✓ Concluído' : 'Marcar como concluído'
    button.setAttribute('aria-pressed', String(complete))
    button.classList.toggle('button--secondary', complete)
    button.classList.toggle('button--primary', !complete)

    $('[data-prev]').disabled = item.day === 0
    $('[data-next]').disabled = item.day === 30

    embedVideo(item.videoUrl, item.videoTitle)
    renderComments(item)
    renderSidebar()
    renderProgress()

    const search = new URLSearchParams()
    if (demoMode) search.set('demo', '1')
    search.set('day', String(item.day))
    history.replaceState({}, '', `${courseRoute}?${search.toString()}`)
  }

  function selectDay(day) {
    selectedDay = Math.min(30, Math.max(0, Number(day)))
    renderContent()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleComplete() {
    const done = new Set(progressDays())
    const result = setProgressDay(selectedDay, !done.has(selectedDay))
    if (result?.ok) renderContent()
  }

  document.addEventListener('click', (event) => {
    const dayButton = event.target.closest('[data-select-day]')
    if (dayButton) selectDay(dayButton.dataset.selectDay)
    if (event.target.closest('[data-complete]')) toggleComplete()
    if (event.target.closest('[data-prev]') && selectedDay > 0) selectDay(selectedDay - 1)
    if (event.target.closest('[data-next]') && selectedDay < 30) selectDay(selectedDay + 1)
    if (event.target.closest('[data-reset-demo]') && demoMode) {
      localStorage.removeItem(DEMO_PROGRESS_KEY)
      localStorage.removeItem(DEMO_COMMENTS_KEY)
      selectedDay = 0
      renderContent()
    }
  })

  $('[data-comment-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const field = event.currentTarget.elements.comment
    const result = addUserComment(selectedDay, field.value)
    if (!result?.ok) return
    field.value = ''
    renderComments(CONTENT[selectedDay])
    field.focus()
  })

  if (demoMode) $('[data-reset-demo]')?.removeAttribute('hidden')
  $('[data-day-picker]')?.addEventListener('change', (event) => selectDay(event.target.value))
  renderContent()
})()
