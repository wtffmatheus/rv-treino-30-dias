(async () => {
  'use strict'

  if (window.RVApi) await window.RVApi.ready

  const config = window.RV_COURSE_CONFIG || {}
  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const params = new URLSearchParams(location.search)
  const courseId = params.get('curso') || 'rv30'
  const course = config.courses?.find((item) => item.id === courseId && item.status === 'available')
  const form = document.querySelector('[data-checkout-form]')
  const testBox = document.querySelector('[data-test-payment]')
  const productionBox = document.querySelector('[data-production-payment]')
  const productionButton = document.querySelector('[data-production-checkout]')
  const setupError = document.querySelector('[data-checkout-config-error]')
  const paymentProviderLabels = {
    stone_link: 'Stone Link de Pagamento',
    mercado_pago: 'Mercado Pago',
    manual: 'pagamento configurado pela RV'
  }
  let customer = null

  if (window.RVApi?.serverMode) {
    window.RVApi.applyPricing()
    if (form) form.hidden = true
    if (testBox) testBox.hidden = true
    if (productionBox) productionBox.hidden = true
    if (setupError) {
      setupError.hidden = false
      setupError.textContent = 'Inscrições em preparação. A compra será disponibilizada após a validação do pagamento e das aulas.'
    }
    if (!window.RVApi.configured || !window.RVApi.salesEnabled || !course) return
    if (!auth.isLoggedIn()) {
      setupError.textContent = 'Entre em sua conta antes de continuar com a inscrição.'
      const link = document.createElement('a')
      link.href = '/entrar?next=/checkout/rv30'
      link.textContent = 'Entrar ou criar minha conta'
      link.className = 'button button--primary'
      setupError.append(document.createElement('br'), link)
      return
    }
    const button = document.createElement('button')
    button.type = 'button'; button.className = 'button button--primary'
    button.textContent = 'Continuar para o pagamento'
    setupError.textContent = `A inscrição será vinculada à conta ${auth.account().email}. O valor e as condições serão exibidos no checkout seguro.`
    setupError.append(document.createElement('br'), button)
    const idempotencyKey = crypto.randomUUID()
    button.addEventListener('click', async () => {
      button.disabled = true
      const result = await window.RVApi.request('/api/orders', { method: 'POST', body: { productId: 'rv30' }, headers: { 'Idempotency-Key': idempotencyKey } })
      if (result.ok && result.order?.checkoutUrl) {
        try {
          const target = new URL(result.order.checkoutUrl)
          if (target.protocol === 'https:' && ['www.mercadopago.com.br', 'sandbox.mercadopago.com.br'].includes(target.hostname)) { location.assign(target.href); return }
        } catch {}
      }
      const note = document.createElement('p'); note.setAttribute('role', 'alert')
      note.textContent = result.message || 'Checkout indisponível. Nenhum acesso foi liberado.'
      setupError.append(note); button.disabled = false
    })
    return
  }

  if (!course) {
    if (form) form.hidden = true
    if (setupError) {
      setupError.hidden = false
      setupError.textContent = 'Este produto não está disponível para compra.'
    }
    return
  }


  const money = (value) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(value || 0) / 100)
  const providerLabel = course.paymentProviderLabel || paymentProviderLabels[course.paymentProvider] || 'checkout seguro'
  document.querySelectorAll('[data-order-title]').forEach((el) => { el.textContent = course.title })
  document.querySelectorAll('[data-order-total]').forEach((el) => { el.textContent = money(course.priceCents) })
  document.querySelectorAll('[data-order-daily]').forEach((el) => { el.textContent = money(course.dailyPriceCents) })
  document.querySelectorAll('[data-payment-provider]').forEach((el) => { el.textContent = providerLabel })

  function withAttribution(url) {
    try {
      const target = new URL(url)
      const attr = window.RVAnalytics?.attribution?.() || {}
      Object.entries(attr).forEach(([key, value]) => target.searchParams.set(key, value))
      return target.toString()
    } catch {
      return url
    }
  }

  function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 15)
  }

  function readCustomer() {
    if (customer) return customer
    try {
      customer = JSON.parse(sessionStorage.getItem('rv-checkout-customer-v6') || 'null')
    } catch {
      customer = null
    }
    return customer
  }

  function captureCustomer() {
    const data = new FormData(form)
    customer = {
      courseId: course.id,
      name: String(data.get('name') || '').trim(),
      email: String(data.get('email') || '').trim().toLowerCase(),
      phone: normalizePhone(data.get('phone')),
      amountCents: course.priceCents
    }
    sessionStorage.setItem('rv-checkout-customer-v6', JSON.stringify(customer))
    return customer
  }

  // Um simples link de pagamento nao comprova criacao segura de matricula.
  // Falhar fechado ate existir integracao real com confirmacao server-side.
  const productionReady = !config.testMode
    && config.salesEnabled === true
    && config.productionAccessVerified === true
    && Boolean(course.paymentUrl)
  const productionMisconfigured = !config.testMode && !productionReady
  const simulationEnabled = config.testMode && config.enablePaymentSimulation === true

  if (productionReady) {
    if (productionButton) productionButton.href = withAttribution(course.paymentUrl)
  }

  if (productionMisconfigured) {
    if (form) form.hidden = true
    if (setupError) {
      setupError.hidden = false
      setupError.textContent = 'Inscrições temporariamente indisponíveis. Estamos finalizando a confirmação do pagamento e a liberação segura das aulas.'
    }
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!form.reportValidity()) return

    const data = captureCustomer()
    if (data.name.length < 3) return form.elements.name.setCustomValidity('Informe seu nome completo.'), form.reportValidity(), form.elements.name.setCustomValidity('')
    if (data.phone.length < 10) return form.elements.phone.setCustomValidity('Informe um WhatsApp válido com DDD.'), form.reportValidity(), form.elements.phone.setCustomValidity('')

    window.RVAnalytics?.track('InitiateCheckout', {
      content_ids: [course.id],
      value: course.priceCents / 100,
      currency: 'BRL',
      provider: course.paymentProvider
    })

    if (productionReady) {
      location.href = withAttribution(course.paymentUrl)
      return
    }

    if (simulationEnabled && testBox) {
      testBox.hidden = false
      testBox.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (setupError) {
      setupError.hidden = false
      setupError.textContent = 'Pagamento temporariamente indisponível. A configuração do gateway ainda não foi concluída.'
    }
  })

  productionButton?.addEventListener('click', () => {
    if (!productionReady) return
    window.RVAnalytics?.track('InitiateCheckout', {
      content_ids: [course.id],
      value: course.priceCents / 100,
      currency: 'BRL',
      provider: course.paymentProvider
    })
  })

  document.querySelector('[data-simulate-payment]')?.addEventListener('click', () => {
    if (!simulationEnabled) return
    const testError = document.querySelector('[data-test-payment-error]')
    if (testError) testError.textContent = ''

    const data = readCustomer()
    if (!data) {
      if (testError) testError.textContent = 'Preencha os dados do comprador antes de simular o pagamento.'
      return
    }

    let order
    try { order = auth.createDemoOrder(data) } catch {
      if (testError) testError.textContent = 'Não foi possível criar o pedido de teste. Tente novamente.'
      return
    }
    if (!order || order.ok === false || !order.id) {
      if (testError) testError.textContent = order?.message || 'Não foi possível criar o pedido de teste.'
      return
    }

    window.RVAnalytics?.track('Purchase', {
      content_ids: [course.id],
      transaction_id: order.id,
      value: course.priceCents / 100,
      currency: 'BRL',
      test_mode: true
    })
    const successUrl = `/pagamento/sucesso?pedido=${encodeURIComponent(order.id)}&demo=1`
    location.href = window.RVRoute?.resolve(successUrl) || successUrl
  })
})()
