(() => {
  'use strict'
  const node = (tag, text, className) => {
    const el = document.createElement(tag)
    if (text !== undefined) el.textContent = String(text)
    if (className) el.className = className
    return el
  }
  const date = value => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Não registrada'
  const lessonLink = (day, label) => {
    const link = node('a', label, 'text-link')
    link.href = `/curso/rv30?day=${Number(day)}`
    return link
  }
  const icon = (path) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '20'); svg.setAttribute('height', '20'); svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round')
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'stat-tile-icon')
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path'); el.setAttribute('d', path); svg.append(el)
    return svg
  }
  const ICONS = {
    check: 'M20 7 10 18l-5-5M4 13h4m8 0h4M4 7h4m8 0h4',
    clock: 'M12 7v5l3 3M12 2a10 10 0 1 0 .001 0Z',
    play: 'M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z',
    pulse: 'M3 12h4l2-7 4 14 2-7h6',
    lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5v-9Z',
    trophy: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5'
  }

  window.RVStudentDashboard = { async mount(grid) {
    grid.classList.add('student-overview')
    grid.setAttribute('aria-busy', 'true')
    grid.replaceChildren(node('p', 'Carregando seu programa…', 'portal-lead'))
    const result = await window.RVApi.request('/api/student/dashboard')
    grid.setAttribute('aria-busy', 'false')
    if (!result.ok) {
      const error = node('p', result.message, 'form-error')
      error.setAttribute('role', 'alert'); grid.replaceChildren(error); return
    }
    grid.replaceChildren()
    const lead = document.querySelector('.student-hero-lead')
    if (lead) lead.textContent = 'Seu programa, suas aulas e o progresso registrado na sua conta.'
    const availableDays = Array.isArray(result.course.availableDays) ? result.course.availableDays : []
    const completedDaySet = new Set(result.history.filter((item) => item.completed).map((item) => item.day))

    const card = node('article', undefined, 'student-program glass')
    const heading = node('div', undefined, 'student-program-heading')
    const logo = node('img'); logo.src = '/assets/brand/rv30-logo.png'; logo.alt = 'RV 30'; logo.width = 76; logo.height = 76
    const copy = node('div')
    copy.append(node('p', result.enrollment.source === 'owner_validation' ? 'ACESSO DE HOMOLOGAÇÃO' : 'SEU PROGRAMA', 'eyebrow'), node('h3', result.course.title))
    heading.append(logo, copy); card.append(heading)
    const statuses = { active: 'Matrícula ativa', revoked: 'Acesso revogado', expired: 'Acesso expirado', none: 'Sem matrícula', scheduled: 'Acesso com início agendado', restricted: 'Acesso em análise' }
    card.append(node('p', statuses[result.enrollment.status] || 'Acesso em análise', 'status-label'))

    const body = node('div', undefined, 'student-program-body')
    const ring = node('div', undefined, 'progress-ring')
    ring.style.setProperty('--pct', String(Math.max(0, Math.min(100, result.progress.percent))))
    ring.append(node('strong', `${result.progress.percent}%`))
    ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `${result.progress.percent}% do programa concluído`)
    const copyWrap = node('div', undefined, 'student-progress-copy')
    const facts = node('dl', undefined, 'student-enrollment-facts')
    for (const [label, value] of [['Início do acesso', date(result.enrollment.startsAt)], ['Acesso até', date(result.enrollment.expiresAt)]]) {
      const row = node('div'); row.append(node('dt', label), node('dd', value)); facts.append(row)
    }
    copyWrap.append(facts)
    const strip = node('div', undefined, 'day-strip')
    strip.setAttribute('role', 'img')
    strip.setAttribute('aria-label', `${result.progress.completedDays} de 30 dias concluídos`)
    const weekSizes = [7, 7, 7, 7, 2]
    let dayNumber = 0
    for (const size of weekSizes) {
      const week = node('div', undefined, 'day-strip-week')
      for (let i = 0; i < size; i++) {
        dayNumber++
        const tick = node('span')
        if (completedDaySet.has(dayNumber)) tick.classList.add('is-done')
        else if (result.resume && dayNumber === result.resume.day) tick.classList.add('is-current')
        week.append(tick)
      }
      strip.append(week)
    }
    copyWrap.append(strip, node('p', `${result.progress.completedDays} de 30 aulas concluídas · ${result.progress.percent}%`, 'student-progress-caption'))
    if (result.resume && Number.isInteger(result.resume.day)) {
      const link = lessonLink(result.resume.day, result.activity.lastLessonDay ? 'Continuar de onde parei' : 'Começar meu programa')
      link.className = 'button button--primary'; copyWrap.append(link)
    }
    body.append(ring, copyWrap); card.append(body)

    const metrics = node('section', undefined, 'student-activity-summary'); metrics.setAttribute('aria-label', 'Sua atividade registrada')
    const seconds = result.activity.validatedSeconds
    for (const [label, value, detail, iconKey] of [
      ['Aulas concluídas', `${result.progress.completedDays}/30`, 'Conclusões marcadas na sua conta', 'check'],
      ['Tempo de atividade', seconds ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : '0 min', 'Intervalos de reprodução validados pelo servidor', 'clock'],
      ['Última aula', result.activity.lastLessonDay ? `Dia ${result.activity.lastLessonDay}` : 'Ainda não iniciada', 'Última aula aberta nesta conta', 'play'],
      ['Última atividade', result.activity.lastActivityAt ? date(result.activity.lastActivityAt) : 'Sem registro', 'Os dados aparecem depois de acessar uma aula', 'pulse']
    ]) {
      const item = node('article'); item.append(icon(ICONS[iconKey]), node('p', label), node('strong', value), node('small', detail)); metrics.append(item)
    }
    grid.append(card, metrics)

    const plan = node('section', undefined, 'student-plan'); plan.id = 'plano-30-dias'
    plan.append(node('h3', 'Seu plano de 30 dias'))
    const planGrid = node('div', undefined, 'admin-days-grid student-days-grid')
    for (let day = 1; day <= 30; day++) {
      const isDone = completedDaySet.has(day)
      const isCurrent = !isDone && result.resume?.day === day
      const isAvailable = availableDays.includes(day)
      const cellClass = `admin-day${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`
      if (isAvailable || isDone) {
        const cell = lessonLink(day, '')
        cell.className = cellClass
        cell.append(node('span', String(day)))
        if (isDone) cell.append(icon(ICONS.check))
        else if (isCurrent) cell.append(icon(ICONS.play))
        cell.setAttribute('aria-label', `Dia ${day}${isDone ? ', concluído' : isCurrent ? ', continuar aqui' : ''}`)
        planGrid.append(cell)
      } else {
        const cell = node('span', undefined, `${cellClass} is-locked`)
        cell.append(node('span', String(day)), icon(ICONS.lock))
        cell.setAttribute('aria-label', `Dia ${day}, ainda não disponível`)
        planGrid.append(cell)
      }
    }
    plan.append(node('p', 'Escolha um dia disponível. O cadeado indica uma aula indisponível.', 'plan-key'), planGrid); grid.append(plan)

    if (result.resume && Number.isInteger(result.resume.day)) {
      const next = node('article', undefined, 'student-next-lesson')
      next.append(node('h3', 'Próxima aula'))
      const media = node('figure', undefined, 'student-next-lesson-media')
      const img = node('img'); img.src = '/assets/brand/rv30-training-hero.webp'; img.alt = ''; img.loading = 'lazy'
      const dayBadge = node('span', `Dia ${result.resume.day}`, 'student-next-lesson-badge')
      media.append(img, dayBadge)
      next.append(media, node('small', 'Imagem ilustrativa do programa', 'rv30-preview-note'))
      const watchLink = lessonLink(result.resume.day, 'Assistir agora')
      watchLink.className = 'button button--primary button--wide'
      next.append(watchLink)
      grid.prepend(next)
    }

    const achievements = node('section', undefined, 'student-achievements')
    achievements.append(node('h3', 'Conquistas'))
    const achievementList = node('ul', undefined, 'student-achievements-list')
    for (const [threshold, title, detail] of [
      [1, 'Primeira aula concluída', 'Você deu o primeiro passo no programa.'],
      [15, 'Metade do caminho', '15 de 30 aulas concluídas.'],
      [30, 'Programa concluído', 'Você concluiu os 30 dias do RV 30.']
    ]) {
      const unlocked = result.progress.completedDays >= threshold
      const item = node('li', undefined, unlocked ? 'is-unlocked' : 'is-locked')
      const copyEl = node('div'); copyEl.append(node('strong', title), node('small', detail))
      item.append(icon(unlocked ? ICONS.trophy : ICONS.lock), copyEl)
      achievementList.append(item)
    }
    achievements.append(achievementList); grid.append(achievements)

    const history = node('section', undefined, 'student-history')
    history.append(node('h3', 'Seu histórico de aulas'))
    if (!result.history.length) history.append(node('p', 'Você ainda não abriu uma aula. Comece pelo primeiro dia para registrar seu histórico.', 'portal-lead'))
    else {
      const list = node('ul', undefined, 'student-history-list')
      for (const item of result.history) {
        const row = node('li')
        row.append(lessonLink(item.day, `Dia ${item.day}`), node('span', `${item.completed ? 'Concluída' : 'Em andamento'} · ${date(item.lastOpenedAt)}`))
        list.append(row)
      }
      history.append(list)
    }
    const support = node('a', 'Falar com a equipe', 'text-link'); support.href = '/suporte'; history.append(support)
    achievements.before(history)
    for (const message of result.messages) {
      if (message.kind === 'privacy') {
        const details = node('details', undefined, 'student-privacy')
        details.append(node('summary', 'Como registramos sua atividade'), node('p', message.text)); grid.append(details)
      } else { const notice = node('p', message.text, 'environment-note'); notice.setAttribute('role', 'status'); grid.append(notice) }
    }
  } }
})()
