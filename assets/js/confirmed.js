(() => {
  'use strict'

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const params = new URLSearchParams(location.search)
  const requestedOrderId = params.get('pedido')
  const order = requestedOrderId ? auth.orderById(requestedOrderId) : auth.currentOrder()
  const form = document.querySelector('[data-create-access-form]')
  const email = document.querySelector('[data-order-email]')
  const error = document.querySelector('[data-form-error]')
  const copy = document.querySelector('[data-confirm-copy]')
  const existingBox = document.querySelector('[data-existing-account]')

  window.RVAnalytics?.track('ViewContent', { content_name: 'Pagamento confirmado' })

  if (!order || order.status !== 'approved') {
    document.querySelector('h1').textContent = 'Confirmação de pagamento indisponível.'
    document.querySelector('.eyebrow').textContent = 'STATUS DO PEDIDO'
    document.querySelector('.success-icon').hidden = true
    document.title = 'Status do pagamento | RV Fisiologia'
    if (copy) copy.textContent = 'Não encontramos uma confirmação válida de pagamento neste ambiente de teste.'
    if (form) form.hidden = true
    return
  }

  const existing = auth.userByEmail(order.email)
  if (email) email.value = order.email

  if (existing) {
    const result = auth.grantCurrentOrderToExistingUser(order.id)
    if (!result.ok) {
      if (copy) copy.textContent = 'Encontramos sua conta, mas não foi possível vincular este pedido no teste.'
      if (form) form.hidden = true
      return
    }
    if (form) form.hidden = true
    if (copy) copy.textContent = 'A compra foi vinculada à conta que já existe para este e-mail. Sua senha atual não foi alterada.'
    if (existingBox) existingBox.hidden = false
    return
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    if (error) error.textContent = ''
    const data = new FormData(form)
    const password = String(data.get('password') || '')
    const confirm = String(data.get('confirm') || '')

    if (password.length < 8) {
      if (error) error.textContent = 'A senha precisa ter pelo menos 8 caracteres.'
      return
    }
    if (password !== confirm) {
      if (error) error.textContent = 'As senhas não coincidem.'
      return
    }

    const result = auth.claimApprovedOrder(password, order.id)
    if (!result.ok) {
      if (error) error.textContent = result.message
      return
    }
    const loginUrl = '/entrar?novo=1'
    location.href = window.RVRoute?.resolve(loginUrl) || loginUrl
  })
})()
