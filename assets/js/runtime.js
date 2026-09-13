(() => {
  'use strict'
  const config = window.RV_COURSE_CONFIG || {}
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid']
  const params = new URLSearchParams(location.search)
  const found = {}
  keys.forEach((key) => { const value = params.get(key); if (value) found[key] = value.slice(0,180) })
  if (Object.keys(found).length) sessionStorage.setItem('rv-marketing-attribution-v6', JSON.stringify(found))

  function attribution() {
    try { return JSON.parse(sessionStorage.getItem('rv-marketing-attribution-v6') || '{}') } catch { return {} }
  }
  function rememberEvent(name,payload) {
    try {
      const events = JSON.parse(sessionStorage.getItem('rv-analytics-events-v6') || '[]')
      events.push({name,payload,at:new Date().toISOString()})
      sessionStorage.setItem('rv-analytics-events-v6',JSON.stringify(events.slice(-30)))
    } catch {}
  }
  window.RVAnalytics = {
    attribution,
    track(name,payload={}) {
      const data = {...payload,...attribution()}
      rememberEvent(name,data)
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({event:name,...data})
      if (typeof window.fbq === 'function') {
        const map={PageView:'PageView',ViewContent:'ViewContent',InitiateCheckout:'InitiateCheckout',Purchase:'Purchase'}
        if (map[name]) window.fbq('track',map[name],data)
      }
    }
  }

  function localRoute(path, search = '') {
    const routes = {
      '/entrar': 'login.html',
      '/meus-cursos': 'aluno.html',
      '/checkout/rv30': 'checkout.html?curso=rv30',
      '/curso/rv30': 'area.html',
      '/pagamento/sucesso': 'pagamento-confirmado.html',
      '/admin': 'admin.html',
      '/suporte': 'suporte.html',
      '/admin/suporte': 'suporte.html?perfil=admin',
      '/admin/videos': 'admin-videos.html',
      '/admin/entrar': 'admin-login.html'
    }
    const day = path.match(/^\/curso\/rv30\/dia\/(\d+)$/)?.[1]
    const target = day ? `area.html?day=${encodeURIComponent(day)}` : routes[path]
    if (!target) return null
    if (!search) return `/${target}`
    return target.includes('?') ? `/${target}&${search.slice(1)}` : `/${target}${search}`
  }

  const isLocalHost = () => ['localhost', '127.0.0.1', '::1'].includes(location.hostname)

  function resolveRoute(value) {
    if (!isLocalHost()) return value
    try {
      const url = new URL(value, location.href)
      if (url.origin !== location.origin) return value
      const target = localRoute(url.pathname, url.search)
      return target ? `${target}${url.hash}` : value
    } catch {
      return value
    }
  }

  window.RVRoute = { resolve: resolveRoute }

  function setupLocalCleanRoutes() {
    if (!isLocalHost()) return
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]')
      if (!link || link.target || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) return
      const target = localRoute(url.pathname, url.search)
      if (!target) return
      event.preventDefault()
      location.href = `${target}${url.hash}`
    })
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupLocalCleanRoutes()
    document.querySelectorAll('[data-current-year]').forEach((el)=>{el.textContent=String(new Date().getFullYear())})
    if (config.testMode) {
      document.documentElement.classList.add('rv-test-mode')
      const banner=document.createElement('div')
      banner.className='test-env-banner'
      banner.dataset.testEnv='true'
      banner.setAttribute('role','status')
      banner.innerHTML='<strong>AMBIENTE DE TESTE</strong><span>Pagamento e acesso são simulados neste navegador. Nenhum cartão é solicitado aqui.</span>'
      document.body.prepend(banner)
    }
    window.RVAnalytics.track('PageView',{page:location.pathname||'/'})
  })
})()
