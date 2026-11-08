(() => {
  'use strict'
  const config = window.RV_COURSE_CONFIG || {}
  let account = null
  let admin = false
  let course = { lessons: [], progress: [] }
  const api = window.RVApi = { serverMode: !config.testMode, configured: false, salesEnabled: false }
  api.request = async (path, { method = 'GET', body, headers = {}, keepalive = false } = {}) => {
    try {
      const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', keepalive,
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
    document.querySelector('[data-qa-account]')?.remove()
    if (account?.testAccount && !document.querySelector('main.auth-layout')) {
      const notice = document.createElement('p')
      notice.dataset.qaAccount = 'true'
      notice.className = 'rv-qa-notice'
      notice.textContent = result.isAdmin === true
        ? 'Administração de teste · gerencie a conta de aluno e consulte o progresso de validação. Nenhuma compra ou cobrança é registrada.'
        : api.platformMode ? 'Homologação privada · conta de validação, sem cobrança.' : 'Conta de teste · acesso de validação por 365 dias, sem cobrança. Seu progresso é salvo no servidor. Vídeos 1 a 29 disponíveis; dia 30 pendente.'
      document.querySelector('main')?.prepend(notice)
    }
    admin = result.ok && result.isAdmin === true
    document.querySelector('[data-role-context]')?.remove()
    if(api.platformIdentity&&admin){
      const link=document.createElement('a'),professional=location.pathname.startsWith('/admin')
      link.dataset.roleContext='true';link.className='button button--ghost';link.href=professional?'/meus-cursos':'/admin';link.textContent=professional?'Área do aluno':'Administração';link.title=professional?'Abrir a área do aluno com a mesma identidade':'Abrir o painel administrativo'
      document.querySelector('.course-header-actions, .admin-header-actions')?.prepend(link)
    }
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
    document.querySelectorAll('[data-access-duration]').forEach(el => { el.textContent = String(api.accessDurationDays || 365) })
    document.querySelectorAll('.price-total, .order-lines, .order-total, .order-daily-note').forEach(el => { el.hidden = !api.priceCents })
  }
  api.ready = (async () => {
    const status = await api.request('/api/config')
    api.configured = status.ok === true && status.configured === true
    api.qaOnly = api.configured && status.qaOnly === true
    api.platformMode = api.configured && status.platformMode === true
    api.platformIdentity = api.configured && status.platformIdentity === true
    api.platformAdmin = api.configured && status.platformAdmin === true
    api.serverMode = api.configured || !config.testMode
    api.salesEnabled = api.configured && status.salesEnabled === true
    const approvedProduct = config.courses?.find(product => product.id === 'rv30' && product.commercialApproved === true)
    const serverProduct = status.ok === true && status.product?.id === 'rv30' ? status.product : null
    api.priceCents = serverProduct?.currency === 'BRL' && Number.isInteger(serverProduct.priceCents) && serverProduct.priceCents > 0
      ? serverProduct.priceCents
      : approvedProduct?.currency === 'BRL' && Number.isInteger(approvedProduct.priceCents) && approvedProduct.priceCents > 0 ? approvedProduct.priceCents : null
    api.accessDurationDays = Number.isInteger(serverProduct?.accessDurationDays) && serverProduct.accessDurationDays > 0
      ? serverProduct.accessDurationDays
      : approvedProduct?.accessDurationDays || 365
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
        const days = [...new Set(course.progress.filter(day => Number.isInteger(day) && day >= 1 && day <= 30))]
        const completedDays = new Set(days)
        let nextDay = 1
        while (nextDay < 30 && completedDays.has(nextDay)) nextDay++
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
