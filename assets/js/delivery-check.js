(() => {
  'use strict'

  // A consulta não cria pedidos, não altera pagamentos e não concede acesso.
  function demoDiagnostic(snapshot, orderId, content = []) {
    const order = snapshot?.orders?.find((item) => item.id === orderId)
    if (!order) return { ok: false, message: 'Pedido não encontrado neste ambiente de demonstração.' }
    const account = snapshot.users?.find((user) => user.id === order.userId) || null
    const availableDays = new Set(content.filter((lesson) => lesson.day >= 1 && lesson.day <= 30 && lesson.videoUrl).map((lesson) => lesson.day))
    const missingDays = Array.from({ length: 30 }, (_, i) => i + 1).filter((day) => !availableDays.has(day))
    const exists = account?.status === 'active' && account.entitlements?.includes('rv30') === true
    const reasons = ['Demonstração local: nenhum pagamento foi confirmado por um provedor real.']
    if (order.courseId !== 'rv30') reasons.push('O pedido não corresponde ao produto RV 30.')
    if (order.status !== 'approved') reasons.push('O pedido não está aprovado nem mesmo na demonstração.')
    if (!account) reasons.push('O pedido ainda não está vinculado a uma conta pelo identificador do comprador.')
    if (!exists) reasons.push('A conta associada não tem um direito de acesso ativo ao RV 30.')
    if (missingDays.length) reasons.push(`${missingDays.length} dias ainda não têm vídeo disponível.`)
    return {
      ok: true, simulated: true,
      result: order.courseId !== 'rv30' || ['refused', 'declined', 'canceled', 'cancelled', 'refunded', 'chargeback', 'charged_back'].includes(order.status) ? 'error' : 'pending',
      reasons,
      order: { id: order.id, courseId: order.courseId, status: order.status, amountCents: order.amountCents, currency: 'BRL' },
      product: { id: 'rv30', title: 'RV 30' },
      account: account ? { id: account.id, email: account.email } : null,
      provider: { available: false, confirmed: false, status: 'not_configured' },
      entitlement: { exists, status: exists ? 'active' : 'absent' },
      lessons: { expected: 30, available: availableDays.size, missingDays }
    }
  }

  window.RVDeliveryDiagnostic = { demoDiagnostic }
  if (typeof document === 'undefined') return
  const form = document.querySelector('[data-delivery-form]')
  if (!form) return
  const button = form.querySelector('button[type=submit]')
  const error = document.querySelector('[data-delivery-error]')
  const output = document.querySelector('[data-delivery-result]')
  const statuses = { approved: 'Aprovado', pending: 'Pendente', in_process: 'Em análise', rejected: 'Recusado', refused: 'Recusado', declined: 'Recusado', canceled: 'Cancelado', cancelled: 'Cancelado', refunded: 'Reembolsado', chargeback: 'Contestado', charged_back: 'Contestado', not_configured: 'Não configurado' }
  const node = (tag, value) => { const element = document.createElement(tag); element.textContent = String(value ?? '—'); return element }

  function render(result) {
    output.replaceChildren()
    output.hidden = false
    const labels = { correct: 'Correto', pending: 'Pendente', error: 'Com erro' }
    output.append(node('h3', labels[result.result] || 'Pendente'))
    if (result.simulated) output.append(node('p', 'Diagnóstico de teste local. Este resultado não comprova uma compra real.'))
    const details = document.createElement('dl')
    const pairs = [
      ['Pedido', result.order?.id],
      ['Produto', result.product?.title || result.order?.courseId],
      ['Status do pedido', statuses[result.order?.status] || result.order?.status],
      ['Confirmação do provedor', result.provider?.available ? (result.provider.confirmed ? 'Confirmado na consulta ao provedor' : 'Pagamento sem confirmação válida') : 'Consulta indisponível'],
      ['Status no provedor', statuses[result.provider?.status] || result.provider?.status || 'Não consultado'],
      ['Conta associada', result.account?.email ? `${result.account.email} · ${result.account.id}` : 'Nenhuma conta vinculada'],
      ['Direito de acesso ao RV 30', result.entitlement?.exists && result.entitlement.status === 'active' ? 'Encontrado e ativo' : 'Ausente ou inativo'],
      ['Aulas disponíveis', `${result.lessons?.available || 0} de ${result.lessons?.expected || 30}`],
      ['Dias pendentes', result.lessons?.missingDays?.length ? result.lessons.missingDays.join(', ') : 'Nenhum']
    ]
    pairs.forEach(([title, value]) => details.append(node('dt', title), node('dd', value)))
    output.append(details)
    const reasons = document.createElement('ul')
    ;(Array.isArray(result.reasons) ? result.reasons : []).forEach((reason) => reasons.append(node('li', reason)))
    if (reasons.children.length) output.append(reasons)
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (window.RVApi) await window.RVApi.ready
    const demo = !window.RVApi?.serverMode && window.RV_COURSE_CONFIG?.testMode === true && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname)
    error.textContent = ''
    output.hidden = true
    const orderId = form.elements.orderId.value.trim()
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(orderId)) {
      error.textContent = 'Informe o identificador do pedido, usando letras, números, hífen ou sublinhado.'
      return
    }
    button.disabled = true
    button.textContent = 'Verificando entrega…'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      let result
      if (demo) {
        const store = window.RVCourseStore
        if (!store?.isAdminLoggedIn()) throw new Error('Sua sessão administrativa expirou. Entre novamente.')
        result = demoDiagnostic(store.db(), orderId, window.RV30_CONTENT || [])
      } else {
        const response = await fetch(`/api/admin/delivery?orderId=${encodeURIComponent(orderId)}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          headers: { Accept: 'application/json' }
        })
        if (response.status === 401 || response.status === 403) throw new Error('É necessário entrar com a conta administrativa autorizada e com e-mail verificado.')
        if (response.status === 503) throw new Error('A verificação no servidor ainda não foi configurada.')
        result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Não foi possível consultar a entrega deste pedido.')
      }
      if (!result?.ok) throw new Error(result?.message || 'Não foi possível consultar este pedido.')
      render(result)
    } catch (failure) {
      error.textContent = failure.name === 'AbortError' ? 'A consulta demorou mais que o esperado. Tente novamente.' : failure.message || 'A consulta está indisponível. Tente novamente.'
    } finally {
      clearTimeout(timeout)
      button.disabled = false
      button.textContent = 'Verificar entrega do RV 30'
    }
  })
})()
