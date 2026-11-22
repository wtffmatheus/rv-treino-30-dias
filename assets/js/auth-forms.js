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
    if (!form) return
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
  // Recuperação por código: e-mail → 6 dígitos → nova senha. O servidor decide
  // tudo; esta tela só conduz as etapas e nunca revela se o e-mail existe.
  function setupRecovery(enabled) {
    const open = document.querySelector('[data-recovery-open]')
    const root = document.querySelector('[data-recovery]')
    if (!open || !root) return
    const card = document.querySelector('.auth-card'), lead = message
    const heading = document.getElementById('login-title')
    const steps = Object.fromEntries([...root.querySelectorAll('[data-recovery-step]')].map(node => [node.dataset.recoveryStep, node]))
    const status = root.querySelector('[data-recovery-status]'), title = root.querySelector('[data-recovery-title]')
    const timer = root.querySelector('[data-code-timer]'), resend = root.querySelector('[data-code-resend]')
    const boxes = root.querySelector('[data-code-inputs]')
    const state = { email: '', expiresAt: 0, resendAt: 0, token: '', clock: null }
    const titles = { email: 'Recuperar acesso', code: 'Confira seu e-mail', password: 'Defina a nova senha' }
    for (let i = 0; i < 6; i++) {
      const input = document.createElement('input')
      Object.assign(input, { type: 'text', inputMode: 'numeric', maxLength: 6, autocomplete: i ? 'off' : 'one-time-code' })
      input.setAttribute('aria-label', 'Dígito ' + (i + 1) + ' de 6')
      boxes.append(input)
    }
    const inputs = [...boxes.querySelectorAll('input')]
    const code = () => inputs.map(x => x.value).join('')
    const errorOf = step => steps[step].querySelector('[data-recovery-error]')
    const busy = (button, on) => { button.disabled = on; if (on) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy') }
    const mmss = ms => { const total = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0') }
    const clear = () => inputs.forEach(x => { x.value = ''; x.classList.remove('is-filled') })
    function show(step) {
      for (const [name, node] of Object.entries(steps)) node.hidden = name !== step
      const order = ['email', 'code', 'password'], index = order.indexOf(step)
      root.querySelectorAll('[data-step-marker]').forEach(item => {
        const at = order.indexOf(item.dataset.stepMarker)
        if (at === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current')
        item.classList.toggle('is-done', at < index)
      })
      title.textContent = titles[step]
      for (const name of order) errorOf(name).textContent = ''
      const focus = step === 'code' ? inputs.find(x => !x.value) || inputs[0] : steps[step].querySelector('input')
      requestAnimationFrame(() => focus?.focus())
    }
    function tickClock() {
      const now = Date.now(), left = state.expiresAt - now, wait = state.resendAt - now
      timer.textContent = left > 0 ? 'O código expira em ' + mmss(left) : 'O código expirou. Solicite um novo.'
      timer.classList.toggle('is-expired', left <= 0)
      resend.disabled = wait > 0
      resend.textContent = wait > 0 ? 'Reenviar em ' + Math.ceil(wait / 1000) + ' s' : 'Reenviar código'
    }
    function startClock(result) {
      const now = Date.now()
      state.expiresAt = now + (result.expiresInSeconds || 600) * 1000
      state.resendAt = now + (result.resendAfterSeconds || 60) * 1000
      clearInterval(state.clock); state.clock = setInterval(tickClock, 1000); tickClock()
    }
    function toggle(on) {
      root.hidden = !on; loginForm.hidden = on; open.hidden = on
      if (heading) heading.hidden = on
      if (lead) lead.hidden = on
      card?.classList.toggle('is-recovering', on)
      if (on) show(state.token ? 'password' : state.email && state.expiresAt > Date.now() ? 'code' : 'email')
      else { clearInterval(state.clock); status.textContent = ''; loginForm.querySelector('input')?.focus() }
    }
    async function sendCode(button) {
      busy(button, true); status.textContent = ''
      const result = await window.RVApi.request('/api/auth/recovery/request', { method: 'POST', body: { email: state.email } })
      busy(button, false)
      if (!result.ok) return result
      clear()
      steps.code.querySelector('[data-code-lead]').textContent = 'Se houver uma conta para ' + state.email + ', o código chegará em instantes. Confira também a caixa de spam.'
      startClock(result); show('code'); return result
    }
    open.hidden = false
    open.addEventListener('click', () => {
      const typed = loginForm.querySelector('[name=email]').value.trim()
      if (typed && !state.email) steps.email.querySelector('[name=email]').value = typed
      toggle(true)
      if (!enabled) { errorOf('email').textContent = 'A recuperação por e-mail está em ativação. Fale com a equipe pelo suporte para receber um convite privado.'; steps.email.querySelector('button[type=submit]').disabled = true }
    })
    root.querySelector('[data-recovery-close]').addEventListener('click', () => toggle(false))
    root.addEventListener('keydown', event => { if (event.key === 'Escape') toggle(false) })
    steps.email.addEventListener('submit', async event => {
      event.preventDefault()
      const field = steps.email.querySelector('[name=email]'), error = errorOf('email')
      if (!field.value.trim() || !field.checkValidity()) { error.textContent = 'Informe um e-mail válido.'; field.focus(); return }
      state.email = field.value.trim().toLowerCase(); error.textContent = ''
      const result = await sendCode(steps.email.querySelector('button[type=submit]'))
      if (!result.ok) error.textContent = result.message
    })
    resend.addEventListener('click', async () => {
      const result = await sendCode(resend)
      if (result.ok) status.textContent = 'Se o e-mail estiver cadastrado, um novo código foi enviado. O anterior deixou de valer.'
      else errorOf('code').textContent = result.message
    })
    root.querySelector('[data-code-change]').addEventListener('click', () => { state.email = ''; state.expiresAt = 0; clearInterval(state.clock); status.textContent = ''; show('email') })
    function fill(digits, from) {
      digits.slice(0, 6 - from).split('').forEach((digit, offset) => { inputs[from + offset].value = digit; inputs[from + offset].classList.add('is-filled') })
      ;(inputs.find(x => !x.value) || inputs[5]).focus()
      if (code().length === 6) steps.code.requestSubmit()
    }
    inputs.forEach((input, index) => {
      input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '')
        if (digits.length > 1) { input.value = ''; fill(digits, index); return }
        input.value = digits; input.classList.toggle('is-filled', !!digits)
        if (digits && index < 5) inputs[index + 1].focus()
        if (code().length === 6) steps.code.requestSubmit()
      })
      input.addEventListener('keydown', event => {
        if (event.key === 'Backspace' && !input.value && index > 0) { event.preventDefault(); inputs[index - 1].value = ''; inputs[index - 1].classList.remove('is-filled'); inputs[index - 1].focus() }
        if (event.key === 'ArrowLeft' && index > 0) inputs[index - 1].focus()
        if (event.key === 'ArrowRight' && index < 5) inputs[index + 1].focus()
      })
      input.addEventListener('paste', event => { event.preventDefault(); fill((event.clipboardData?.getData('text') || '').replace(/\D/g, ''), 0) })
    })
    steps.code.addEventListener('submit', async event => {
      event.preventDefault()
      const error = errorOf('code'), button = steps.code.querySelector('button[type=submit]')
      if (button.disabled) return
      if (code().length !== 6) { error.textContent = 'Digite os 6 dígitos do código.'; return }
      if (state.expiresAt <= Date.now()) { error.textContent = 'O código expirou. Solicite um novo.'; return }
      busy(button, true); boxes.removeAttribute('aria-invalid')
      const result = await window.RVApi.request('/api/auth/recovery/verify', { method: 'POST', body: { email: state.email, code: code() } })
      busy(button, false)
      if (!result.ok) {
        error.textContent = result.message; boxes.setAttribute('aria-invalid', 'true')
        boxes.classList.remove('is-shaking'); void boxes.offsetWidth; boxes.classList.add('is-shaking')
        clear(); inputs[0].focus(); return
      }
      state.token = result.token; clearInterval(state.clock); status.textContent = ''; show('password')
    })
    const password = steps.password.querySelector('[name=password]'), confirm = steps.password.querySelector('[name=confirm]')
    const rule = steps.password.querySelector('[data-password-rule]'), toggleView = steps.password.querySelector('[data-password-toggle]')
    password.addEventListener('input', () => {
      const size = password.value.length
      rule.classList.toggle('is-ok', size >= 12 && size <= 128)
      rule.textContent = size > 128 ? 'Use no máximo 128 caracteres.' : size >= 12 ? 'Tamanho adequado.' : 'Mínimo de 12 caracteres · faltam ' + (12 - size) + '.'
    })
    toggleView.addEventListener('click', () => {
      const visible = password.type === 'text'
      password.type = confirm.type = visible ? 'password' : 'text'
      toggleView.textContent = visible ? 'Mostrar' : 'Ocultar'; toggleView.setAttribute('aria-pressed', String(!visible))
    })
    steps.password.addEventListener('submit', async event => {
      event.preventDefault()
      const error = errorOf('password'), button = steps.password.querySelector('button[type=submit]')
      if (password.value.length < 12 || password.value.length > 128) { error.textContent = 'Use uma senha de 12 a 128 caracteres.'; password.focus(); return }
      if (password.value !== confirm.value) { error.textContent = 'As senhas não coincidem.'; confirm.focus(); return }
      busy(button, true)
      const result = await window.RVApi.request('/api/auth/accept', { method: 'POST', body: { token: state.token, password: password.value } })
      busy(button, false)
      if (!result.ok) {
        error.textContent = result.message
        if (result.code === 'TOKEN_INVALID') { state.token = ''; error.textContent = 'A etapa de confirmação expirou. Solicite um novo código.'; setTimeout(() => show('email'), 1800) }
        return
      }
      password.value = confirm.value = ''
      location.href = '/entrar?senha=redefinida'
    })
    if (location.hash === '#recuperar') open.click()
  }
  if(window.RVApi.platformIdentity){
    window.addEventListener('hashchange',()=>{
      const incoming=new URLSearchParams(location.hash.slice(1))
      if(incoming.has('token') && ['recovery','invitation'].includes(incoming.get('type'))) location.reload()
    })
    panel.querySelectorAll('[data-signup-form]').forEach(form=>form.closest('details').hidden=true)
    const outcome=new URLSearchParams(location.search).get('senha')
    if(message&&outcome)message.classList.add('login-notice')
    if(message&&!outcome)message.textContent='Entre com o e-mail e a senha da sua conta.'
    setupRecovery(window.RVApi.recoveryMode==='email_code')
    const fragment=new URLSearchParams(location.hash.slice(1)),token=fragment.get('token'),type=fragment.get('type')
    if(token&&['invitation','recovery'].includes(type)){
      history.replaceState({},'',location.pathname+location.search)
      const heading=document.getElementById('login-title')
      if(heading)heading.textContent=type==='recovery'?'Recuperar minha conta':'Ativar meu acesso'
      if(message)message.textContent=type==='recovery'?'Escolha uma nova senha para voltar ao RV30.':'Escolha a senha que você usará para entrar no RV30.'
      loginForm.hidden=true
      const verification=panel.querySelector('[data-verify-form]'),password=verification.querySelector('[name=password]')
      verification.hidden=false;verification.querySelector('[data-verify-title]').textContent=type==='recovery'?'Definir nova senha':'Ativar meu acesso'
      verification.querySelector('[data-verify-title]').hidden=Boolean(heading)
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
