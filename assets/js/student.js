(() => {
  'use strict'

  const auth = (window.RVCourseStore || window.RVCourseAuthDemo)
  if (!auth.isLoggedIn()) {
    const loginUrl = '/entrar?next=/meus-cursos'
    location.replace(window.RVRoute?.resolve(loginUrl) || loginUrl)
    return
  }

  const account = auth.account()
  if (!account) {
    auth.logout()
    location.replace(window.RVRoute?.resolve('/entrar') || '/entrar')
    return
  }

  document.querySelector('[data-student-name]').textContent = account.name
  document.querySelector('[data-first-name]').textContent = account.name.split(/\s+/)[0] || 'aluno'

  const grid = document.querySelector('[data-course-list]')
  const items = Array.isArray(account.entitlements) ? account.entitlements : []

  if (!items.length) {
    grid.innerHTML = '<div class="course-empty">Nenhum curso está liberado para esta conta. Se você acabou de comprar, aguarde a confirmação do pagamento ou fale com a RV Fisiologia.</div>'
  } else {
    const summary = auth.courseProgressSummary('rv30')
    grid.innerHTML = items.map((id) => id === 'rv30' ? `
      <article class="my-course-card">
        <div class="my-course-cover"><span>RV</span><strong>30</strong><small>PROJETO 30 DIAS</small></div>
        <div class="my-course-copy">
          <small>ACESSO LIBERADO</small>
          <h3>RV 30</h3>
          <p>Seu projeto de 30 dias com vídeos, orientações, comentários e acompanhamento de progresso.</p>
          <div class="student-progress-line"><strong>${summary.completed} de 30 dias</strong><span>${summary.percent}% concluído</span></div>
          <progress class="native-progress native-progress--small" max="30" value="${summary.completed}" aria-label="Progresso no RV 30"></progress>
          <a class="button button--primary" href="/curso/rv30?day=${summary.nextDay}">${summary.completed ? 'Continuar de onde parei' : 'Começar projeto'}</a>
        </div>
      </article>` : '').join('')
  }

  document.querySelector('[data-logout]')?.addEventListener('click', () => {
    auth.logout()
    location.href = window.RVRoute?.resolve('/entrar') || '/entrar'
  })
})()
