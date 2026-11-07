(async () => {
  'use strict'

  if (window.RVApi) await window.RVApi.ready

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const form = document.querySelector('[data-admin-login-form]')
  const error = document.querySelector('[data-form-error]')
  const params = new URLSearchParams(location.search)
  const note = document.querySelector('[data-admin-test-note]')

  if (window.RVApi?.qaOnly) {
    if (note) note.textContent = 'Use a conta administrativa de teste liberada para validar o RV 30. Vendas reais continuam desativadas.'
    document.querySelector('a[href="/entrar#recuperar"]')?.closest('p')?.setAttribute('hidden', '')
  }
  if(window.RVApi?.platformIdentity){
    const lead=document.querySelector('.auth-card .portal-lead')
    if(lead)lead.textContent='Entre com sua identidade profissional. O papel administrativo é autorizado no servidor e a matrícula no curso é gerenciada separadamente.'
    if(note)note.textContent='Para definir ou recuperar a senha, solicite um convite privado após confirmar sua identidade com a equipe.'
  }

  if (params.get('expired') === '1' && note) {
    note.textContent = 'Sua sessão administrativa expirou. Entre novamente para continuar.'
  }

  if ((window.RVApi?.serverMode || !window.RV_COURSE_CONFIG?.testMode) && !window.RVApi?.configured) {
    if (note) note.textContent = 'O acesso administrativo está em preparação.'
    if (form) form.hidden = true
    return
  }

  if (auth.isAdminLoggedIn()) {
    location.replace('/admin')
    return
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (error) error.textContent = ''

    const data = new FormData(form)
    const button = form.querySelector('button[type=submit]')
    button.disabled = true
    const result = await auth.adminLogin(data.get('email'), data.get('password'))
    button.disabled = false

    if (!result.ok) {
      if (error) error.textContent = result.message
      return
    }

    location.href = '/admin'
  })
})()
