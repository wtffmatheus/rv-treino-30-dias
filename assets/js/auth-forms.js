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
  if (window.RVApi.qaOnly && !window.RVApi.platformIdentity) {
    panel.hidden = true
    if (message) message.textContent = 'Acesso de validação RV 30. Use a conta de teste liberada pelo responsável. Cadastros e vendas serão abertos após a homologação.'
    return
  }
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
    form.querySelector('button[type=submit]').disabled=false
  }
  if(window.RVApi.platformIdentity){
    panel.querySelectorAll('[data-signup-form], [data-recover-form]').forEach(form=>form.closest('details').hidden=true)
    if(message&&new URLSearchParams(location.search).get('senha')!=='definida')message.textContent='Entre com sua conta. Para definir ou recuperar a senha, use um convite privado fornecido pela equipe após confirmar sua identidade. O cadastro público e o envio automático de e-mails ainda estão em preparação.'
    const fragment=new URLSearchParams(location.hash.slice(1)),token=fragment.get('token'),type=fragment.get('type')
    if(token&&['invitation','recovery'].includes(type)){
      history.replaceState({},'',location.pathname+location.search)
      loginForm.hidden=true
      const verification=panel.querySelector('[data-verify-form]'),password=verification.querySelector('[name=password]')
      verification.hidden=false;verification.querySelector('[data-verify-title]').textContent=type==='recovery'?'Definir nova senha':'Ativar meu acesso'
      password.closest('label').hidden=false;password.required=true
      bind('[data-verify-form]','/api/auth/accept',data=>({token,password:data.get('password')}),()=>{location.href='/entrar?senha=definida'})
    }
    return
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
