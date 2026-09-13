(() => {
  'use strict'

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const form = document.querySelector('[data-login-form]')
  const error = document.querySelector('[data-form-error]')
  const message = document.querySelector('[data-login-message]')
  const params = new URLSearchParams(location.search)

  function safeNext(value) {
    if (!value) return '/meus-cursos'
    try {
      const url = new URL(value, location.href)
      if (url.origin !== location.origin) return '/meus-cursos'
      const allowed = new Set(['/meus-cursos', '/aluno.html', '/area.html', '/aluno', '/curso/rv30', '/suporte'])
      return allowed.has(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : '/meus-cursos'
    } catch {
      return '/meus-cursos'
    }
  }

  const next = safeNext(params.get('next'))

  if (params.get('novo') === '1' && message) {
    message.textContent = 'Acesso criado. Entre agora com o e-mail da compra e a senha que você acabou de definir.'
  }

  if (auth.isLoggedIn()) {
    location.replace(window.RVRoute?.resolve(next) || next)
    return
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    if (error) error.textContent = ''
    const data = new FormData(form)
    const result = auth.login(data.get('email'), data.get('password'))
    if (!result.ok) {
      if (error) error.textContent = result.message
      return
    }
    location.href = window.RVRoute?.resolve(next) || next
  })
})()
