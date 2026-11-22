// "Meus cursos": lista os cursos liberados para a conta, com progresso,
// vencimento e estado da matrícula vindos do servidor (/api/student/courses).
(() => {
  'use strict'
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined && text !== null) el.textContent = String(text); if (className) el.className = className; return el }
  const date = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : '—'
  const LABELS = { active: 'Acesso ativo', expired: 'Acesso expirado', revoked: 'Acesso encerrado', blocked: 'Conta bloqueada', scheduled: 'Começa em breve', none: 'Sem matrícula' }
  const NOTES = {
    expired: 'O prazo deste curso terminou. Fale com o suporte para renovar.',
    revoked: 'O acesso a este curso foi encerrado. Fale com o suporte se precisar de ajuda.',
    blocked: 'Sua conta está bloqueada. Fale com o suporte.',
    scheduled: 'Sua matrícula começa na data indicada.'
  }
  function card(course, index) {
    const article = node('article', null, 'course-card' + (course.status === 'active' ? '' : ' is-locked'))
    article.style.setProperty('--i', String(index))
    article.dataset.courseId = course.id
    const media = node('div', null, 'course-card-media')
    if (course.coverUrl) { const img = node('img'); img.src = course.coverUrl; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.addEventListener('error', () => img.remove()); media.append(img) }
    else media.append(node('span', course.title.split(/\s+/).slice(0, 2).map(x => x[0]).join(''), 'course-card-initial'))
    media.append(node('span', LABELS[course.status] || LABELS.none, 'course-pill course-pill--' + course.status + ' course-card-badge'))
    const body = node('div', null, 'course-card-body')
    body.append(node('h3', course.title))
    if (course.description) body.append(node('p', course.description, 'course-card-desc'))
    const meter = node('div', null, 'course-meter'), row = node('div', null, 'course-meter-row')
    const done = node('span'); done.append(node('strong', course.completedLessons), ' de ' + course.totalLessons + ' aulas concluídas')
    row.append(done, node('strong', course.percent + '%'))
    const bar = node('div', null, 'course-meter-bar'), fill = node('span')
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'Progresso em ' + course.title)
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(course.percent))
    fill.style.setProperty('--pct', String(course.percent)); bar.append(fill); meter.append(row, bar)
    const facts = node('p', null, 'course-card-facts')
    const until = node('span'); until.append(course.status === 'expired' ? 'Venceu em ' : 'Acesso até ', node('strong', date(course.expiresAt)))
    facts.append(until)
    if (course.availableLessons < course.totalLessons) facts.append(node('span', course.availableLessons + ' aulas publicadas'))
    body.append(meter, facts)
    if (course.status === 'active' && course.href) {
      const go = node('a', course.completedLessons ? 'Continuar assistindo' : 'Começar curso', 'button button--primary')
      go.href = course.href; go.setAttribute('aria-label', (course.completedLessons ? 'Continuar assistindo ' : 'Começar ') + course.title)
      body.append(go)
    } else {
      body.append(node('p', NOTES[course.status] || 'Este curso não está disponível para a sua conta.', 'course-card-note'))
      const help = node('a', 'Falar com o suporte', 'button button--ghost'); help.href = '/suporte'; body.append(help)
    }
    article.append(media, body)
    return article
  }
  async function mount(target) {
    const list = target.querySelector('[data-my-courses-list]')
    list.replaceChildren(node('div', null, 'skeleton'), node('div', null, 'skeleton'))
    list.setAttribute('aria-busy', 'true')
    const result = await window.RVApi.request('/api/student/courses')
    list.setAttribute('aria-busy', 'false')
    if (!result.ok) { if (result.code === 'API_NOT_FOUND') { target.hidden = true; return } const error = node('p', result.message, 'form-error'); error.setAttribute('role', 'alert'); list.replaceChildren(error); return }
    if (!result.courses.length) { list.replaceChildren(node('p', 'Nenhum curso foi liberado para esta conta ainda. Quando a equipe liberar um curso, ele aparecerá aqui.', 'course-empty')); return }
    const active = result.courses.filter(x => x.status === 'active').length
    target.querySelector('[data-my-courses-summary]').textContent = active + (active === 1 ? ' curso ativo' : ' cursos ativos') + ' · ' + result.courses.length + ' no total'
    list.replaceChildren(...result.courses.map(card))
  }
  window.RVStudentCourses = { mount }
})()
