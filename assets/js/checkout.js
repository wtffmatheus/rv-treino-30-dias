(() => {
  'use strict'

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

  const productionReady = !config.testMode && Boolean(course.paymentUrl)
  const productionMisconfigured = !config.testMode && !course.paymentUrl
  const simulationEnabled = config.testMode && config.enablePaymentSimulation === true

  if (productionReady) {
    if (productionButton) productionButton.href = withAttribution(course.paymentUrl)
  }

  if (productionMisconfigured) {
    if (form) form.hidden = true
    if (setupError) {
      setupError.hidden = false
      setupError.textContent = 'Checkout temporariamente indisponível. A configuração de pagamento ainda não foi concluída.'
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

    const order = auth.createDemoOrder(data)
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
