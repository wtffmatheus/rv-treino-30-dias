(() => {
  'use strict'

  const STORAGE = {
    db: 'rv-cursos-demo-db-v6',
    session: 'rv-cursos-demo-session-v6',
    adminSession: 'rv-cursos-demo-admin-session-v6',
    currentOrder: 'rv-cursos-demo-current-order-v6'
  }
  const LEGACY = {
    account: 'rv-cursos-demo-account-v4',
    order: 'rv-cursos-demo-order-v4'
  }
  const SESSION_HOURS = 8
  const ADMIN_SESSION_HOURS = 4

  const demoEnabled = () => window.RV_COURSE_CONFIG?.testMode === true
  const nowIso = () => new Date().toISOString()
  const uid = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
  const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
  const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 15)
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))
  const clone = (value) => JSON.parse(JSON.stringify(value))
  const courseConfig = (courseId = 'rv30') => window.RV_COURSE_CONFIG?.courses?.find((course) => course.id === courseId) || null
  const courseTotalDays = (courseId = 'rv30') => Math.max(1, Number(courseConfig(courseId)?.totalDays || 30))
  const coursePriceCents = (courseId = 'rv30') => Math.max(0, Number(courseConfig(courseId)?.priceCents || 0))

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
  }

  function emptyDb() {
    return { version: 6, users: [], orders: [], audit: [], createdAt: nowIso(), updatedAt: nowIso() }
  }

  function ensureDbShape(value) {
    const db = value && typeof value === 'object' ? value : emptyDb()
    db.version = 6
    db.users = Array.isArray(db.users) ? db.users : []
    db.orders = Array.isArray(db.orders) ? db.orders : []
    db.audit = Array.isArray(db.audit) ? db.audit : []
    db.supportThreads = Array.isArray(db.supportThreads) ? db.supportThreads : []
    db.createdAt = db.createdAt || nowIso()
    db.updatedAt = db.updatedAt || nowIso()
    return db
  }

  function migrateLegacyIfNeeded(db) {
    if (db.users.length || db.orders.length) return db

    const oldAccount = readJson(LEGACY.account)
    const oldOrder = readJson(LEGACY.order)
    if (!oldAccount && !oldOrder) return db

    let userId = null
    if (oldAccount?.email) {
      const normalizedEmail = normalizeEmail(oldAccount.email)
      const legacyOwnerKey = normalizedEmail.replace(/[^a-z0-9]+/g, '-')
      const legacyProgress = readJson(`rv30-progress-v4-${legacyOwnerKey}`, [])
      const legacyComments = readJson(`rv30-comments-v4-${legacyOwnerKey}`, {})
      const safeProgress = Array.isArray(legacyProgress)
        ? legacyProgress.filter((day) => Number.isInteger(day) && day >= 0 && day <= 30)
        : []
      const safeComments = legacyComments && typeof legacyComments === 'object' ? legacyComments : {}

      userId = uid('usr')
      db.users.push({
        id: userId,
        name: oldAccount.name || 'Aluno',
        email: normalizedEmail,
        phone: oldOrder?.phone || '',
        password: String(oldAccount.password || ''),
        status: 'active',
        entitlements: Array.isArray(oldAccount.entitlements) ? oldAccount.entitlements : ['rv30'],
        progress: { rv30: safeProgress },
        comments: { rv30: safeComments },
        notes: [],
        createdAt: oldAccount.createdAt || nowIso(),
        updatedAt: nowIso(),
        lastLoginAt: null
      })
    }

    if (oldOrder?.email) {
      db.orders.push({
        id: oldOrder.id || uid('ord'),
        courseId: oldOrder.courseId || 'rv30',
        name: oldOrder.name || oldAccount?.name || 'Aluno',
        email: normalizeEmail(oldOrder.email),
        phone: oldOrder.phone || '',
        amountCents: Number(oldOrder.amountCents || coursePriceCents(oldOrder.courseId || 'rv30')),
        status: oldOrder.status || 'approved',
        approvedAt: oldOrder.approvedAt || nowIso(),
        createdAt: oldOrder.approvedAt || nowIso(),
        claimedAt: userId ? nowIso() : null,
        userId,
        mode: 'demo-migrated'
      })
    }

    db.audit.push({ id: uid('log'), action: 'legacy_migrated', at: nowIso(), actor: 'system' })
    return db
  }

  function getDb() {
    const db = migrateLegacyIfNeeded(ensureDbShape(readJson(STORAGE.db, emptyDb())))
    writeJson(STORAGE.db, db)
    return db
  }

  function saveDb(db) {
    db.updatedAt = nowIso()
    writeJson(STORAGE.db, ensureDbShape(db))
  }

  function addAudit(db, action, details = {}, actor = 'system') {
    db.audit.unshift({ id: uid('log'), action, details, actor, at: nowIso() })
    db.audit = db.audit.slice(0, 300)
  }

  function publicUser(user) {
    if (!user) return null
    const { password, ...safe } = user
    return clone(safe)
  }

  function studentUser(user) {
    if (!user) return null
    const {
      password,
      notes,
      comments,
      progress,
      ...safe
    } = user
    return clone(safe)
  }

  function userProgress(user, courseId = 'rv30') {
    const days = user?.progress?.[courseId]
    const totalDays = courseTotalDays(courseId)
    return Array.isArray(days) ? days.filter((day) => Number.isInteger(day) && day >= 0 && day <= totalDays) : []
  }

  function nextCourseDay(days, courseId = 'rv30') {
    const totalDays = courseTotalDays(courseId)
    const done = new Set(days)
    if (!done.has(0)) return 0
    let day = 1
    while (day <= totalDays && done.has(day)) day += 1
    return Math.min(day, totalDays)
  }

  function validDay(courseId, day) {
    const n = Number(day)
    return Number.isInteger(n) && n >= 0 && n <= courseTotalDays(courseId)
  }

  function adminSessionValid() {
    if (!demoEnabled()) return false
    const session = readJson(STORAGE.adminSession)
    if (!session?.email || !session?.expiresAt) return false
    const expiresAt = new Date(session.expiresAt).getTime()
    if (!expiresAt || Date.now() >= expiresAt) {
      localStorage.removeItem(STORAGE.adminSession)
      return false
    }
    return true
  }

  function adminFail(message = 'Sessão administrativa inválida ou expirada.') {
    return { ok: false, message, code: 'ADMIN_AUTH_REQUIRED' }
  }

  const api = {
    storage: STORAGE,

    db() {
      if (!adminSessionValid()) return null
      const snapshot = getDb()
      return clone({
        ...snapshot,
        users: snapshot.users.map((user) => publicUser(user))
      })
    },

    resetAllDemoData() {
      Object.values(STORAGE).forEach((key) => localStorage.removeItem(key))
      Object.values(LEGACY).forEach((key) => localStorage.removeItem(key))
    },

    currentOrder() {
      if (!demoEnabled()) return null
      const orderId = localStorage.getItem(STORAGE.currentOrder)
      if (!orderId) return null
      return clone(getDb().orders.find((order) => order.id === orderId) || null)
    },

    orderById(orderId) {
      if (!demoEnabled()) return null
      return clone(getDb().orders.find((order) => order.id === orderId) || null)
    },

    userByEmail(email) {
      if (!demoEnabled()) return null
      const normalized = normalizeEmail(email)
      return studentUser(getDb().users.find((user) => user.email === normalized))
    },

    userById(userId) {
      if (!adminSessionValid()) return null
      return publicUser(getDb().users.find((user) => user.id === userId))
    },

    account() {
      if (!this.isLoggedIn()) return null
      const session = readJson(STORAGE.session)
      if (!session?.userId) return null
      return studentUser(getDb().users.find((user) => user.id === session.userId))
    },

    session() {
      if (!demoEnabled()) return null
      return readJson(STORAGE.session)
    },

    isLoggedIn() {
      if (!demoEnabled()) return false
      const session = readJson(STORAGE.session)
      if (!session?.userId || !session?.expiresAt) return false
      if (!Number.isFinite(Date.parse(session.expiresAt)) || Date.now() >= Date.parse(session.expiresAt)) {
        this.logout()
        return false
      }
      const user = getDb().users.find((item) => item.id === session.userId)
      if (!user || user.status !== 'active') {
        this.logout()
        return false
      }
      return true
    },

    login(email, password) {
      if (!demoEnabled()) return { ok: false, message: 'Adaptador de demonstração desativado.' }
      const normalized = normalizeEmail(email)
      const db = getDb()
      const user = db.users.find((item) => item.email === normalized)
      if (!user) return { ok: false, message: 'E-mail não encontrado neste ambiente de teste.' }
      if (user.status === 'blocked') return { ok: false, message: 'Este acesso está bloqueado. Entre em contato com a RV Fisiologia.' }
      if (user.status !== 'active') return { ok: false, message: 'Este acesso ainda não está ativo.' }
      if (user.password !== String(password || '')) return { ok: false, message: 'Senha incorreta.' }

      const loggedAt = nowIso()
      user.lastLoginAt = loggedAt
      user.updatedAt = loggedAt
      writeJson(STORAGE.session, {
        userId: user.id,
        email: user.email,
        loggedAt,
        expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString()
      })
      addAudit(db, 'student_login', { userId: user.id, email: user.email }, user.email)
      saveDb(db)
      return { ok: true, user: studentUser(user) }
    },

    logout() {
      localStorage.removeItem(STORAGE.session)
    },

    hasAccess(courseId = 'rv30') {
      if (!demoEnabled()) return false
      const user = this.account()
      return Boolean(user?.status === 'active' && user.entitlements?.includes(courseId))
    },

    createDemoOrder(data) {
      if (!demoEnabled()) return { ok: false, message: 'Pedido de demonstração desativado.' }
      const name = String(data?.name || '').trim().slice(0, 120)
      const email = normalizeEmail(data?.email)
      const phone = normalizePhone(data?.phone)
      const amountCents = Number(data?.amountCents || coursePriceCents(data?.courseId || 'rv30'))
      if (name.length < 3) return { ok: false, message: 'Informe o nome completo.' }
      if (!validEmail(email)) return { ok: false, message: 'Informe um e-mail válido.' }
      if (phone.length < 10) return { ok: false, message: 'Informe um telefone válido com DDD.' }
      if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, message: 'Valor do pedido inválido.' }
      const db = getDb()
      const order = {
        id: uid('ord'),
        courseId: data.courseId || 'rv30',
        name,
        email,
        phone,
        amountCents,
        status: 'approved',
        createdAt: nowIso(),
        approvedAt: nowIso(),
        claimedAt: null,
        userId: null,
        mode: 'demo'
      }
      db.orders.unshift(order)
      addAudit(db, 'demo_order_approved', { orderId: order.id, email: order.email, courseId: order.courseId }, order.email)
      saveDb(db)
      localStorage.setItem(STORAGE.currentOrder, order.id)
      return clone(order)
    },

    claimApprovedOrder(password, requestedOrderId = null) {
      if (!demoEnabled()) return { ok: false, message: 'Liberação de demonstração desativada.' }
      const db = getDb()
      const orderId = requestedOrderId || localStorage.getItem(STORAGE.currentOrder)
      const order = db.orders.find((item) => item.id === orderId)
      if (!order || order.status !== 'approved') return { ok: false, message: 'Nenhum pagamento aprovado foi encontrado.' }

      let user = db.users.find((item) => item.email === order.email)
      if (user) {
        user.entitlements = Array.from(new Set([...(user.entitlements || []), order.courseId]))
        user.status = user.status === 'blocked' ? 'blocked' : 'active'
        user.updatedAt = nowIso()
        order.userId = user.id
        order.claimedAt = order.claimedAt || nowIso()
        addAudit(db, 'existing_user_entitlement_granted', { userId: user.id, orderId: order.id, courseId: order.courseId }, order.email)
        saveDb(db)
        return { ok: true, existing: true, user: studentUser(user) }
      }

      if (String(password || '').length < 8) return { ok: false, message: 'A senha precisa ter pelo menos 8 caracteres.' }

      user = {
        id: uid('usr'),
        name: order.name || 'Aluno',
        email: order.email,
        phone: order.phone || '',
        password: String(password),
        status: 'active',
        entitlements: [order.courseId],
        progress: { [order.courseId]: [] },
        comments: { [order.courseId]: {} },
        notes: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastLoginAt: null
      }
      db.users.push(user)
      order.userId = user.id
      order.claimedAt = nowIso()
      addAudit(db, 'student_account_created', { userId: user.id, orderId: order.id, courseId: order.courseId }, order.email)
      saveDb(db)
      return { ok: true, existing: false, user: studentUser(user) }
    },

    grantCurrentOrderToExistingUser(orderId = null) {
      const order = orderId ? this.orderById(orderId) : this.currentOrder()
      if (!order) return { ok: false }
      return this.claimApprovedOrder('', order.id)
    },

    progress(courseId = 'rv30') {
      if (!this.isLoggedIn()) return []
      const session = readJson(STORAGE.session)
      if (!session?.userId) return []
      const user = getDb().users.find((item) => item.id === session.userId)
      if (!user || user.status !== 'active' || !user.entitlements?.includes(courseId)) return []
      return clone(userProgress(user, courseId))
    },

    setDayComplete(courseId, day, complete) {
      if (!this.isLoggedIn()) return { ok: false }
      if (!validDay(courseId, day)) return { ok: false }
      day = Number(day)
      const session = readJson(STORAGE.session)
      const db = getDb()
      const user = db.users.find((item) => item.id === session?.userId)
      if (!user || user.status !== 'active' || !user.entitlements?.includes(courseId)) return { ok: false }
      const current = new Set(userProgress(user, courseId))
      complete ? current.add(day) : current.delete(day)
      user.progress = user.progress || {}
      user.progress[courseId] = [...current].sort((a, b) => a - b)
      user.updatedAt = nowIso()
      addAudit(db, complete ? 'lesson_completed' : 'lesson_uncompleted', { userId: user.id, courseId, day }, user.email)
      saveDb(db)
      return { ok: true, progress: clone(user.progress[courseId]) }
    },

    courseProgressSummary(courseId = 'rv30') {
      const days = this.progress(courseId)
      const totalDays = courseTotalDays(courseId)
      const completed = days.filter((day) => day >= 1 && day <= totalDays).length
      return { days, completed, totalDays, percent: Math.round((completed / totalDays) * 100), nextDay: nextCourseDay(days, courseId) }
    },

    comments(courseId, day) {
      if (!this.isLoggedIn() || !validDay(courseId, day)) return []
      const session = readJson(STORAGE.session)
      const user = getDb().users.find((item) => item.id === session?.userId)
      if (!user || user.status !== 'active' || !user.entitlements?.includes(courseId)) return []
      const comments = user?.comments?.[courseId]?.[Number(day)]
      return Array.isArray(comments)
        ? clone(comments.filter((comment) => comment.status !== 'hidden'))
        : []
    },

    addComment(courseId, day, text) {
      if (!this.isLoggedIn()) return { ok: false }
      if (!validDay(courseId, day)) return { ok: false, message: 'Conteúdo inválido.' }
      day = Number(day)
      const clean = String(text || '').trim().slice(0, 600)
      if (!clean) return { ok: false }
      const session = readJson(STORAGE.session)
      const db = getDb()
      const user = db.users.find((item) => item.id === session?.userId)
      if (!user || user.status !== 'active' || !user.entitlements?.includes(courseId)) return { ok: false }
      user.comments = user.comments || {}
      user.comments[courseId] = user.comments[courseId] || {}
      user.comments[courseId][day] = Array.isArray(user.comments[courseId][day]) ? user.comments[courseId][day] : []
      const comment = { id: uid('cmt'), name: user.name, text: clean, createdAt: nowIso(), status: 'open' }
      user.comments[courseId][day].push(comment)
      user.updatedAt = nowIso()
      addAudit(db, 'student_comment_added', { userId: user.id, courseId, day, commentId: comment.id }, user.email)
      saveDb(db)
      return { ok: true, comment: clone(comment) }
    },

    adminLogin(email, password) {
      const cfg = window.RV_COURSE_CONFIG?.demoAdmin
      if (!window.RV_COURSE_CONFIG?.testMode || !cfg) return { ok: false, message: 'Login administrativo de demonstração desativado.' }
      if (normalizeEmail(email) !== normalizeEmail(cfg.email) || String(password || '') !== String(cfg.password || '')) {
        return { ok: false, message: 'Credenciais administrativas de teste inválidas.' }
      }
      writeJson(STORAGE.adminSession, {
        email: normalizeEmail(email),
        loggedAt: nowIso(),
        expiresAt: new Date(Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000).toISOString()
      })
      const db = getDb()
      addAudit(db, 'admin_login', {}, normalizeEmail(email))
      saveDb(db)
      return { ok: true }
    },

    isAdminLoggedIn() {
      return adminSessionValid()
    },

    adminLogout() {
      const session = readJson(STORAGE.adminSession)
      if (adminSessionValid()) {
        const db = getDb()
        addAudit(db, 'admin_logout', {}, session?.email || 'admin-demo')
        saveDb(db)
      }
      localStorage.removeItem(STORAGE.adminSession)
    },

    adminSeedDemoData() {
      if (!adminSessionValid()) return adminFail()
      const db = getDb()
      if (db.users.length || db.orders.length) return { ok: true, skipped: true }
      const samples = [
        ['Ana Martins','ana.teste@rv.local','11999990001',[0,1,2,3,4,5,6,7], 'active', 2],
        ['Bruno Costa','bruno.teste@rv.local','11999990002',[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14], 'active', 1],
        ['Carla Souza','carla.teste@rv.local','11999990003',[0,1,2,3], 'active', 0],
        ['Diego Ramos','diego.teste@rv.local','11999990004',[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21], 'blocked', 0],
        ['Elisa Lima','elisa.teste@rv.local','11999990005',[0,1], 'active', 1]
      ]
      samples.forEach(([name,email,phone,days,status,commentsCount], index) => {
        const userId = uid('usr')
        const comments = { rv30: {} }
        if (commentsCount) {
          comments.rv30[2] = Array.from({ length: commentsCount }, (_, i) => ({ id: uid('cmt'), name, text: `Dúvida de demonstração ${i + 1} sobre o conteúdo.`, createdAt: new Date(Date.now() - (index + i + 1) * 3600000).toISOString(), status: i ? 'answered' : 'open' }))
        }
        db.users.push({ id:userId, name, email, phone, password:'aluno1234', status, entitlements:['rv30'], progress:{rv30:days}, comments, notes:[], createdAt:new Date(Date.now()-(index+3)*86400000).toISOString(), updatedAt:nowIso(), lastLoginAt:index===2?null:new Date(Date.now()-(index+1)*7200000).toISOString() })
        const orderId = uid('ord')
        db.orders.push({ id:orderId, courseId:'rv30', name, email, phone, amountCents:coursePriceCents('rv30'), status:'approved', createdAt:new Date(Date.now()-(index+3)*86400000).toISOString(), approvedAt:new Date(Date.now()-(index+3)*86400000).toISOString(), claimedAt:nowIso(), userId, mode:'seed' })
      })
      addAudit(db, 'admin_demo_seed_created', { count: samples.length }, 'admin-demo')
      saveDb(db)
      return { ok: true, count: samples.length }
    },

    adminStudents(courseId = 'rv30') {
      if (!adminSessionValid()) return []
      const db = getDb()
      return db.users
        .filter((user) => user.entitlements?.includes(courseId) || user.progress?.[courseId])
        .map((user) => {
          const days = userProgress(user, courseId)
          const totalDays = courseTotalDays(courseId)
          const completed = days.filter((day) => day >= 1 && day <= totalDays).length
          const openComments = Object.values(user.comments?.[courseId] || {}).flat().filter((comment) => comment.status === 'open').length
          const orders = db.orders.filter((order) => order.userId === user.id || order.email === user.email)
          const hasAccess = user.entitlements?.includes(courseId)
          const lastLoginMs = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0
          const inactive = user.status === 'active' && hasAccess && (!lastLoginMs || lastLoginMs < (Date.now() - 7 * 24 * 60 * 60 * 1000))
          return {
            ...publicUser(user),
            courseId,
            completed,
            totalDays,
            percent: Math.round((completed / totalDays) * 100),
            nextDay: nextCourseDay(days, courseId),
            openComments,
            orders: clone(orders),
            hasAccess,
            inactive
          }
        })
    },

    adminPendingOrders(courseId = 'rv30') {
      if (!adminSessionValid()) return []
      const db = getDb()
      return clone(db.orders.filter((order) => order.courseId === courseId && order.status === 'approved' && !order.userId))
    },

    adminStats(courseId = 'rv30') {
      if (!adminSessionValid()) return { total:0, active:0, blocked:0, pendingOrders:0, averageProgress:0, openComments:0, inactive:0 }
      const students = this.adminStudents(courseId)
      const pendingOrders = this.adminPendingOrders(courseId)
      const active = students.filter((student) => student.status === 'active' && student.entitlements?.includes(courseId)).length
      const blocked = students.filter((student) => student.status === 'blocked').length
      const avg = students.length ? Math.round(students.reduce((sum, student) => sum + student.percent, 0) / students.length) : 0
      const openComments = students.reduce((sum, student) => sum + student.openComments, 0)
      const inactiveCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000)
      const inactive = students.filter((student) => {
        if (student.status !== 'active' || !student.entitlements?.includes(courseId)) return false
        if (!student.lastLoginAt) return true
        const last = new Date(student.lastLoginAt).getTime()
        return !last || last < inactiveCutoff
      }).length
      return { total: students.length, active, blocked, pendingOrders: pendingOrders.length, averageProgress: avg, openComments, inactive }
    },

    adminUpdateStudent(userId, patch = {}) {
      if (!adminSessionValid()) return adminFail()
      const allowedStatus = new Set(['active','blocked','pending'])
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      if (patch.name !== undefined) user.name = String(patch.name).trim().slice(0, 120) || user.name
      if (patch.phone !== undefined) {
        const phone = normalizePhone(patch.phone)
        if (phone && phone.length < 10) return { ok: false, message: 'Telefone inválido.' }
        user.phone = phone
      }
      if (patch.status !== undefined && allowedStatus.has(patch.status)) user.status = patch.status
      user.updatedAt = nowIso()
      addAudit(db, 'admin_student_updated', { userId, patch: { ...patch, password: undefined } }, 'admin-demo')
      saveDb(db)
      return { ok: true, user: publicUser(user) }
    },

    adminSetAccess(userId, courseId, enabled) {
      if (!adminSessionValid()) return adminFail()
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      const access = new Set(user.entitlements || [])
      enabled ? access.add(courseId) : access.delete(courseId)
      user.entitlements = [...access]
      user.updatedAt = nowIso()
      addAudit(db, enabled ? 'admin_access_granted' : 'admin_access_revoked', { userId, courseId }, 'admin-demo')
      saveDb(db)
      return { ok: true }
    },

    adminResetProgress(userId, courseId = 'rv30') {
      if (!adminSessionValid()) return adminFail()
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      user.progress = user.progress || {}
      user.progress[courseId] = []
      user.updatedAt = nowIso()
      addAudit(db, 'admin_progress_reset', { userId, courseId }, 'admin-demo')
      saveDb(db)
      return { ok: true }
    },

    adminSetDayProgress(userId, courseId, day, complete) {
      if (!adminSessionValid()) return adminFail()
      if (!validDay(courseId, day)) return { ok:false, message:'Dia inválido.' }
      day = Number(day)
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      const set = new Set(userProgress(user, courseId))
      complete ? set.add(day) : set.delete(day)
      user.progress = user.progress || {}
      user.progress[courseId] = [...set].sort((a,b)=>a-b)
      user.updatedAt = nowIso()
      addAudit(db, 'admin_progress_day_changed', { userId, courseId, day, complete }, 'admin-demo')
      saveDb(db)
      return { ok: true }
    },

    adminAddNote(userId, text) {
      if (!adminSessionValid()) return adminFail()
      const clean = String(text || '').trim().slice(0, 800)
      if (!clean) return { ok: false, message: 'Escreva uma observação.' }
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      user.notes = Array.isArray(user.notes) ? user.notes : []
      user.notes.unshift({ id: uid('note'), text: clean, createdAt: nowIso(), author: 'admin-demo' })
      user.updatedAt = nowIso()
      addAudit(db, 'admin_note_added', { userId }, 'admin-demo')
      saveDb(db)
      return { ok: true }
    },

    adminCourseComments(userId, courseId = 'rv30') {
      if (!adminSessionValid()) return []
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return []
      const byDay = user.comments?.[courseId] || {}
      return Object.entries(byDay)
        .flatMap(([day, comments]) => (Array.isArray(comments) ? comments : []).map((comment) => ({ ...clone(comment), day: Number(day) })))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    },

    adminReplyComment(userId, courseId, commentId, text) {
      if (!adminSessionValid()) return adminFail()
      const clean = String(text || '').trim().slice(0, 1000)
      if (!clean) return { ok: false, message: 'Escreva uma resposta.' }
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      const comments = Object.values(user.comments?.[courseId] || {}).flat()
      const comment = comments.find((item) => item.id === commentId)
      if (!comment) return { ok: false, message: 'Comentário não encontrado.' }
      comment.status = 'answered'
      comment.adminReply = { text: clean, createdAt: nowIso(), author: 'RV Fisiologia' }
      user.updatedAt = nowIso()
      addAudit(db, 'admin_comment_replied', { userId, courseId, commentId }, 'admin-demo')
      saveDb(db)
      return { ok: true, comment: clone(comment) }
    },

    adminMarkCommentsAnswered(userId, courseId = 'rv30') {
      if (!adminSessionValid()) return adminFail()
      const db = getDb()
      const user = db.users.find((item) => item.id === userId)
      if (!user) return { ok: false, message: 'Aluno não encontrado.' }
      Object.values(user.comments?.[courseId] || {}).flat().forEach((comment) => { comment.status = 'answered' })
      user.updatedAt = nowIso()
      addAudit(db, 'admin_comments_marked_answered', { userId, courseId }, 'admin-demo')
      saveDb(db)
      return { ok: true }
    },

    adminCreateStudent(data, courseId = 'rv30') {
      if (!adminSessionValid()) return adminFail()
      const db = getDb()
      const email = normalizeEmail(data.email)
      const name = String(data.name || '').trim().slice(0, 120)
      const phone = normalizePhone(data.phone)
      if (name.length < 3) return { ok:false, message:'Informe o nome completo.' }
      if (!validEmail(email)) return { ok:false, message:'Informe um e-mail válido.' }
      if (phone && phone.length < 10) return { ok:false, message:'Informe um telefone válido com DDD.' }
      if (String(data.password || '').length < 8) return { ok:false, message:'A senha temporária precisa ter pelo menos 8 caracteres.' }
      if (db.users.some((user) => user.email === email)) return { ok:false, message:'Já existe um aluno com este e-mail.' }
      const user = {
        id:uid('usr'), name, email, phone,
        password:String(data.password||'aluno1234'), status:'active', entitlements:[courseId], progress:{[courseId]:[]}, comments:{[courseId]:{}}, notes:[], createdAt:nowIso(), updatedAt:nowIso(), lastLoginAt:null
      }
      db.users.push(user)
      addAudit(db, 'admin_student_created', { userId:user.id, courseId }, 'admin-demo')
      saveDb(db)
      return { ok:true, user:publicUser(user) }
    },


    adminCreateAccessFromOrder(orderId, temporaryPassword) {
      if (!adminSessionValid()) return adminFail()
      const password = String(temporaryPassword || '')
      if (password.length < 8) return { ok:false, message:'A senha temporária precisa ter pelo menos 8 caracteres.' }

      const db = getDb()
      const order = db.orders.find((item) => item.id === orderId)
      if (!order || order.status !== 'approved') return { ok:false, message:'Pedido aprovado não encontrado.' }
      if (order.userId) return { ok:false, message:'Este pedido já está vinculado a uma conta.' }

      let user = db.users.find((item) => item.email === order.email)
      if (user) {
        user.entitlements = Array.from(new Set([...(user.entitlements || []), order.courseId]))
        user.updatedAt = nowIso()
        order.userId = user.id
        order.claimedAt = nowIso()
        addAudit(db, 'admin_pending_order_linked', { orderId: order.id, userId: user.id, courseId: order.courseId }, 'admin-demo')
        saveDb(db)
        return { ok:true, existing:true, user:publicUser(user) }
      }

      user = {
        id: uid('usr'),
        name: String(order.name || 'Aluno').trim().slice(0,120),
        email: normalizeEmail(order.email),
        phone: normalizePhone(order.phone),
        password,
        status: 'active',
        entitlements: [order.courseId],
        progress: { [order.courseId]: [] },
        comments: { [order.courseId]: {} },
        notes: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastLoginAt: null
      }
      db.users.push(user)
      order.userId = user.id
      order.claimedAt = nowIso()
      addAudit(db, 'admin_access_created_from_order', { orderId: order.id, userId: user.id, courseId: order.courseId }, 'admin-demo')
      saveDb(db)
      return { ok:true, existing:false, user:publicUser(user) }
    },

    supportThreads(asAdmin = false) {
      if (asAdmin ? !adminSessionValid() : !this.isLoggedIn()) return []
      const db = getDb()
      const ownerId = asAdmin ? null : this.account().id
      return clone(db.supportThreads.filter((t) => asAdmin || t.userId === ownerId)
        .map((t) => ({ ...t, studentName: db.users.find((u) => u.id === t.userId)?.name || 'Aluno',
          unread: t.messages.filter((m) => m.senderRole !== (asAdmin ? 'admin' : 'student') && !m.readAt).length }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    },

    supportCreate(subject, body, courseId = null) {
      if (!this.isLoggedIn()) return { ok: false, message: 'Entre novamente para enviar.' }
      const title = String(subject || '').trim()
      const text = String(body || '').trim()
      if (title.length < 3 || title.length > 120 || !text || text.length > 2000) {
        return { ok: false, message: 'Informe um assunto e uma mensagem de até 2.000 caracteres.' }
      }
      if (courseId && !this.hasAccess(courseId)) return { ok: false, message: 'Curso sem acesso.' }
      const user = this.account()
      const db = getDb()
      const thread = { id: uid('sup'), userId: user.id, courseId, subject: title, status: 'open',
        createdAt: nowIso(), updatedAt: nowIso(), messages: [
          { id: uid('msg'), body: text, senderRole: 'student', createdAt: nowIso(), readAt: null }
        ] }
      db.supportThreads.push(thread)
      addAudit(db, 'support_created', { threadId: thread.id }, user.email)
      saveDb(db)
      return { ok: true, threadId: thread.id }
    },

    supportSend(threadId, body, asAdmin = false) {
      if (asAdmin ? !adminSessionValid() : !this.isLoggedIn()) return { ok: false, message: 'Sessão expirada. Entre novamente.' }
      const text = String(body || '').trim()
      if (!text || text.length > 2000) return { ok: false, message: 'Escreva até 2.000 caracteres.' }
      const db = getDb()
      const thread = db.supportThreads.find((t) => t.id === threadId)
      if (!thread || (!asAdmin && thread.userId !== this.account().id)) return { ok: false, message: 'Conversa indisponível.' }
      thread.messages.push({ id: uid('msg'), body: text, senderRole: asAdmin ? 'admin' : 'student', createdAt: nowIso(), readAt: null })
      thread.status = asAdmin ? 'answered' : 'open'
      thread.updatedAt = nowIso()
      saveDb(db)
      return { ok: true }
    },

    supportRead(threadId, asAdmin = false) {
      if (asAdmin ? !adminSessionValid() : !this.isLoggedIn()) return { ok: false }
      const db = getDb()
      const thread = db.supportThreads.find((t) => t.id === threadId)
      if (!thread || (!asAdmin && thread.userId !== this.account().id)) return { ok: false }
      const incoming = thread.messages.filter((m) => m.senderRole !== (asAdmin ? 'admin' : 'student') && !m.readAt)
      if (incoming.length) {
        incoming.forEach((m) => { m.readAt = nowIso() })
        saveDb(db)
      }
      return { ok: true }
    },

    supportResolve(threadId) {
      if (!adminSessionValid()) return adminFail()
      const db = getDb()
      const thread = db.supportThreads.find((t) => t.id === threadId)
      if (!thread) return { ok: false }
      thread.status = 'resolved'
      thread.updatedAt = nowIso()
      addAudit(db, 'support_resolved', { threadId }, 'admin-demo')
      saveDb(db)
      return { ok: true }
    },

    adminAudit(limit = 30) {
      if (!adminSessionValid()) return []
      return clone(getDb().audit.slice(0, Math.max(1, Math.min(100, Number(limit) || 30))))
    }
  }

  window.RVCourseAuthDemo = api
  if (!window.RVCourseStore) window.RVCourseStore = api
})()
