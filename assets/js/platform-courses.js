// Administração multi-curso: cadastro de aluno com seleção de cursos,
// matrículas por curso (liberar/renovar/revogar) e catálogo de cursos.
// Toda regra é aplicada no servidor; esta camada só apresenta e envia.
(() => {
  'use strict'
  const U = () => window.RVPlatformUI
  const STATES = { draft: ['Rascunho', 'muted'], published: ['Publicado', 'active'], unpublished: ['Despublicado', 'pending'], archived: ['Arquivado', 'danger'] }
  const ENROLL = { active: ['Ativa', 'active'], expired: ['Expirada', 'pending'], revoked: ['Revogada', 'danger'], scheduled: ['Agendada', 'pending'], blocked: ['Conta bloqueada', 'danger'], none: ['Sem matrícula', 'muted'] }
  const DURATIONS = [[30, '30 dias'], [90, '90 dias'], [180, '6 meses'], [365, '1 ano'], [730, '2 anos']]
  const durationSelect = (name, value = 365) => {
    const { el } = U(), select = el('select'); select.name = name
    for (const [days, label] of DURATIONS) { const option = el('option', label); option.value = String(days); option.selected = days === value; select.append(option) }
    return select
  }
  async function courses() { return (await U().request('/api/admin/courses')).courses }

  // Formulário "Novo aluno" com escolha de cursos e duração individual.
  async function createStudentForm(onDone) {
    const { el, field, status, request, pill } = U(), list = await courses()
    const form = el('form', null, 'platform-form student-create'); form.dataset.studentCreate = ''
    const name = field('Nome completo', 'name', '', 'text', { required: true, maxLength: 120 }), email = field('E-mail', 'email', '', 'email', { required: true, maxLength: 254 }), phone = field('Telefone (opcional)', 'phone', '', 'tel', { maxLength: 40 })
    name.input.autocomplete = 'off'; email.input.autocomplete = 'off'
    const picker = el('fieldset', null, 'course-picker'); picker.append(el('legend', 'Cursos liberados'))
    const hint = el('p', 'Escolha um ou mais cursos e a validade de cada matrícula. A liberação administrativa não registra pagamento.', 'platform-hint')
    picker.append(hint)
    for (const course of list.filter(x => x.state !== 'archived')) {
      const row = el('label', null, 'course-option'); row.dataset.courseOption = course.id
      const check = el('input'); check.type = 'checkbox'; check.name = 'course'; check.value = course.id
      const copy = el('span', null, 'course-option-copy'); copy.append(el('strong', course.title), el('small', course.id === 'rv30' ? '30 aulas · programa principal' : course.published_lessons + ' aula(s) publicada(s)'))
      const duration = durationSelect('days-' + course.id); duration.disabled = true; duration.setAttribute('aria-label', 'Validade da matrícula em ' + course.title)
      check.addEventListener('change', () => { duration.disabled = !check.checked; row.classList.toggle('is-selected', check.checked) })
      row.append(check, copy, course.state === 'published' ? pill('Publicado', 'active') : pill(STATES[course.state][0], STATES[course.state][1]), duration)
      picker.append(row)
    }
    const invite = field('Enviar convite de ativação por e-mail (o aluno define a própria senha)', 'invite', true, 'checkbox')
    const feedback = status(), submit = el('button', 'Cadastrar aluno', 'button button--primary'); submit.type = 'submit'
    form.append(el('h3', 'Novo aluno'), name.wrapper, email.wrapper, phone.wrapper, picker, invite.wrapper, el('p', 'Nenhuma senha é criada ou exibida para a equipe.', 'platform-hint'), submit, feedback)
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!form.reportValidity()) return
      const chosen = [...form.querySelectorAll('input[name=course]:checked')].map(x => ({ id: x.value, days: Number(form.querySelector('[name="days-' + x.value + '"]').value) }))
      submit.disabled = true; submit.setAttribute('aria-busy', 'true'); feedback.textContent = 'Cadastrando…'
      try {
        const result = await window.RVApi.request('/api/admin/students', { method: 'POST', body: { name: name.input.value, email: email.input.value, phone: phone.input.value, courses: chosen, sendInvite: invite.input.checked } })
        if (!result.ok) {
          feedback.textContent = result.message
          if (result.code === 'EMAIL_EXISTS' && result.existingId) { const open = el('button', 'Abrir cadastro existente', 'button button--secondary'); open.type = 'button'; open.addEventListener('click', () => onDone(result.existingId)); feedback.append(' ', open) }
          return
        }
        feedback.textContent = result.message; await onDone(result.id, result.message)
      } finally { submit.disabled = false; submit.removeAttribute('aria-busy') }
    })
    return form
  }

  // Matrículas de um aluno, uma linha por curso.
  async function enrollmentsCard(id, detail, reload) {
    const { el, card, table, pill, date, status, button, run } = U(), all = await courses(), feedback = status()
    const section = card('Cursos e matrículas'); section.dataset.enrollments = ''
    section.append(el('p', 'Cada curso tem validade própria. Alterar matrículas não muda a senha nem encerra a sessão do aluno. Matrículas de compra seguem o provedor de pagamento.', 'platform-hint'))
    const rows = detail.courses.map(x => {
      const actions = el('div', null, 'enrollment-actions'), days = durationSelect('renew-' + x.courseId, 365)
      days.setAttribute('aria-label', 'Duração para ' + x.title)
      const act = (label, body, tone) => button(label, btn => run(btn, feedback, async () => { await U().request('/api/admin/students/' + id + '/enrollments/' + x.courseId, { method: 'PUT', body: { ...body, days: body.action === 'revoke' ? undefined : Number(days.value) } }); await reload() }), tone)
      if (x.source !== 'payment') actions.append(days, act(x.status === 'active' ? 'Renovar' : 'Liberar', { action: x.status === 'active' ? 'renew' : 'grant' }, 'button button--secondary'))
      if (x.status === 'active' || x.status === 'scheduled') actions.append(act('Revogar', { action: 'revoke' }, 'button button--ghost'))
      const progress = el('span', x.completed + ' de ' + x.total + ' aulas · ' + x.percent + '%')
      return [el('strong', x.title), pill(...(ENROLL[x.status] || ENROLL.none)), x.source === 'payment' ? 'Compra' : x.source === 'owner_validation' ? 'Homologação' : 'Administrativa', date(x.startsAt) + ' → ' + date(x.expiresAt), progress, actions]
    })
    section.append(rows.length ? table(['Curso', 'Situação', 'Origem', 'Período', 'Progresso', 'Ações'], rows) : el('p', 'Nenhuma matrícula. Libere um curso abaixo.', 'platform-empty'))
    const enrolled = new Set(detail.courses.map(x => x.courseId)), available = all.filter(x => !enrolled.has(x.id) && x.state !== 'archived')
    if (available.length) {
      const add = el('form', null, 'enrollment-add'), select = el('select'); select.name = 'course'; select.setAttribute('aria-label', 'Curso a liberar')
      for (const course of available) { const option = el('option', course.title + (course.state === 'published' ? '' : ' (' + STATES[course.state][0].toLowerCase() + ')')); option.value = course.id; select.append(option) }
      const days = durationSelect('days', 365); days.setAttribute('aria-label', 'Validade da nova matrícula')
      const submit = el('button', 'Liberar curso', 'button button--primary'); submit.type = 'submit'
      add.append(el('span', 'Liberar outro curso', 'enrollment-add-label'), select, days, submit)
      add.addEventListener('submit', event => { event.preventDefault(); run(submit, feedback, async () => { await U().request('/api/admin/students/' + id + '/enrollments/' + select.value, { method: 'PUT', body: { action: 'grant', days: Number(days.value) } }); await reload() }) })
      section.append(add)
    }
    section.append(feedback)
    return section
  }

  // Envio do convite por e-mail a partir da ficha do aluno.
  function emailInvite(id, enabled, verified) {
    const { el, button, status } = U(), feedback = status(), box = el('div', null, 'platform-actions')
    if (!enabled) { box.append(el('p', 'Envio por e-mail ainda não ativado no servidor. Use o link privado abaixo.', 'platform-hint')); return box }
    box.append(button(verified ? 'Enviar recuperação de senha por e-mail' : 'Enviar convite de ativação por e-mail', async btn => { btn.disabled = true; feedback.textContent = 'Enviando…'; const result = await window.RVApi.request('/api/admin/identity-tokens', { method: 'POST', body: { userId: id, purpose: verified ? 'recovery' : 'invitation', delivery: 'email' } }); btn.disabled = false; feedback.textContent = result.message || (result.ok ? 'Enviado.' : 'Não foi possível enviar.') }, 'button button--primary'), feedback)
    return box
  }

  // Catálogo de cursos e aulas.
  async function coursesView(target, navigate, selected) {
    const { el, card, table, pill, date, field, form, button, status, request, run } = U()
    const list = await courses(), media = (await request('/api/admin/media')).media.filter(x => x.state === 'ready')
    const wrap = el('div'); wrap.dataset.courseAdmin = ''
    target.replaceChildren(el('h1', 'Cursos'), el('p', 'Crie cursos, publique aulas com vídeos validados e acompanhe as matrículas. O RV 30 continua sendo editado em “Curso e aulas”.', 'environment-note'), wrap)
    const grid = el('div', null, 'admin-course-grid')
    for (const course of list) {
      const item = el('article', null, 'admin-course-card' + (course.id === selected ? ' is-selected' : ''))
      item.append(pill(...STATES[course.state]), el('h2', course.title), el('p', course.description || 'Sem descrição.'), el('p', `${course.published_lessons}/${course.lessons} aula(s) publicada(s) · ${course.enrollments} matrícula(s)`, 'platform-hint'))
      const open = button(course.id === 'rv30' ? 'Editar em Curso e aulas' : 'Gerenciar curso', () => course.id === 'rv30' ? navigate('content') : coursesView(target, navigate, course.id), 'button button--secondary')
      item.append(open); grid.append(item)
    }
    wrap.append(grid)
    const creation = form('Novo curso', [field('Nome do curso', 'title', '', 'text', { required: true, maxLength: 160 }), field('Descrição', 'description', '', 'textarea', { maxLength: 4000 })], 'Criar curso em rascunho', async (data, state) => { const created = await request('/api/admin/courses', { method: 'POST', body: data }); state.textContent = 'Curso criado.'; await coursesView(target, navigate, created.id) })
    const details = el('details', null, 'platform-editor-details'); details.append(el('summary', 'Criar novo curso'), card('Novo curso', creation)); wrap.append(details)
    if (!selected || selected === 'rv30') return
    const data = await request('/api/admin/courses/' + selected + '/lessons'), course = data.course, feedback = status()
    const choices = kind => [{ value: '', label: 'Nenhuma' }, ...media.filter(x => x.kind === kind).map(x => ({ value: x.id, label: x.label }))]
    const info = form('Dados do curso', [field('Nome', 'title', course.title, 'text', { required: true, maxLength: 160 }), field('Descrição', 'description', course.description, 'textarea', { maxLength: 4000 }), field('Capa (imagem validada)', 'coverId', course.cover_media_id || '', 'select', { choices: choices('image') }), field('Posição no catálogo', 'position', course.position, 'number', { min: 1, max: 1000, required: true })], 'Salvar curso', async (values, state) => {
      await request('/api/admin/courses/' + course.id, { method: 'PATCH', body: { title: values.title, description: values.description, coverId: values.coverId || null, position: Number(values.position), revision: course.revision } }); state.textContent = 'Curso salvo.'; await coursesView(target, navigate, course.id)
    })
    info.querySelector('[name=coverId]').value = course.cover_media_id || ''
    const states = el('div', null, 'platform-actions')
    for (const [state, label] of [['published', 'Publicar curso'], ['unpublished', 'Despublicar'], ['archived', 'Arquivar']]) if (state !== course.state) states.append(button(label, btn => run(btn, feedback, async () => { await request('/api/admin/courses/' + course.id, { method: 'PATCH', body: { state, revision: course.revision } }); await coursesView(target, navigate, course.id) }), state === 'archived' ? 'button button--ghost' : 'button button--secondary'))
    const panel = card('Gerenciar: ' + course.title, pill(...STATES[course.state]), info, states, feedback)
    const lessonRows = data.lessons.map(lesson => [String(lesson.position).padStart(2, '0'), lesson.title, lesson.media_id ? 'Vídeo associado' : 'Sem vídeo', lesson.published ? pill('Publicada', 'active') : pill('Rascunho', 'muted'), button(lesson.published ? 'Despublicar' : 'Publicar', btn => run(btn, feedback, async () => { await request('/api/admin/courses/' + course.id + '/lessons/' + lesson.id, { method: 'PATCH', body: { published: !lesson.published } }); await coursesView(target, navigate, course.id) }), 'button button--ghost')])
    panel.append(el('h3', 'Aulas'), lessonRows.length ? table(['Ordem', 'Título', 'Vídeo', 'Situação', 'Ação'], lessonRows) : el('p', 'Nenhuma aula cadastrada.', 'platform-empty'))
    const next = (data.lessons.at(-1)?.position || 0) + 1
    panel.append(form('Nova aula', [field('Título', 'title', '', 'text', { required: true, maxLength: 160 }), field('Descrição', 'description', '', 'textarea', { maxLength: 4000 }), field('Posição', 'position', next, 'number', { min: 1, max: 500, required: true }), field('Vídeo validado da biblioteca', 'mediaId', '', 'select', { choices: choices('video') }), field('Capa da aula', 'coverId', '', 'select', { choices: choices('image') }), field('Publicar agora (exige vídeo)', 'published', false, 'checkbox')], 'Adicionar aula', async (values, state) => { await request('/api/admin/courses/' + course.id + '/lessons', { method: 'POST', body: { title: values.title, description: values.description, position: Number(values.position), mediaId: values.mediaId || null, coverId: values.coverId || null, published: values.published === 'on' } }); state.textContent = 'Aula adicionada.'; await coursesView(target, navigate, course.id) }))
    panel.append(el('p', 'Envie e aprove vídeos e capas em “Biblioteca”. Arquivos continuam privados e só são entregues a alunos com matrícula ativa. Última alteração: ' + date(course.updated_at) + '.', 'platform-hint'))
    wrap.prepend(panel)
  }
  window.RVPlatformCourses = { createStudentForm, enrollmentsCard, emailInvite, coursesView }
})()
