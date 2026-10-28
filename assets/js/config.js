(() => {
  'use strict'

  const host = window.location.hostname

  const localHosts = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '::1'
  ]

  window.RV_COURSE_CONFIG = {
    testMode: localHosts.includes(host),

    // Simulacao de pagamento continua disponivel apenas localmente.
    enablePaymentSimulation: localHosts.includes(host),

    // Lancamento comercial: bloqueado ate backend, comprovacao server-side
    // de pagamento e videos privados serem testados em ambiente real.
    // Alterar apenas apos a validacao do checklist de producao.
    salesEnabled: false,
    productionAccessVerified: false,

    demoStudent: {
      name: 'Aluno Teste',
      email: 'aluno@rv.com.br',
      password: '123456'
    },

    demoAdmin: {
      email: 'admin@rvfisiologia.test',
      password: 'rv30admin'
    },

    whatsapp: '', // Preencher somente com o contato comercial confirmado.
    introVideoUrl: '',
    studentLoginUrl: '/entrar',

    legal: {
      privacyUrl: '/privacidade',
      termsUrl: '/termos'
    },

    courses: [
      {
        id: 'rv30',
        slug: 'rv30',
        title: 'RV 30',
        tagline: 'Seu corpo. Seu ritmo. Sua evolução.',
        eyebrow: 'RV 30 · PROGRAMA DE TREINOS',
        description: 'Projeto guiado de 30 dias com vídeos, orientação diária, comentários e acompanhamento do progresso.',
        duration: '30 dias',
        totalDays: 30,
        priceCents: 39900,
        dailyPriceCents: 1330,
        paymentProvider: 'stone_link',
        paymentProviderLabel: 'Stone Link de Pagamento',
        paymentValidationMode: 'manual',
        automationProvider: 'mercado_pago',
        paymentUrl: '',
        releaseMode: 'instant',
        status: 'available'
      },
      {
        id: 'forca',
        title: 'Treinamento personalizado',
        eyebrow: 'PROGRAMA',
        description: 'Acompanhamento individualizado da RV Fisiologia. Disponibilidade e condições serão informadas futuramente.',
        duration: 'Em planejamento',
        priceCents: null,
        status: 'soon'
      },
      {
        id: 'hipertrofia',
        title: 'RV Hipertrofia',
        eyebrow: 'PROGRAMA',
        description: 'Espaço reservado para um futuro programa RV.',
        duration: 'Em planejamento',
        priceCents: null,
        status: 'soon'
      },
      {
        id: 'condicionamento',
        title: 'RV Condicionamento',
        eyebrow: 'PROGRAMA',
        description: 'Espaço reservado para um futuro programa RV.',
        duration: 'Em planejamento',
        priceCents: null,
        status: 'soon'
      }
    ]
  }
})()
