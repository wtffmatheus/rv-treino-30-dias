(async () => {
  'use strict'
  if (!window.RVApi) return
  await window.RVApi.ready
  const panel = document.querySelector('[data-account-actions]')
  if (!panel || !window.RVApi.serverMode) return
  const loginForm = document.querySelector('[data-login-form]')
  const message = document.querySelector('[data-login-message]')
  if (!window.RVApi.configured) {
    if (loginForm) loginForm.hidden = true
    if (message) message.textContent = 'O acesso está em preparação. As inscrições serão abertas após a configuração da plataforma.'
    return
  }
  panel.hidden = false
  function bind(selector, endpoint, read, onSuccess) {
    const form = panel.querySelector(selector)
    form.addEventListener('submit', async event => {
      event.preventDefault()
      if (!form.reportValidity()) return
      const button = form.querySelector('button[type=submit]')
      const status = form.querySelector('[role=status]')
      button.disabled = true; status.textContent = 'Aguarde…'
      const result = await window.RVApi.request(endpoint, { method: 'POST', body: read(new FormData(form)) })
      button.disabled = false
      status.textContent = result.message || (result.ok ? 'Confira seu e-mail para continuar.' : 'Não foi possível concluir. Tente novamente.')
      if (result.ok && onSuccess) onSuccess(result)
    })
  }
  bind('[data-signup-form]', '/api/auth/signup', data => ({ name: data.get('name'), email: data.get('email'), password: data.get('password') }))
  bind('[data-recover-form]', '/api/auth/recover', data => ({ email: data.get('email') }))
  // Visiting a link never exchanges its one-time credential.
  const fragment = new URLSearchParams(location.hash.slice(1))
  const tokenHash = fragment.get('token_hash')
  const type = fragment.get('type')
  if (tokenHash && ['email', 'recovery'].includes(type)) {
    history.replaceState({}, '', location.pathname + location.search)
    const verification = panel.querySelector('[data-verify-form]')
    verification.hidden = false
    verification.querySelector('[data-verify-title]').textContent = type === 'recovery' ? 'Definir nova senha' : 'Confirmar meu e-mail'
    const password = verification.querySelector('[name=password]')
    password.closest('label').hidden = type !== 'recovery'
    password.required = type === 'recovery'
    bind('[data-verify-form]', '/api/auth/verify', data => ({ tokenHash, type, ...(type === 'recovery' ? { password: data.get('password') } : {}) }), () => {
      location.href = window.RVRoute?.resolve('/meus-cursos') || '/meus-cursos'
    })
  }
  if (location.hash === '#recuperar') {
    const recovery = panel.querySelector('#recuperar')
    recovery.open = true
    recovery.querySelector('input').focus()
  }
})()
