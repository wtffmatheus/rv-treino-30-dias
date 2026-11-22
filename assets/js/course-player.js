// Página de um curso adicional. Tudo vem do servidor: só aparecem aulas
// publicadas e o vídeo é entregue por /api/... com sessão e matrícula
// conferidas a cada requisição (inclusive Range).
(async () => {
  'use strict'
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined && text !== null) el.textContent = String(text); if (className) el.className = className; return el }
  if (window.RVApi) await window.RVApi.ready
  const main = document.querySelector('[data-course-page]'), status = main.querySelector('[data-course-status]')
  const id = (location.pathname.match(/^\/curso\/([a-z0-9-]{2,40})$/) || [])[1] || new URLSearchParams(location.search).get('id') || ''
  if (id === 'rv30') { location.replace('/curso/rv30'); return }
  if (!window.RVCourseStore?.isLoggedIn?.()) { location.replace('/entrar?next=' + encodeURIComponent('/meus-cursos')); return }
  if (!/^[a-z0-9-]{2,40}$/.test(id)) { status.textContent = 'Curso não localizado.'; main.setAttribute('aria-busy', 'false'); return }
  const result = await window.RVApi.request('/api/courses/' + id)
  main.setAttribute('aria-busy', 'false')
  if (!result.ok) {
    main.replaceChildren(node('h1', 'Curso indisponível'), node('p', result.message, 'form-error'))
    const back = node('a', 'Voltar para Meus cursos', 'button button--primary'); back.href = '/meus-cursos'; main.append(back); return
  }
  document.title = result.course.title + ' — RV Fisiologia'
  document.querySelector('[data-course-label]').textContent = result.course.title
  const done = new Set(result.completed)
  const hero = node('header', null, 'course-page-hero')
  hero.append(node('p', 'Acesso até ' + new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(result.enrollment.expiresAt)), 'eyebrow'), node('h1', result.course.title))
  if (result.course.description) hero.append(node('p', result.course.description))
  const meter = node('p', null, 'course-card-facts'); hero.append(meter)
  const layout = node('div', null, 'course-layout'), stage = node('section', null, 'course-stage'), player = node('div', null, 'course-player')
  const head = node('div', null, 'course-lesson-head'), copy = node('div'), actions = node('div', null, 'course-lesson-actions'), feedback = node('p', null, 'platform-status')
  feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite')
  const toggle = node('button', '', 'button button--primary'), next = node('button', 'Próxima aula', 'button button--ghost')
  toggle.type = next.type = 'button'; actions.append(toggle, next); head.append(copy, actions); stage.append(player, head, feedback)
  const aside = node('nav', null, 'course-lessons'); aside.setAttribute('aria-label', 'Aulas do curso')
  aside.append(node('h2', result.lessons.length + (result.lessons.length === 1 ? ' aula' : ' aulas')))
  const list = node('ol'); aside.dataset.courseLessons = ''; aside.append(list)
  layout.append(stage, aside); main.replaceChildren(hero, layout)
  if (!result.lessons.length) { player.append(node('p', 'As aulas deste curso ainda estão sendo publicadas.', 'course-player-empty')); actions.hidden = true; return }
  let current = result.lessons.find(x => !done.has(x.id)) || result.lessons[0]
  const buttons = new Map()
  const summary = () => { meter.textContent = done.size + ' de ' + result.lessons.length + ' aulas concluídas · ' + Math.round(done.size / result.lessons.length * 100) + '%' }
  for (const lesson of result.lessons) {
    const item = node('li'), button = node('button'); button.type = 'button'
    const label = node('span'); label.append(node('span', lesson.title), node('small', done.has(lesson.id) ? 'Concluída' : 'Aula ' + lesson.position))
    button.append(node('span', String(lesson.position).padStart(2, '0'), 'lesson-index'), label)
    button.addEventListener('click', () => open(lesson, true))
    item.append(button); list.append(item); buttons.set(lesson.id, { item, button, label })
  }
  function paint() {
    for (const [key, entry] of buttons) {
      const lesson = result.lessons.find(x => x.id === key)
      entry.item.classList.toggle('is-done', done.has(key)); entry.button.setAttribute('aria-current', String(key === current.id))
      entry.label.querySelector('small').textContent = done.has(key) ? 'Concluída' : 'Aula ' + lesson.position
    }
    toggle.textContent = done.has(current.id) ? 'Marcar como não concluída' : 'Marcar aula como concluída'
    const index = result.lessons.indexOf(current); next.hidden = index >= result.lessons.length - 1
    summary()
  }
  function open(lesson, focus) {
    current = lesson; feedback.textContent = ''
    player.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load() })
    player.replaceChildren()
    if (lesson.hasVideo) {
      const video = node('video'); video.controls = true; video.preload = 'metadata'; video.playsInline = true
      video.src = '/api/courses/' + id + '/lessons/' + encodeURIComponent(lesson.id) + '/media'
      video.setAttribute('aria-label', 'Vídeo: ' + lesson.title)
      video.addEventListener('error', () => { feedback.textContent = 'Não foi possível carregar o vídeo. Confira sua conexão ou entre novamente.' })
      player.append(video)
    } else player.append(node('p', 'O vídeo desta aula ainda está pendente.', 'course-player-empty'))
    copy.replaceChildren(node('p', 'Aula ' + lesson.position, 'eyebrow'), node('h2', lesson.title), ...(lesson.description ? [node('p', lesson.description)] : []))
    paint()
    if (focus) copy.querySelector('h2').setAttribute('tabindex', '-1'), copy.querySelector('h2').focus()
  }
  toggle.addEventListener('click', async () => {
    toggle.disabled = true; const complete = !done.has(current.id)
    const saved = await window.RVApi.request('/api/courses/' + id + '/lessons/' + encodeURIComponent(current.id) + '/progress', { method: 'PUT', body: { complete } })
    toggle.disabled = false
    if (!saved.ok) { feedback.textContent = saved.message; return }
    if (complete) done.add(current.id); else done.delete(current.id)
    feedback.textContent = complete ? 'Aula concluída. Progresso salvo.' : 'Conclusão removida.'; paint()
  })
  next.addEventListener('click', () => { const index = result.lessons.indexOf(current); if (result.lessons[index + 1]) open(result.lessons[index + 1], true) })
  open(current, false)
})()
