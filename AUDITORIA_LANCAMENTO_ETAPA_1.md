# RV 30 — auditoria de lancamento / etapa 1
**Referencia:** moodboard "Performance e Evolucao" fornecido pelo cliente; codigo em `feature/rv30-drive-30-mov-20261015`, Google Drive privado confirmado por conector em 15/10/2026.

## Veredito: NAO LIBERAR VENDAS NESTA VERSAO
A interface visual nao equivale a um sistema comercial pronto. A branch `main` continua anterior aos PRs #1 (cardio), #3 (design), #4 (importacao .MOV). Nao fazer merge ou deploy sem cumprir os gates abaixo.

## Inventario Google Drive — conferido com conta conectada
- Pasta privada "01 - Videos para revisao": **29 arquivos .MOV**.
- Presentes: **1.MOV ate 29.MOV**, com nomes sem duplicacoes.
- Ausente: **30.MOV** (sem substituicoes automaticamente).
- Arquivos reais: MIME video/quicktime, total aproximado 907,7 MB.
- O conector indica `shared=false`: nao alterar permissoes para acesso publico.
- Manifesto real entregue ao proprietario **separadamente e de forma privada**, contendo links reais dos 29 arquivos. Nenhum ID privado deve ser enviado ao GitHub ou incluidos no build estatico.
- Ainda nao foram verificadas codificacao, tocabilidade por navegador e qualidade da imagem/som. MOV precisa ser inspecionado e eventualmente transcodificado para entrega HLS/MP4 segura.

## Inconsistencias em relacao ao moodboard aprovado
1. **Landing desktop:** referencia usa fotografia esportiva como composicao hero integrada, titulo "Treinamento inteligente para 30 dias", CTA turquesa logo abaixo e quatro diferenciais em linha, seguida de secao marfim. Atual: titulo "Treino com metodo", foto em `figure` lateral, precos e ressalvas muito cedo, secao de baixo diferente.
2. **Landing mobile:** referencia apresenta fotografia de fundo, titulo e CTA em sobreposicao legivel, diferenciais abaixo; atual empilha texto e foto em blocos independentes.
3. **Checkout:** referencia destaca formulario claro, resumo lateral no desktop, termo e aviso de seguranca, precos reais. Atual reorganizou resumo antes do formulario mobile e conteudos intermediarios diferem. Manter todos os campos reais e **nunca prometer pagamento aprovado automaticamente sem gateway**.
4. **Aluno desktop:** referencia exibe menu com Treinos/Progresso/Calculadora/Duvidas/Suporte; area principal com titulo Dia XX, barra do programa, video 16:9, orientacoes laterais. Atual prioriza painel unico vertical, navegacao apenas por dias e calculadora longa apos video.
5. **Aluno mobile:** referencia inclui navegacao inferior funcional com Treino/Progresso/Calculadora/Suporte/Perfil. Atual usa apenas seletor de dias e header. Design mobile do mockup nao foi implementado.
6. **Cardio:** pedido inclui perfil de primeiro acesso, faixa de FC baseada em **FC repouso e FC maxima**, e comparacao com monitor. Implementado: calculo funcional somente no corpo da area, **sem onboarding proprio**. A referencia visual de cinco zonas usando so idade nao substitui Karvonen; a formula das fotos do livro deve prevalecer e explicar limites.

## Ordem de trabalho: uma etapa por vez
- **Etapa 1 — auditoria/inventario.** Validar lista privada de videos, registrar blockers, checklist e mapa preciso de diferencas. Aprovacao: 29 registros reais identificados + 30 ausente explicitado; documento sem IDs publicados; gate automatizado.
- **Etapa 2 — onboarding cardiaco.** Criar fluxo primeiro acesso (opcional/nunca restringir consulta clinica) com idade, FC repouso, FC maxima de teste opcional, nivel, avaliacao de seguranca; formularios acessiveis e possibilidade de nao salvar. Karvonen validado pelos exemplos (137–157 bpm sedentario; 141–168 bpm treinado); limitacoes claras e LGPD. Aprovacao: E2E antes/depois login, celular e limpeza de dados.
- **Etapa 3 — fidelidade visual.** Desenvolver hero desktop/mobile, secoes e navegacao conforme moodboard, sem alegacoes de resultado garantido. Aprovacao: capturas de tela comparadas com referencia, 320–1920 px, sem overflow e com WCAG basico.
- **Etapa 4 — videos.** Confirmar 30.MOV, validar 30 IDs/arquivos e colocar em hospedagem privada com transcodificacao; URLs temporarias acessiveis apenas a matriculados. Aprovacao: 30/30 videos tocaveis em Chrome Android, Safari iPhone e desktop, sem acesso por visitante.
- **Etapa 5 — pagamento/autenticacao.** Implementar Supabase Auth/RLS e gateway verdadeiro. Aprovacao: transacao teste verificada server-side gera matricula; falha/reembolso revoga, idempotencia, usuarios isolados.
- **Etapa 6 — juridico/qualidade.** Revisao de publicidade de emagrecimento, termos, privacidade, identificacao de fornecedor, suporte, acessibilidade e desempenho; audit e2e passam.
- **Etapa 7 — publicar.** Realizar backup, publicar depois dos gates, testar dominio publico, checkout, area do aluno, mobile real, rollback preparado.

## Inspecao tecnica atual
- `assets/js/config.js`: `paymentUrl: ''`; sem operacao de pagamento real.
- `checkout.html` / `area.html`: incluem `auth-demo.js` na aplicacao.
- `assets/js/content.js`: `videoUrl` ainda em branco, sem entrega real.
- `assets/js/cardio.js`: calcula Karvonen validado em testes, mas salva apenas demo local; uso real requer consentimento/backend protegido.
- `assets/data/rv30-videos-template.json`: modelo publico com 30 nomes .mov **sem links privados**.
- `scripts/release-audit.js`: gate estatico intencionalmente NO_GO quando nao existe autenticao/payments/streaming de producao.

## Proximo ato
Concluir Etapa 2 **somente apos a Etapa 1 estar verificada**, sem prometer que esteja pronto para aceitar vendas. O cliente deve disponibilizar `30.MOV` na mesma pasta antes de fechar Etapa 4.
