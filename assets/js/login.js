(() => {
  'use strict'

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const form = document.querySelector('[data-login-form]')
  const error = document.querySelector('[data-form-error]')
  const message = document.querySelector('[data-login-message]')
  const params = new URLSearchParams(location.search)

  const DB_KEY = 'rv-cursos-demo-db-v6'

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase()
  }

  function safeJson(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  function ensureDemoStudent(email, password) {
    const cfg = window.RV_COURSE_CONFIG
    const student = cfg?.demoStudent

    if (!cfg?.testMode || !student?.email) return

    const inputEmail = normalizeEmail(email)
    const configuredEmail = normalizeEmail(student.email)

    if (inputEmail !== configuredEmail || String(password || '') !== String(student.password || '')) {
      return
    }

    const now = new Date().toISOString()
    const db = safeJson(localStorage.getItem(DB_KEY), {
      version: 6,
      users: [],
      orders: [],
      audit: [],
      supportThreads: [],
      createdAt: now,
      updatedAt: now
    })

    db.version = 6
    db.users = Array.isArray(db.users) ? db.users : []
    db.orders = Array.isArray(db.orders) ? db.orders : []
    db.audit = Array.isArray(db.audit) ? db.audit : []
    db.supportThreads = Array.isArray(db.supportThreads) ? db.supportThreads : []
    db.createdAt = db.createdAt || now

    let user = db.users.find((item) => normalizeEmail(item.email) === configuredEmail)

    if (!user) {
      user = {
        id: 'usr_aluno_teste',
        name: student.name || 'Aluno Teste',
        email: configuredEmail,
        phone: '',
        password: String(student.password || '123456'),
        status: 'active',
        entitlements: ['rv30'],
        progress: { rv30: [] },
        comments: { rv30: {} },
        notes: [],
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null
      }

      db.users.push(user)
      db.audit.unshift({
        id: `log_demo_student_${Date.now()}`,
        action: 'demo_student_seeded',
        details: {
          userId: user.id,
          email: configuredEmail,
          courseId: 'rv30'
        },
        actor: 'system',
        at: now
      })
    } else {
      user.name = student.name || user.name || 'Aluno Teste'
      user.email = configuredEmail
      user.password = String(student.password || '123456')
      user.status = 'active'
      user.entitlements = Array.from(new Set([...(user.entitlements || []), 'rv30']))
      user.progress = user.progress && typeof user.progress === 'object' ? user.progress : {}
      user.progress.rv30 = Array.isArray(user.progress.rv30) ? user.progress.rv30 : []
      user.comments = user.comments && typeof user.comments === 'object' ? user.comments : {}
      user.comments.rv30 = user.comments.rv30 && typeof user.comments.rv30 === 'object'
        ? user.comments.rv30
        : {}
      user.notes = Array.isArray(user.notes) ? user.notes : []
      user.updatedAt = now
    }

    db.updatedAt = now
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  }

  function safeNext(value) {
    if (!value) return '/meus-cursos'

    try {
      const url = new URL(value, location.href)
      if (url.origin !== location.origin) return '/meus-cursos'

      const allowed = new Set([
        '/meus-cursos',
        '/aluno.html',
        '/area.html',
        '/aluno',
        '/curso/rv30',
        '/suporte'
      ])

      return allowed.has(url.pathname)
        ? `${url.pathname}${url.search}${url.hash}`
        : '/meus-cursos'
    } catch {
      return '/meus-cursos'
    }
  }

  const next = safeNext(params.get('next'))

  if (params.get('novo') === '1' && message) {
    message.textContent = 'Acesso criado. Entre agora com o e-mail da compra e a senha que você acabou de definir.'
  }

  if (auth?.isLoggedIn?.()) {
    location.replace(window.RVRoute?.resolve(next) || next)
    return
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (error) error.textContent = ''

    const data = new FormData(form)
    const email = data.get('email')
    const password = data.get('password')

    ensureDemoStudent(email, password)

    const result = auth.login(email, password)

    if (!result.ok) {
      if (error) error.textContent = result.message
      return
    }

    location.href = window.RVRoute?.resolve(next) || next
  })
})()
