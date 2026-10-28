(() => {
  'use strict'

  const CONFIG = window.RV_COURSE_CONFIG


  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)


  function setupPricing() {
    if (window.RVApi?.serverMode) { window.RVApi.applyPricing(); return }
    const course = CONFIG.courses.find((item) => item.id === 'rv30')
    if (!course) return
    const total = money(course.priceCents)
    const daily = money(course.dailyPriceCents)
    document.querySelectorAll('[data-price-total]').forEach((el) => { el.textContent = total })
    document.querySelectorAll('[data-price-daily]').forEach((el) => { el.textContent = daily })
  }

  function renderCatalog() {
    const grid = document.querySelector('[data-catalog-grid]')
    if (!grid) return

    const featured = CONFIG.courses.filter((course) => ['rv30', 'forca'].includes(course.id))
    grid.innerHTML = featured.map((course) => {
      const available = course.status === 'available'
      const verifiedPrice = window.RVApi?.serverMode ? window.RVApi.priceCents : course.priceCents
      const price = available && verifiedPrice
        ? `<strong>${money(verifiedPrice)}</strong><small>Programa com sequência de 30 dias</small>`
        : '<strong>A confirmar</strong><small>Inscrições em preparação</small>'

      return `
        <article class="catalog-card ${available ? 'catalog-card--active' : ''} reveal is-visible">
          <div class="catalog-card-top"><small>${course.eyebrow}</small>${available ? '<span>PROGRAMA DE 30 DIAS</span>' : '<span>EM PLANEJAMENTO</span>'}</div>
          <h3>${course.title}</h3>
          <p>${course.description}</p>
          <div class="catalog-card-bottom"><div>${price}</div>${available ? `<button type="button" class="button button--secondary" data-buy="${course.id}">Conhecer inscrição</button>` : '<span class="rv-catalog-upcoming">Ainda não disponível para contratação</span>'}</div>
        </article>
      `
    }).join('')
  }

  function salesReady(course) {
    if (!course || course.status !== 'available') return false
    if (window.RVApi?.serverMode) return window.RVApi.salesEnabled === true
    if (CONFIG.testMode === true) return true
    return CONFIG.salesEnabled === true &&
      CONFIG.productionAccessVerified === true &&
      typeof course.paymentUrl === 'string' &&
      /^https:\/\//.test(course.paymentUrl)
  }

  function updateSalesStatus() {
    const course = CONFIG.courses.find((item) => item.id === 'rv30')
    const enrollmentOpen = CONFIG.testMode !== true && salesReady(course)
    const enrollmentCopy = enrollmentOpen ? {
      '[data-sales-summary]': 'Inscrições disponíveis. Confira as condições do RV 30 antes de concluir a compra.',
      '[data-sales-label]': 'Inscrições disponíveis',
      '[data-sales-detail]': 'Consulte as condições de pagamento e de acesso ao programa antes de concluir a compra.',
      '[data-sales-faq]': 'Você pode iniciar sua inscrição pelos botões desta página. O acesso ao programa depende da confirmação do pagamento.'
    } : {
      '[data-sales-summary]': 'Inscrições em preparação. A compra será disponibilizada após a liberação do programa.',
      '[data-sales-label]': 'Inscrições em preparação',
      '[data-sales-detail]': 'A compra ainda não está disponível. As condições finais serão apresentadas antes do pagamento.',
      '[data-sales-faq]': 'As inscrições estão em preparação. A compra será liberada após a confirmação das condições de pagamento e da disponibilidade do programa.'
    }
    Object.entries(enrollmentCopy).forEach(([selector, message]) => {
      document.querySelectorAll(selector).forEach((element) => { element.textContent = message })
    })
    if (salesReady(course)) return
    document.querySelectorAll('[data-buy]').forEach((button) => {
      button.disabled = true
      button.setAttribute('aria-label', 'Inscrições ainda não liberadas')
      button.textContent = 'Inscrições em preparação'
    })
  }

  function buy(courseId) {
    const course = CONFIG.courses.find((item) => item.id === courseId)
    if (!salesReady(course)) return

    window.RVAnalytics?.track('ViewContent', { content_ids: [course.id], content_name: course.title })
    const checkoutPath = course.slug ? `/checkout/${encodeURIComponent(course.slug)}` : `checkout.html?curso=${encodeURIComponent(course.id)}`
    window.location.assign(window.RVRoute?.resolve(checkoutPath) || checkoutPath)
  }

  function setupVideo() {
    const shell = document.getElementById('intro-video')
    if (!shell) return
    const url = CONFIG.introVideoUrl || shell.dataset.videoUrl || ''
    if (!url) return

    if (/youtube\.com|youtu\.be/.test(url)) {
      const id = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/)?.[1]
      if (!id) return
      shell.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Apresentação do RV 30" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
      return
    }

    if (/vimeo\.com/.test(url)) {
      const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]
      if (!id) return
      shell.innerHTML = `<iframe src="https://player.vimeo.com/video/${id}" title="Apresentação do RV 30" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
      return
    }

    const video = document.createElement('video')
    video.controls = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = url
    shell.replaceChildren(video)
  }

  function showToast(message) {
    const toast = document.querySelector('[data-toast]')
    if (!toast) return
    toast.textContent = message
    toast.classList.add('is-visible')
    window.clearTimeout(showToast.timer)
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200)
  }

  function setupNavigation() {
    const toggle = document.querySelector('[data-menu-toggle]')
    const menu = document.querySelector('[data-menu]')
    if (!toggle || !menu) return

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true'
      toggle.setAttribute('aria-expanded', String(!open))
      document.body.classList.toggle('menu-open', !open)
    })

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false')
        document.body.classList.remove('menu-open')
      }
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false')
        document.body.classList.remove('menu-open')
        toggle.focus()
      }
    })
  }

  function setupReveal() {
    const items = [...document.querySelectorAll('.reveal')]
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -30px' })

    items.forEach((item) => observer.observe(item))
  }

  function setupHeader() {
    const header = document.querySelector('[data-header]')
    const update = () => header?.classList.toggle('is-scrolled', window.scrollY > 12)
    update()
    window.addEventListener('scroll', update, { passive: true })
  }

  function setupBuyButtons() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-buy]')
      if (!button) return
      buy(button.dataset.buy)
    })
  }

  async function boot() {
    if (window.RVApi) await window.RVApi.ready
    document.documentElement.classList.remove('no-js')
    document.documentElement.classList.add('js')
    setupPricing()
    renderCatalog()
    updateSalesStatus()
    setupVideo()
    setupNavigation()
    setupHeader()
    setupBuyButtons()
    setupReveal()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
