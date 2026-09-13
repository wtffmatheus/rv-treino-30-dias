(() => {
  'use strict'

  const CONFIG = window.RV_COURSE_CONFIG


  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)


  function setupPricing() {
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

    grid.innerHTML = CONFIG.courses.map((course) => {
      const available = course.status === 'available'
      const price = available && course.priceCents
        ? `<strong>${money(course.priceCents)}</strong><small>${course.duration} • ${money(course.dailyPriceCents)}/dia</small>`
        : '<strong>Em breve</strong><small>Novo projeto RV</small>'

      return `
        <article class="catalog-card ${available ? 'catalog-card--active' : ''} reveal is-visible">
          <div class="catalog-card-top"><small>${course.eyebrow}</small>${available ? '<span>DISPONÍVEL</span>' : '<span>EM BREVE</span>'}</div>
          <h3>${course.title}</h3>
          <p>${course.description}</p>
          <div class="catalog-card-bottom"><div>${price}</div>${available ? `<button type="button" class="button button--secondary" data-buy="${course.id}">Ver projeto</button>` : '<button type="button" class="button button--ghost" disabled>Em preparação</button>'}</div>
        </article>
      `
    }).join('')
  }

  function buy(courseId) {
    const course = CONFIG.courses.find((item) => item.id === courseId)
    if (!course || course.status !== 'available') return

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

  function boot() {
    document.documentElement.classList.remove('no-js')
    document.documentElement.classList.add('js')
    setupPricing()
    renderCatalog()
    setupVideo()
    setupNavigation()
    setupHeader()
    setupBuyButtons()
    setupReveal()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
