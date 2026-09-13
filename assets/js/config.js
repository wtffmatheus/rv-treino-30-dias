(() => {
  'use strict'

  const host = window.location.hostname

  const localHosts = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '::1'
  ]

  const testHosts = [
    ...localHosts,
    'treino.rvfisiologista.com.br',
    'rv-treino-30-dias.vercel.app'
  ]

  window.RV_COURSE_CONFIG = {
    testMode: testHosts.includes(host),

    // Simulacao de pagamento continua disponivel apenas localmente.
    enablePaymentSimulation: localHosts.includes(host),

    demoStudent: {
      name: 'Aluno Teste',
      email: 'aluno@rv.com.br',
      password: '123456'
    },

    demoAdmin: {
      email: 'admin@rvfisiologia.test',
      password: 'rv30admin'
    },

    whatsapp: '5511991234513',
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
        eyebrow: 'PROJETO 30 DIAS',
        description: 'Projeto guiado de 30 dias com vÃ­deos, orientaÃ§Ã£o diÃ¡ria, comentÃ¡rios e acompanhamento do progresso.',
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
        title: 'RV ForÃ§a',
        eyebrow: 'PROGRAMA',
        description: 'EspaÃ§o reservado para um futuro programa RV.',
        duration: 'Em planejamento',
        priceCents: null,
        status: 'soon'
      },
      {
        id: 'hipertrofia',
        title: 'RV Hipertrofia',
        eyebrow: 'PROGRAMA',
        description: 'EspaÃ§o reservado para um futuro programa RV.',
        duration: 'Em planejamento',
        priceCents: null,
        status: 'soon'
      },
      {
        id: 'condicionamento',
        title: 'RV Condicionamento',
        eyebrow: 'PROGRAMA',
        description: 'EspaÃ§o reservado para um futuro programa RV.',
        duration: 'Em planejamento',
        priceCents: null,
        status: 'soon'
      }
    ]
  }
})()