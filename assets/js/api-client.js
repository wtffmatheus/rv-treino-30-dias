(() => {
  'use strict'
  const config = window.RV_COURSE_CONFIG || {}
  let account = null
  let admin = false
  let course = { lessons: [], progress: [] }
  const api = window.RVApi = { serverMode: !config.testMode, configured: false, salesEnabled: false }
  api.request = async (path, { method = 'GET', body, headers = {} } = {}) => {
    try {
      const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) })
      const result = await response.json()
      return response.ok ? result : { ok: false, message: result.message || 'Não foi possível concluir. Tente novamente.', code: result.code }
    } catch { return { ok: false, message: 'O serviço de acesso está indisponível. Tente novamente em instantes.' } }
  }
  const unavailable = () => ({ ok: false, message: 'Este recurso ainda está em preparação.' })
  api.refresh = async () => {
    const result = await api.request('/api/account')
    account = result.ok ? result.account : null
    admin = result.ok && result.isAdmin === true
    course = { lessons: [], progress: [] }
    if (account?.entitlements?.includes('rv30')) {
      const catalog = await api.request('/api/courses/rv30')
      if (catalog.ok) course = catalog
    }
    return result
  }
  api.account = () => account
  api.course = () => course
  api.logout = async () => {
    const result = await window.RVCourseStore.logout()
    if (!result.ok) throw new Error(result.message || 'Não foi possível encerrar a sessão. Tente novamente.')
    return result
  }
  api.applyPricing = () => {
    if (!api.serverMode) return
    const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
    document.querySelectorAll('[data-price-total], [data-order-total]').forEach(el => { el.textContent = api.priceCents ? money(api.priceCents) : 'A confirmar' })
    document.querySelectorAll('[data-price-daily], [data-order-daily]').forEach(el => { el.textContent = api.priceCents ? money(api.priceCents / 30) : 'A confirmar' })
    document.querySelectorAll('.price-total, .order-lines, .order-total, .order-daily-note').forEach(el => { el.hidden = !api.priceCents })
  }
  api.ready = (async () => {
    const status = await api.request('/api/config')
    api.configured = status.ok === true && status.configured === true
    api.serverMode = api.configured || !config.testMode
    api.salesEnabled = api.configured && status.salesEnabled === true
    api.priceCents = api.salesEnabled && Number.isInteger(status.product?.priceCents) && status.product.priceCents > 0 ? status.product.priceCents : null
    if (!api.serverMode) return
    // Real sessions never read the demonstration database, even on localhost.
    config.testMode = false
    config.enablePaymentSimulation = false
    config.salesEnabled = api.salesEnabled
    api.applyPricing()
    document.querySelectorAll('[data-test-env]').forEach(el => el.remove())
    document.documentElement.classList.remove('rv-test-mode')
    window.RVCourseStore = {
      account: () => account,
      isLoggedIn: () => Boolean(account),
      hasAccess: id => Boolean(account?.entitlements?.includes(id)),
      isAdminLoggedIn: () => admin,
      adminAccount: () => admin ? account : null,
      login: async (email, password) => {
        const result = await api.request('/api/auth/login', { method: 'POST', body: { email, password } })
        if (result.ok) await api.refresh()
        return result
      },
      adminLogin: async (email, password) => {
        const result = await window.RVCourseStore.login(email, password)
        if (!result.ok) return result
        if (!admin) {
          await window.RVCourseStore.logout()
          return { ok: false, message: 'Esta conta não tem autorização administrativa.' }
        }
        return result
      },
      logout: async () => {
        const result = await api.request('/api/auth/logout', { method: 'POST', body: {} })
        if (!result.ok && !['AUTH_REQUIRED', 'SESSION_INVALID', 'ACCOUNT_BLOCKED', 'EMAIL_UNVERIFIED'].includes(result.code)) return result
        account = null; admin = false; course = { lessons: [], progress: [] }
        return { ok: true }
      },
      adminLogout: async () => window.RVCourseStore.logout(),
      progress: () => [...course.progress],
      courseProgressSummary: () => {
        const days = course.progress.filter(day => day >= 1 && day <= 30)
        let nextDay = 0
        while (nextDay < 30 && course.progress.includes(nextDay)) nextDay++
        return { completed: days.length, percent: Math.round(days.length / 30 * 100), nextDay }
      },
      setDayComplete: async (id, day, complete) => {
        if (id !== 'rv30') return unavailable()
        const result = await api.request(`/api/courses/rv30/progress/${day}`, { method: 'PUT', body: { complete } })
        if (result.ok) course.progress = complete ? [...new Set([...course.progress, day])] : course.progress.filter(value => value !== day)
        return result
      },
      comments: () => [], addComment: unavailable,
      supportThreads: () => [], supportCreate: unavailable, supportSend: unavailable, supportRead: unavailable,
      orderById: id => api.request(`/api/orders/${encodeURIComponent(id)}`), currentOrder: () => null,
      userByEmail: () => null, db: () => null
    }
    if (api.configured) await api.refresh()
  })()
})()
