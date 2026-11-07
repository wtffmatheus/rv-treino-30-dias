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
    const lead = document.querySelector('.student-welcome > p:last-child')
    if (lead) lead.textContent = 'Seu programa, suas aulas e o progresso registrado na sua conta.'
    const card = node('article', undefined, 'student-program')
    const heading = node('div', undefined, 'student-program-heading')
    const logo = node('img'); logo.src = '/assets/brand/rv30-logo.png'; logo.alt = 'RV 30'; logo.width = 76; logo.height = 76
    const copy = node('div')
    copy.append(node('p', result.enrollment.source === 'owner_validation' ? 'ACESSO DE HOMOLOGAÇÃO' : 'SEU PROGRAMA', 'eyebrow'), node('h3', result.course.title))
    heading.append(logo, copy); card.append(heading)
    const statuses = { active: 'Matrícula ativa', revoked: 'Acesso revogado', expired: 'Acesso expirado', none: 'Sem matrícula' }
    card.append(node('p', statuses[result.enrollment.status] || 'Acesso em análise', 'status-label'))
    const facts = node('dl', undefined, 'student-enrollment-facts')
    for (const [label, value] of [['Início do acesso', date(result.enrollment.startsAt)], ['Acesso até', date(result.enrollment.expiresAt)]]) {
      const row = node('div'); row.append(node('dt', label), node('dd', value)); facts.append(row)
    }
    card.append(facts)
    const progress = node('progress', undefined, 'native-progress'); progress.max = 30; progress.value = result.progress.completedDays
    progress.setAttribute('aria-label', 'Progresso no RV 30')
    card.append(progress, node('p', `${result.progress.completedDays} de 30 aulas concluídas · ${result.progress.percent}%`, 'student-progress-caption'))
    if (result.resume && Number.isInteger(result.resume.day)) {
      const link = lessonLink(result.resume.day, result.activity.lastLessonDay ? 'Continuar de onde parei' : 'Começar meu programa')
      link.className = 'button button--primary'; card.append(link)
    }
    const metrics = node('section', undefined, 'student-activity-summary'); metrics.setAttribute('aria-label', 'Sua atividade registrada')
    const seconds = result.activity.validatedSeconds
    for (const [label, value, detail] of [
      ['Aulas concluídas', `${result.progress.completedDays}/30`, 'Conclusões marcadas na sua conta'],
      ['Tempo de atividade', seconds ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : '0 min', 'Intervalos de reprodução validados pelo servidor'],
      ['Última aula', result.activity.lastLessonDay ? `Dia ${result.activity.lastLessonDay}` : 'Ainda não iniciada', 'Última aula aberta nesta conta'],
      ['Última atividade', result.activity.lastActivityAt ? date(result.activity.lastActivityAt) : 'Sem registro', 'Os dados aparecem depois de acessar uma aula']
    ]) {
      const item = node('article'); item.append(node('p', label), node('strong', value), node('small', detail)); metrics.append(item)
    }
    grid.append(card, metrics)
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
    const upcoming = node('section', undefined, 'student-upcoming')
    upcoming.append(node('h3', 'Próximas aulas'))
    if (result.upcoming.length) {
      const list = node('ul')
      for (const day of result.upcoming) { const item = node('li'); item.append(lessonLink(day, `Dia ${day}`)); list.append(item) }
      upcoming.append(list)
    } else upcoming.append(node('p', 'Não há novas aulas disponíveis nesta sequência.'))
    const support = node('a', 'Falar com a equipe', 'text-link'); support.href = '/suporte'; upcoming.append(support)
    grid.append(history, upcoming)
    for (const message of result.messages) {
      if (message.kind === 'privacy') {
        const details = node('details', undefined, 'student-privacy')
        details.append(node('summary', 'Como registramos sua atividade'), node('p', message.text)); grid.append(details)
      } else { const notice = node('p', message.text, 'environment-note'); notice.setAttribute('role', 'status'); grid.append(notice) }
    }
  } }
})()
