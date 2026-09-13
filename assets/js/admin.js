(() => {
  'use strict'

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const COURSE_ID = 'rv30'
  const state = {
    query: '',
    status: 'all',
    progress: 'all',
    engagement: 'all',
    sort: 'recent',
    selectedUserId: null,
    selectedOrderId: null
  }

  const $ = (selector, root = document) => root.querySelector(selector)

  if (!auth?.isAdminLoggedIn?.()) {
    location.replace('admin-login.html')
    return
  }

  auth.adminSeedDemoData?.()

  function ensureAdmin() {
    if (auth?.isAdminLoggedIn?.()) return true
    location.replace('admin-login.html?expired=1')
    return false
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]))
  }

  function formatDate(value, fallback = 'Nunca') {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
  }

  function statusLabel(status) {
    return ({ active: 'Ativo', blocked: 'Bloqueado', pending: 'Pendente' })[status] || status
  }

  function money(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100)
  }

  function studentMatches(student) {
    const query = state.query.trim().toLowerCase()

    if (query && !`${student.name} ${student.email} ${student.phone || ''}`.toLowerCase().includes(query)) return false
    if (state.status !== 'all' && student.status !== state.status) return false

    if (state.progress === 'not-started' && student.completed !== 0) return false
    if (state.progress === 'starting' && !(student.percent > 0 && student.percent < 50)) return false
    if (state.progress === 'advanced' && !(student.percent >= 50 && student.percent < 100)) return false
    if (state.progress === 'complete' && student.percent !== 100) return false

    if (state.engagement === 'inactive' && !student.inactive) return false
    if (state.engagement === 'with-questions' && student.openComments === 0) return false
    if (state.engagement === 'no-login' && student.lastLoginAt) return false

    return true
  }

  function sortStudents(students) {
    return [...students].sort((a, b) => {
      if (state.sort === 'name') return String(a.name).localeCompare(String(b.name), 'pt-BR')
      if (state.sort === 'progress-desc') return b.percent - a.percent || String(a.name).localeCompare(String(b.name), 'pt-BR')
      if (state.sort === 'progress-asc') return a.percent - b.percent || String(a.name).localeCompare(String(b.name), 'pt-BR')
      if (state.sort === 'questions') return b.openComments - a.openComments || String(a.name).localeCompare(String(b.name), 'pt-BR')
      if (state.sort === 'created-desc') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)

      const aLast = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : -1
      const bLast = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : -1
      return bLast - aLast || String(a.name).localeCompare(String(b.name), 'pt-BR')
    })
  }

  function renderMetrics() {
    if (!ensureAdmin()) return
    const stats = auth.adminStats(COURSE_ID)
    const map = {
      '[data-stat-total]': stats.total,
      '[data-stat-active]': stats.active,
      '[data-stat-progress]': `${stats.averageProgress}%`,
      '[data-stat-comments]': stats.openComments,
      '[data-stat-pending]': stats.pendingOrders,
      '[data-stat-inactive]': stats.inactive
    }

    Object.entries(map).forEach(([selector, value]) => {
      const el = $(selector)
      if (el) el.textContent = String(value)
    })
  }

  function renderStudents() {
    if (!ensureAdmin()) return

    const allStudents = auth.adminStudents(COURSE_ID)
    const students = sortStudents(allStudents.filter(studentMatches))
    const body = $('[data-student-rows]')
    const empty = $('[data-student-empty]')
    const count = $('[data-student-count]')

    if (count) {
      count.textContent = students.length === allStudents.length
        ? `${students.length} ${students.length === 1 ? 'aluno' : 'alunos'}`
        : `${students.length} de ${allStudents.length}`
    }

    if (!students.length) {
      body.replaceChildren()
      empty.hidden = false
      return
    }

    empty.hidden = true
    body.innerHTML = students.map((student) => {
      const hasAccess = student.entitlements?.includes(COURSE_ID)

      return `<tr>
        <td>
          <button class="admin-student-link" type="button" data-open-student="${esc(student.id)}">
            <strong>${esc(student.name)}</strong>
            <small>${esc(student.email)}</small>
            ${student.inactive ? '<span class="student-risk">SEM ACESSO RECENTE</span>' : ''}
          </button>
        </td>
        <td>
          <span class="status-chip status-chip--${esc(student.status)}">${esc(statusLabel(student.status))}</span>
          ${hasAccess ? '<small class="access-note">RV 30 liberado</small>' : '<small class="access-note access-note--off">Sem acesso</small>'}
        </td>
        <td>
          <div class="admin-progress-cell">
            <strong>${student.completed}/30</strong>
            <progress class="native-progress native-progress--table" max="30" value="${student.completed}" aria-label="${student.percent}% concluído"></progress>
            <small>${student.percent}%</small>
          </div>
        </td>
        <td><span class="comment-count ${student.openComments ? 'has-open' : ''}">${student.openComments}</span></td>
        <td><small>${esc(formatDate(student.lastLoginAt))}</small></td>
        <td><button class="button button--ghost button--compact" type="button" data-open-student="${esc(student.id)}">Gerenciar</button></td>
      </tr>`
    }).join('')
  }

  function renderPendingOrders() {
    if (!ensureAdmin()) return

    const orders = auth.adminPendingOrders(COURSE_ID)
    const wrap = $('[data-pending-orders]')
    const count = $('[data-pending-count]')

    if (count) count.textContent = String(orders.length)

    if (!orders.length) {
      wrap.innerHTML = '<p class="admin-empty-inline">Nenhuma compra aprovada aguardando criação de acesso.</p>'
      return
    }

    wrap.innerHTML = orders.map((order) => `<article class="pending-order-card">
      <div>
        <strong>${esc(order.name)}</strong>
        <small>${esc(order.email)} • ${esc(order.phone || 'sem telefone')}</small>
      </div>
      <div>
        <span class="status-chip status-chip--pending">Aguardando acesso</span>
        <small>${esc(formatDate(order.approvedAt))} • ${esc(money(order.amountCents))}</small>
        <div class="pending-order-actions">
          <button class="button button--secondary button--compact" type="button" data-create-order-access="${esc(order.id)}">Criar acesso</button>
        </div>
      </div>
    </article>`).join('')
  }

  function renderAudit() {
    if (!ensureAdmin()) return

    const labels = {
      student_login: 'Aluno entrou',
      demo_order_approved: 'Compra de teste aprovada',
      student_account_created: 'Conta criada',
      existing_user_entitlement_granted: 'Curso adicionado à conta',
      lesson_completed: 'Conteúdo concluído',
      lesson_uncompleted: 'Conclusão removida',
      student_comment_added: 'Comentário enviado',
      admin_student_updated: 'Cadastro alterado',
      admin_access_granted: 'Acesso liberado',
      admin_access_revoked: 'Acesso removido',
      admin_progress_reset: 'Progresso reiniciado',
      admin_progress_day_changed: 'Progresso ajustado',
      admin_note_added: 'Observação adicionada',
      admin_comments_marked_answered: 'Dúvidas marcadas como tratadas',
      admin_student_created: 'Aluno criado manualmente',
      admin_demo_seed_created: 'Dados de demonstração criados',
      admin_login: 'Administrador entrou',
      admin_logout: 'Administrador saiu',
      legacy_migrated: 'Dados antigos migrados',
      admin_comment_replied: 'Dúvida respondida pela equipe',
      admin_pending_order_linked: 'Compra pendente vinculada a conta existente',
      admin_access_created_from_order: 'Acesso criado a partir de compra aprovada'
    }

    const items = auth.adminAudit(14)
    $('[data-audit-list]').innerHTML = items.map((item) => `<li>
      <span></span>
      <div><strong>${esc(labels[item.action] || item.action)}</strong><small>${esc(formatDate(item.at))}</small></div>
    </li>`).join('') || '<li class="admin-empty-inline">Sem atividade registrada.</li>'
  }

  function renderAll() {
    if (!ensureAdmin()) return
    renderMetrics()
    renderStudents()
    renderPendingOrders()
    renderAudit()
  }

  function selectedStudent() {
    if (!ensureAdmin()) return null
    return auth.adminStudents(COURSE_ID).find((student) => student.id === state.selectedUserId) || null
  }

  function openDialog(dialog) {
    if (dialog && !dialog.open) dialog.showModal()
  }

  function openStudent(userId) {
    if (!ensureAdmin()) return

    const student = auth.adminStudents(COURSE_ID).find((item) => item.id === userId)
    if (!student) {
      state.selectedUserId = null
      return
    }

    state.selectedUserId = userId

    const dialog = $('[data-student-dialog]')
    const hasAccess = student.entitlements?.includes(COURSE_ID)
    const status = $('[data-detail-status]')

    $('[data-detail-name]').textContent = student.name
    $('[data-detail-email]').textContent = student.email
    $('[data-detail-phone]').textContent = student.phone || 'Não informado'
    $('[data-detail-created]').textContent = formatDate(student.createdAt)
    $('[data-detail-last-login]').textContent = formatDate(student.lastLoginAt)
    status.textContent = statusLabel(student.status)
    status.className = `status-chip status-chip--${student.status}`
    $('[data-detail-progress]').textContent = `${student.completed} de 30 dias (${student.percent}%)`
    $('[data-detail-comments]').textContent = `${student.openComments} pendente${student.openComments === 1 ? '' : 's'}`
    $('[data-detail-access]').textContent = hasAccess ? 'Acesso liberado' : 'Sem acesso ao RV 30'

    const contactForm = $('[data-contact-form]')
    if (contactForm) {
      contactForm.elements.name.value = student.name
      contactForm.elements.phone.value = student.phone || ''
    }

    $('[data-toggle-block]').textContent = student.status === 'blocked' ? 'Desbloquear aluno' : 'Bloquear aluno'
    $('[data-toggle-access]').textContent = hasAccess ? 'Remover acesso ao RV 30' : 'Liberar acesso ao RV 30'
    $('[data-mark-comments]').disabled = student.openComments === 0

    const progressDays = new Set(student.progress?.[COURSE_ID] || [])
    $('[data-detail-days]').innerHTML = Array.from({ length: 31 }, (_, day) => {
      const done = progressDays.has(day)
      return `<button type="button" class="admin-day ${done ? 'is-done' : ''}" data-admin-day="${day}" aria-pressed="${done}">
        <span>${day === 0 ? 'I' : day}</span><small>${done ? '✓' : ''}</small>
      </button>`
    }).join('')

    const comments = auth.adminCourseComments(student.id, COURSE_ID)
    $('[data-detail-comment-list]').innerHTML = comments.length
      ? comments.map((comment) => `<article class="admin-comment-card ${comment.status === 'answered' ? 'is-answered' : ''}">
          <div class="admin-comment-meta">
            <span>${comment.day === 0 ? 'Introdução' : `Dia ${comment.day}`}</span>
            <small>${esc(formatDate(comment.createdAt))}</small>
          </div>
          <p>${esc(comment.text)}</p>
          ${comment.adminReply
            ? `<div class="admin-comment-reply"><small>RESPOSTA DA RV</small><p>${esc(comment.adminReply.text)}</p><time>${esc(formatDate(comment.adminReply.createdAt))}</time></div>`
            : `<form class="admin-reply-form" data-reply-form data-comment-id="${esc(comment.id)}">
                <textarea name="reply" maxlength="1000" required aria-label="Resposta ao comentário" placeholder="Responder esta dúvida…"></textarea>
                <button class="button button--secondary button--compact" type="submit">Responder</button>
                <p class="form-error" data-reply-error role="alert"></p>
              </form>`}
        </article>`).join('')
      : '<p class="admin-empty-inline">Este aluno ainda não enviou dúvidas.</p>'

    $('[data-detail-orders]').innerHTML = student.orders?.length
      ? student.orders.map((order) => `<li><strong>${esc(order.id)}</strong><span>${esc(order.status)} • ${esc(money(order.amountCents))} • ${esc(formatDate(order.approvedAt))}</span></li>`).join('')
      : '<li>Nenhum pedido vinculado.</li>'

    $('[data-detail-notes]').innerHTML = student.notes?.length
      ? student.notes.map((note) => `<li><p>${esc(note.text)}</p><small>${esc(formatDate(note.createdAt))}</small></li>`).join('')
      : '<li class="admin-empty-inline">Nenhuma observação interna.</li>'

    $('[data-note-form]')?.reset()
    resetDangerButton()
    openDialog(dialog)
  }

  function openPendingOrder(orderId) {
    if (!ensureAdmin()) return

    const order = auth.adminPendingOrders(COURSE_ID).find((item) => item.id === orderId)
    if (!order) return

    state.selectedOrderId = orderId
    $('[data-pending-order-label]').textContent = `${order.name} • ${order.email}`
    $('[data-pending-error]').textContent = ''

    const form = $('[data-pending-form]')
    form?.reset()
    if (form?.elements?.password) form.elements.password.value = 'aluno1234'

    openDialog($('[data-pending-dialog]'))
  }

  let resetTimer = null

  function resetDangerButton() {
    clearTimeout(resetTimer)
    const button = $('[data-reset-progress]')
    if (!button) return
    button.dataset.confirming = 'false'
    button.textContent = 'Reiniciar progresso'
  }

  function requestProgressReset() {
    if (!ensureAdmin()) return

    const student = selectedStudent()
    const button = $('[data-reset-progress]')
    if (!student || !button) return

    if (button.dataset.confirming !== 'true') {
      button.dataset.confirming = 'true'
      button.textContent = 'Clique novamente para confirmar'
      resetTimer = setTimeout(resetDangerButton, 4500)
      return
    }

    const result = auth.adminResetProgress(student.id, COURSE_ID)
    if (!result.ok) return
    openStudent(student.id)
    renderAll()
  }

  function csvSafe(value) {
    const text = String(value ?? '')
    return /^[=+\-@]/.test(text) ? `'${text}` : text
  }

  function exportCsv() {
    if (!ensureAdmin()) return

    const students = auth.adminStudents(COURSE_ID)
    const rows = [
      ['nome', 'email', 'telefone', 'status', 'acesso_rv30', 'sem_acesso_recente', 'dias_concluidos', 'progresso_percentual', 'comentarios_pendentes', 'ultimo_acesso', 'criado_em'],
      ...students.map((student) => [
        student.name,
        student.email,
        student.phone || '',
        student.status,
        student.entitlements?.includes(COURSE_ID) ? 'sim' : 'nao',
        student.inactive ? 'sim' : 'nao',
        student.completed,
        student.percent,
        student.openComments,
        student.lastLoginAt || '',
        student.createdAt || ''
      ])
    ]

    const csv = rows.map((row) => row.map((value) => `"${csvSafe(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `rv30-alunos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  $('[data-search]')?.addEventListener('input', (event) => {
    state.query = event.target.value
    renderStudents()
  })

  $('[data-filter-status]')?.addEventListener('change', (event) => {
    state.status = event.target.value
    renderStudents()
  })

  $('[data-filter-progress]')?.addEventListener('change', (event) => {
    state.progress = event.target.value
    renderStudents()
  })

  $('[data-filter-engagement]')?.addEventListener('change', (event) => {
    state.engagement = event.target.value
    renderStudents()
  })

  $('[data-sort]')?.addEventListener('change', (event) => {
    state.sort = event.target.value
    renderStudents()
  })

  $('[data-export]')?.addEventListener('click', exportCsv)

  $('[data-admin-logout]')?.addEventListener('click', () => {
    auth.adminLogout()
    location.href = 'admin-login.html'
  })

  $('[data-open-create]')?.addEventListener('click', () => {
    if (!ensureAdmin()) return
    openDialog($('[data-create-dialog]'))
  })

  document.addEventListener('click', (event) => {
    const openStudentButton = event.target.closest('[data-open-student]')
    if (openStudentButton) openStudent(openStudentButton.dataset.openStudent)

    const pendingButton = event.target.closest('[data-create-order-access]')
    if (pendingButton) openPendingOrder(pendingButton.dataset.createOrderAccess)

    const close = event.target.closest('[data-close-dialog]')
    if (close) close.closest('dialog')?.close()

    const day = event.target.closest('[data-admin-day]')
    if (day && state.selectedUserId) {
      const student = selectedStudent()
      if (!student) return

      const dayNumber = Number(day.dataset.adminDay)
      const complete = !(student.progress?.[COURSE_ID] || []).includes(dayNumber)
      const result = auth.adminSetDayProgress(student.id, COURSE_ID, dayNumber, complete)

      if (result.ok) {
        openStudent(student.id)
        renderAll()
      }
    }

    if (event.target.closest('[data-toggle-block]')) {
      const student = selectedStudent()
      if (!student) return

      const result = auth.adminUpdateStudent(student.id, {
        status: student.status === 'blocked' ? 'active' : 'blocked'
      })

      if (result.ok) {
        openStudent(student.id)
        renderAll()
      }
    }

    if (event.target.closest('[data-toggle-access]')) {
      const student = selectedStudent()
      if (!student) return

      const hasAccess = student.entitlements?.includes(COURSE_ID)
      const result = auth.adminSetAccess(student.id, COURSE_ID, !hasAccess)

      if (result.ok) {
        openStudent(student.id)
        renderAll()
      }
    }

    if (event.target.closest('[data-mark-comments]')) {
      const student = selectedStudent()
      if (!student) return

      const result = auth.adminMarkCommentsAnswered(student.id, COURSE_ID)
      if (result.ok) {
        openStudent(student.id)
        renderAll()
      }
    }

    if (event.target.closest('[data-reset-progress]')) requestProgressReset()
  })

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-reply-form]')
    if (!form) return

    event.preventDefault()
    const student = selectedStudent()
    const error = $('[data-reply-error]', form)

    if (error) error.textContent = ''
    if (!student) return

    const result = auth.adminReplyComment(
      student.id,
      COURSE_ID,
      form.dataset.commentId,
      form.elements.reply.value
    )

    if (!result.ok) {
      if (error) error.textContent = result.message || 'Não foi possível responder.'
      return
    }

    openStudent(student.id)
    renderAll()
  })

  $('[data-contact-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const student = selectedStudent()
    const error = $('[data-contact-error]')
    if (error) error.textContent = ''
    if (!student) return

    const data = new FormData(event.currentTarget)
    const result = auth.adminUpdateStudent(student.id, {
      name: data.get('name'),
      phone: data.get('phone')
    })

    if (!result.ok) {
      if (error) error.textContent = result.message || 'Não foi possível salvar.'
      return
    }

    openStudent(student.id)
    renderAll()
  })

  $('[data-note-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const student = selectedStudent()
    if (!student) return

    const field = event.currentTarget.elements.note
    const result = auth.adminAddNote(student.id, field.value)

    if (!result.ok) return
    openStudent(student.id)
    renderAll()
  })

  $('[data-create-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!ensureAdmin()) return

    const error = $('[data-create-error]')
    if (error) error.textContent = ''

    const data = new FormData(event.currentTarget)
    const result = auth.adminCreateStudent({
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
      password: data.get('password')
    }, COURSE_ID)

    if (!result.ok) {
      if (error) error.textContent = result.message || 'Não foi possível criar o aluno.'
      return
    }

    event.currentTarget.reset()
    $('[data-create-dialog]')?.close()
    renderAll()
    openStudent(result.user.id)
  })

  $('[data-pending-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!ensureAdmin()) return

    const error = $('[data-pending-error]')
    if (error) error.textContent = ''

    if (!state.selectedOrderId) {
      if (error) error.textContent = 'Nenhum pedido foi selecionado.'
      return
    }

    const result = auth.adminCreateAccessFromOrder(
      state.selectedOrderId,
      event.currentTarget.elements.password.value
    )

    if (!result.ok) {
      if (error) error.textContent = result.message || 'Não foi possível criar o acesso.'
      return
    }

    const userId = result.user?.id
    state.selectedOrderId = null
    $('[data-pending-dialog]')?.close()
    renderAll()
    if (userId) openStudent(userId)
  })

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })
  })

  window.addEventListener('storage', () => {
    if (ensureAdmin()) renderAll()
  })

  setInterval(() => {
    if (ensureAdmin()) renderAll()
  }, 60_000)

  renderAll()
})()
