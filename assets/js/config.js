(() => {
  'use strict'
  window.RV_COURSE_CONFIG = {
    // Demonstracao limitada ao loopback. Staging exige configuracao deliberada.
    testMode: ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname),
    enablePaymentSimulation: ['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname),
    demoAdmin: { email: 'admin@rvfisiologia.test', password: 'rv30admin' },
    whatsapp: '5511991234513',
    introVideoUrl: '',
    studentLoginUrl: '/entrar',
    legal: { privacyUrl: 'privacidade.html', termsUrl: 'termos.html' },
    courses: [
      { id:'rv30', slug:'rv30', title:'RV 30', eyebrow:'PROJETO 30 DIAS', description:'Projeto guiado de 30 dias com vídeos, orientação diária, comentários e acompanhamento do progresso.', duration:'30 dias', totalDays:30, priceCents:39900, dailyPriceCents:1330, paymentProvider:'stone_link', paymentProviderLabel:'Stone Link de Pagamento', paymentValidationMode:'manual', automationProvider:'mercado_pago', paymentUrl:'', releaseMode:'instant', status:'available' },
      { id:'forca', title:'RV Força', eyebrow:'PROGRAMA', description:'Espaço reservado para um futuro programa RV.', duration:'Em planejamento', priceCents:null, status:'soon' },
      { id:'hipertrofia', title:'RV Hipertrofia', eyebrow:'PROGRAMA', description:'Espaço reservado para um futuro programa RV.', duration:'Em planejamento', priceCents:null, status:'soon' },
      { id:'condicionamento', title:'RV Condicionamento', eyebrow:'PROGRAMA', description:'Espaço reservado para um futuro programa RV.', duration:'Em planejamento', priceCents:null, status:'soon' }
    ]
  }
})()
