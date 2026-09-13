(() => {
  'use strict'

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  const form = document.querySelector('[data-admin-login-form]')
  const error = document.querySelector('[data-form-error]')
  const params = new URLSearchParams(location.search)
  const note = document.querySelector('[data-admin-test-note]')

  if (params.get('expired') === '1' && note) {
    note.textContent = 'Sua sessÃ£o administrativa expirou. Entre novamente para continuar.'
  }

  if (!window.RV_COURSE_CONFIG?.testMode) {
    if (note) note.textContent = 'O login administrativo de demonstraÃ§Ã£o estÃ¡ desativado.'
    if (form) form.hidden = true
    return
  }

  if (auth.isAdminLoggedIn()) {
    location.replace('/admin')
    return
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (error) error.textContent = ''

    const data = new FormData(form)
    const result = auth.adminLogin(data.get('email'), data.get('password'))

    if (!result.ok) {
      if (error) error.textContent = result.message
      return
    }

    location.href = '/admin'
  })
})()