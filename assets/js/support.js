(() => {
  'use strict'
  const store = window.RVCourseStore
  const admin = location.pathname === '/admin/suporte' || new URLSearchParams(location.search).get('perfil') === 'admin'
  const $ = (s) => document.querySelector(s)
  const allowed = () => admin ? store?.isAdminLoggedIn() : store?.isLoggedIn()
  const login = () => location.replace(window.RVRoute.resolve(admin ? '/admin/entrar' : '/entrar?next=/suporte'))
  if (!allowed()) { login(); return }
  const labels = { open: 'Aguardando equipe', answered: 'Respondida', resolved: 'Resolvida' }
  const format = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  let selected = null
  let signature = ''

  function node(tag, value, className) {
    const el = document.createElement(tag)
    if (value !== undefined) el.textContent = value
    if (className) el.className = className
    return el
  }
  function safely(action, errorTarget = '[data-error]') {
    $(errorTarget).textContent = ''
    try {
      const result = action()
      if (!result?.ok) $(errorTarget).textContent = result?.message || 'Não foi possível salvar. Entre novamente e tente de novo.'
      return result
    } catch {
      $(errorTarget).textContent = 'Não foi possível salvar neste navegador. Verifique o armazenamento e tente novamente.'
      return { ok: false }
    }
  }
  function render() {
    if (!allowed()) { login(); return }
    const threads = store.supportThreads(admin)
    const term = $('[data-search]').value.trim().toLocaleLowerCase('pt-BR')
    const filter = $('[data-filter]').value
    const visible = threads.filter((t) => `${t.subject} ${admin ? t.studentName : ''}`.toLocaleLowerCase('pt-BR').includes(term)
      && (filter === 'all' || (filter === 'unread' ? t.unread > 0 : t.status === filter)))
    const list = $('[data-threads]')
    list.replaceChildren()
    $('[data-count]').textContent = `${visible.length} conversas · ${threads.reduce((n, t) => n + t.unread, 0)} mensagens não lidas`
    if (!visible.length) list.append(node('p', 'Nenhuma conversa encontrada.', 'empty-copy'))
    visible.forEach((thread) => {
      const button = node('button', undefined, 'thread-item')
      button.type = 'button'
      button.setAttribute('aria-pressed', String(thread.id === selected))
      button.append(node('small', admin ? thread.studentName : 'Equipe RV'), node('strong', thread.subject), node('span', `${labels[thread.status]}${thread.unread ? ` · ${thread.unread} novas` : ''}`))
      button.addEventListener('click', () => {
        selected = thread.id
        safely(() => store.supportRead(selected, admin))
        signature = ''
        render()
      })
      list.append(button)
    })
    const current = threads.find((t) => t.id === selected)
    $('.support-layout').classList.toggle('is-reading', Boolean(current))
    $('[data-empty]').hidden = Boolean(current)
    $('[data-conversation]').hidden = !current
    if (!current) return
    if (current.unread && document.hasFocus() && !document.hidden) safely(() => store.supportRead(current.id, admin))
    $('[data-owner]').textContent = admin ? current.studentName : 'EQUIPE RV FISIOLOGIA'
    $('[data-subject]').textContent = current.subject
    $('[data-status]').textContent = labels[current.status]
    $('[data-resolve]').hidden = !admin || current.status === 'resolved'
    const nextSignature = JSON.stringify(current.messages)
    if (signature !== nextSignature) {
      const history = $('[data-messages]')
      const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 100
      history.replaceChildren(...current.messages.map((message) => {
        const article = node('article', undefined, `chat-message ${message.senderRole === (admin ? 'admin' : 'student') ? 'is-mine' : ''}`)
        const time = node('time', format(message.createdAt))
        time.dateTime = message.createdAt
        article.append(node('strong', message.senderRole === 'admin' ? 'Equipe RV' : current.studentName), node('p', message.body), time)
        return article
      }))
      if (!signature || nearBottom) history.scrollTop = history.scrollHeight
      signature = nextSignature
    }
  }

  if (admin) {
    $('[data-role-label]').textContent = 'Administração'
    $('[data-home]').href = '/admin'
    $('[data-back]').href = '/admin'
    $('[data-back]').textContent = 'Alunos'
    $('[data-support-link]').href = '/admin/suporte'
    $('[data-admin-only]').hidden = false
    $('[data-heading]').textContent = 'Central de suporte'
    $('[data-subheading]').textContent = 'Conversas, dúvidas e retornos aos alunos.'
    $('[data-new]').hidden = true
    $('[data-empty-copy]').textContent = 'Selecione uma conversa para ler e responder.'
  } else {
    const courses = window.RV_COURSE_CONFIG.courses.filter((c) => store.hasAccess(c.id))
    courses.forEach((course) => {
      const option = node('option', course.title)
      option.value = course.id
      $('[data-courses]').append(option)
    })
  }
  $('[data-new]').addEventListener('click', () => $('[data-new-dialog]').showModal())
  $('[data-inbox]').addEventListener('click', () => { selected = null; signature = ''; render(); $('[data-search]').focus() })
  $('[data-cancel]').addEventListener('click', () => $('[data-new-dialog]').close())
  $('[data-create]').addEventListener('submit', (event) => {
    event.preventDefault()
    const f = event.currentTarget.elements
    const result = safely(() => store.supportCreate(f.subject.value, f.body.value, f.courseId.value || null), '[data-create-error]')
    if (!result?.ok) return
    selected = result.threadId
    event.currentTarget.reset()
    $('[data-new-dialog]').close()
    render()
    $('[data-reply] textarea').focus()
  })
  $('[data-reply]').addEventListener('submit', (event) => {
    event.preventDefault()
    if (!selected) return
    if (safely(() => store.supportSend(selected, event.currentTarget.elements.body.value, admin))?.ok) {
      event.currentTarget.reset()
      render()
      $('[data-reply] textarea').focus()
    }
  })
  $('[data-resolve]').addEventListener('click', () => { safely(() => store.supportResolve(selected)); render() })
  $('[data-search]').addEventListener('input', render)
  $('[data-filter]').addEventListener('change', render)
  $('[data-exit]').addEventListener('click', () => { admin ? store.adminLogout() : store.logout(); login() })
  window.addEventListener('storage', (event) => { if (Object.values(store.storage).includes(event.key)) render() })
  window.addEventListener('focus', render)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render() })
  setInterval(() => { if (!allowed()) login() }, 30000)
  render()
})()
