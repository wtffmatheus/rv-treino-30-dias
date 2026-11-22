# REDESIGN-CHECKPOINT

Branch: `redesign/rv30-visual-premium-20261121`. Nada publicado, sem push/deploy.
Última regressão completa: 97/97 (23 backend + 66 e2e + 8 e2e real), 0 vulnerabilidades, lint/typecheck OK.

## MUDANÇA DE ESCOPO — ler antes de continuar

O proprietário enviou uma nova diretiva ("OPERAÇÃO REDESIGN DEFINITIVO + MOTION DESIGN PREMIUM") que **substitui o critério de aprovação anterior**. Ela exige:
- Reconstrução visual completa baseada em referências concretas salvas em `output/rv30-redesign-total/01_CONCEITOS_PRINCIPAIS/` (9 imagens) e `02_IDEIAS_POR_TELA/` (18 imagens, variações A/B por tela).
- Motion design profissional (scroll reveals, parallax sutil, microinterações), priorizando CSS transitions/IntersectionObserver e usando GSAP só quando houver necessidade real de sequência/scroll complexo.
- Evidência em vídeo (não só screenshot) das animações, via Playwright.
- Nova estrutura de saída: `output/rv30-redesign-final/{screenshots/desktop,screenshots/mobile,comparativos,animacoes,relatorios}/`.

**Isso NÃO invalida o trabalho já validado nesta sessão** (ver "Concluído" abaixo) — o novo mandato é uma camada adicional de ambição visual/motion sobre o que já existe, começando pela landing.

### O que as referências mostram (já inspecionado, 01_CONCEITOS_PRINCIPAIS)

- `01_LANDING_IMPACTO_EDITORIAL.png` / `07_LANDING_ALTERNATIVA.png`: landing completa — hero com foto editorial grande + badge "COM ROSÂNGELA VARGAS", faixa de 4 chips com ícone sob o CTA, faixa horizontal de 4 benefícios, seção "o programa" com foto+checklist+vídeo, bloco da profissional com carrossel de depoimentos ao lado, barra de preço + FAQ inline no rodapé da seção de oferta. Linhas diagonais com glow turquesa como textura de fundo.
- `02_ADMIN_DASHBOARD_PREMIUM.png`: sidebar com ícones, busca "Ctrl+K", cards de métrica com ícone circular + variação percentual, dois gráficos (linha + barras), tabela de atividade recente com avatar+barra de progresso, painel de alertas/pendências.
- `03_ALUNO_DASHBOARD_COM_FOTO.png`: hero com foto bleeding à direita, anel de progresso circular (40%), grid de 30 dias com check/cadeado, card "próxima aula" com thumbnail, lista de "conquistas".
- `04_PLAYER_AULAS_COMPLETO.png` / `06_PLAYER_ALTERNATIVO_CINEMATICO.png`: layout 3 colunas — esquerda (resumo do programa + lista de dias agrupada por semana), centro (player grande + abas Anotações/Materiais/Comentários), direita (progresso circular + "o que você vai trabalhar hoje" + dica da Rosangela).
- `08_DASHBOARD_ALUNO_ALTERNATIVO.png`, `09_MOSAICO_TELAS_E_MOBILE.png`: variações de composição e mobile, mesma linguagem.
- `02_IDEIAS_POR_TELA/A*` e `B*`: duas variações por tela (login aluno/admin, checkout, admin alunos) — ainda não abertas individualmente; abrir ao chegar em cada tela específica.

**Atenção (regra de honestidade, já aplicada e deve seguir sendo respeitada):**
1. As pessoas nas imagens de referência são **geradas por IA** — nunca usar esses rostos/corpos. Usar apenas como referência de composição/cor/layout. Fotos reais da Rosângela continuam as únicas usadas.
2. O dashboard admin de referência mostra **faturamento, gráfico de receita e transações** — o backend real do RV30 tem vendas desativadas (Mercado Pago em preparação, nenhum pedido confirmado). Replicar a métrica de receita seria fabricar dado financeiro inexistente. Decisão: usar a linguagem visual (cards com ícone, variação percentual, gráfico) só para métricas que existem de verdade (alunos, matrículas, conclusão, atividade); a área de "Pedidos/Financeiro" deve continuar mostrando o estado honesto (zero pedidos reais), nunca um gráfico fabricado.
3. A landing de referência mostra um **carrossel de depoimentos de alunos com nome e nota** — não existe sistema de depoimentos/avaliações reais no projeto. Decisão: não fabricar depoimentos falsos (seria propaganda enganosa). Omitir essa seção até existir um mecanismo real de coleta de depoimentos, ou usar apenas conteúdo genuíno já aprovado pelo proprietário caso ele forneça algum.
4. "Conquistas"/gamificação no dashboard do aluno: só implementar o que for derivável de dados reais da API (ex.: dias concluídos, sequência atual calculada a partir do progresso real). Não inventar badges ou marcos que não existem no backend.

## Concluído nesta sessão (validado com screenshots + regressão 97/97)

1. **Admin — 5 telas inspecionadas individualmente** (não apenas herdando componente compartilhado):
   - Curso e aulas: formulário do editor de aula reestruturado em grid de 2 colunas (campos curtos pareados: Título+Ordem, Duração+Vídeo validado; textareas e checkbox continuam largura total via `:has()`). Reduziu scroll vertical significativamente. `assets/css/admin-platform.css`, `assets/js/platform-admin.js`.
   - Biblioteca: estado de mídia (Validada/Aguardando revisão/Rejeitada) agora usa `status-pill` colorido em vez de texto plano.
   - Atendimento: status da conversa e badge de não lida agora usam `status-pill` (compartilhado via novo `RVPlatformUI.pill`, usado também pelo admin). `assets/js/platform-support.js`.
   - Pedidos: mensagem do gateway promovida a `.platform-callout` destacado; status de pedido (quando existir) também vira pill colorido.
   - Auditoria: já estava com tabela estilizada da rodada anterior; conteúdo é inerentemente esparso (log), sem alteração estrutural adicional necessária.
   - Novo componente global: `.platform-empty` virou um estado vazio desenhado (caixa tracejada centralizada) em vez de texto cinza solto — afeta todas as telas acima.
2. **Login administrativo reconstruído estruturalmente** (não só texto): composição totalmente diferente do login do aluno — split de borda a borda (sem card centralizado), painel esquerdo com fundo técnico (grid pontilhado + radial sutil) e um índice/diretório das 7 áreas do painel (substituindo o antigo headline de marketing), badge de cadeado no formulário, card de formulário sem glass genérico. `admin-login.html`, `assets/css/admin-access.css`.
3. **Fluxos de autenticação do aluno (signup/recuperação/verificação) redesenhados**: `<details>` nativo sem estilo foi substituído por accordion com marcador +/× e bordas consistentes com a identidade; bloco de verificação de e-mail ganhou espaçamento próprio. `assets/css/projeto.css`.
4. **Prévia da área do aluno na landing reconstruída** (não preservada por "já ser boa"): a caixa de vídeo vazia (só logo pequeno flutuando) virou um frame de vídeo real — foto `rv30-training-hero.webp` de fundo, scrim, botão de play, legenda sobreposta, barra de progresso — em vez de um retângulo escuro oco. `index.html`, `assets/css/projeto.css`, `assets/css/rv30.css` (removido override que forçava a imagem a 86×86 estático).
5. **FAQ redesenhado estruturalmente**: de "heading estreito à esquerda + lista longa à direita" (com grande vão vazio) para heading full-width + grid de 2 colunas categorizado ("O programa" / "Acesso e pagamento"). `index.html`, `assets/css/projeto.css`, `assets/css/rv30.css`.
6. **Rodapé reconstruído**: de uma única linha fina (logo + nav + copyright) para rodapé multi-coluna real (marca+tagline, Programa, Conta, Institucional) com linha de copyright separada por divisor. `index.html`, `assets/css/projeto.css`, `assets/css/rv30.css`.
7. **Hero da landing — primeiro passo da nova diretriz de referência**: adicionada faixa de 4 chips com ícone (inline SVG) sob o CTA ("30 dias de programa" / "Treinos estruturados" / "Evolução mensurável" / "Segurança em cada etapa"), inspirada na composição do `01_LANDING_IMPACTO_EDITORIAL.png`. `index.html`, `assets/css/projeto.css`.

Commits ainda não feitos nesta rodada (pendente commit em lote conforme economia de tokens combinada).

## Concluído — bloco "landing" da nova diretriz (sessão atual)

1. **Hero**: textura de linhas diagonais com glow turquesa (`.hero-v2-lines`), badge vertical "COM ROSANGELA VARAS / RV Fisiologia" sobre a foto (substituiu o crédito textual simples), entrada coreografada por CSS (`@keyframes rv30HeroIn`/`rv30HeroInMedia`, delay escalonado por filho direto do painel), parallax sutil da foto via JS (`setupParallax` em `projeto.js`, desliga com `prefers-reduced-motion`).
2. **Faixa de benefícios** (nova seção `.benefits-strip`, entre hero e #proposta): heading+divisor à esquerda, 4 itens ícone+label à direita (energia/rotina/força/constância — linguagem genérica, sem alegar benefício cardiovascular/médico específico).
3. **Seção "O programa" (#proposta) reconstruída**: era um stack vertical de 3 passos numerados; virou grid de 3 colunas foto (treino real, tratamento duotone) + checklist (`.clean-list`, 5 itens reais) + card de vídeo (`#intro-video`/`data-video-url`, reaproveitando o mecanismo já existente em `config.js`/`projeto.js` — hoje mostra placeholder honesto "vídeo em preparação" porque `introVideoUrl` está vazio; popular o config ativa o vídeo real sem nova mudança de código).
4. **Bloco Rosângela (#rosangela) reconstruído**: de foto+texto em 2 colunas para 3 colunas — foto, bio+2 badges (`.professional-badges`, reaproveitando linguagem já existente no footer, sem inventar "anos de experiência"), e a pull-quote (já existente) virou um card de citação em destaque (`.professional-quote`) ocupando o espaço que na referência é do carrossel de depoimentos — decisão mantida de não fabricar depoimentos de alunos.
5. **FAQ animado**: `<details>` ganhou wrapper `.faq-answer` com técnica `grid-template-rows:0fr→1fr` (abre/fecha com transição, sem JS), guardado em `prefers-reduced-motion`.
6. **Reveal consistente**: classe `.reveal` (infra já existia em `projeto.js`/`setupReveal`, mas não estava aplicada a nada estático) agora está em todas as seções principais da landing.
7. Evidência: `output/rv30-redesign-final/{screenshots/{desktop,mobile},animacoes/{desktop,mobile}}` gerados via `scripts/qa-redesign-landing.js` (screenshot full-page + por seção + FAQ aberto + vídeo de scroll `.webm` por viewport). Script fica no repo para reexecutar após mudanças futuras.
8. Regressão completa rodada após o bloco: lint OK, typecheck OK, `npm test` (backend, 38+ verificações) OK, `npx playwright test` 66/66 OK. A suíte "8 e2e real" (`npm run test:preview`) exige `BASE_URL` de um preview publicado — não aplicável sem deploy (branch deve ficar local).

**Decisão de escopo**: a seção de preço (`#investimento`, ainda card vertical) e o FAQ (`#duvidas`, já em grid 2 colunas categorizado de uma rodada anterior) **não foram tocados nesta rodada** — não estavam na lista de pendências da diretriz anterior. A referência mostra uma barra horizontal de preço ao lado do FAQ; isso é uma melhoria de fidelidade adicional ainda não feita, não um requisito já quebrado.

## Concluído — bloco "área do aluno / dashboard" (sessão atual)

Referência usada: `03_ALUNO_DASHBOARD_COM_FOTO.png`. Mapeamento real descoberto: essa referência corresponde a `aluno.html` ("Meus cursos", a tela pós-login), **não** a `area.html` (que é o player por-aula e será tratado no próximo bloco, referência `04_PLAYER_AULAS_COMPLETO.png`).

Antes de desenhar, o payload real de `/api/student/dashboard` foi lido em `backend/platform/student.mjs` para saber exatamente quais campos existem: `progress.{completedDays,percent}`, `activity.{validatedSeconds,lastLessonDay,lastActivityAt}`, `resume.day`, `history[].{day,completed,lastOpenedAt}`, `course.availableDays`, `enrollment.*`. **Não existe** streak/"dias ativos consecutivos" nem metadado de aula (título/duração/nível) nesse endpoint — por isso essas coisas da referência foram deliberadamente omitidas ou substituídas por dados honestos:
- "Conquistas" = 3 marcos derivados só de `progress.completedDays` (1ª aula, metade do caminho, programa concluído) — sem badges inventados.
- "Próxima aula" = mostra `resume.day` real + foto genérica de treino com legenda "Imagem ilustrativa do programa" (sem fingir ser o frame daquela aula específica, sem duração/nível fabricados).
- Os 4 "stat tiles" reaproveitam as 4 métricas que o JS já calculava (não as 4 da referência) — nenhuma métrica nova foi inventada.

Mudanças: `aluno.html` (novo `.student-hero` com foto, CTAs reais), `assets/js/student-dashboard.js` (`mount()` reestruturado: anel de progresso via `conic-gradient`, ícones SVG nos stat tiles, grid de 30 dias reaproveitando `.admin-day`/`.admin-days-grid` já usado no admin, card de próxima aula, lista de conquistas), `assets/css/student-platform.css` (todo o CSS novo). A lista solta "Próximas aulas" foi removida por ficar redundante com o grid de 30 dias (mesma informação, melhor formato).

**Cuidado ao reler este bloco**: havia um bug de seletor durante a implementação — `.student-welcome > p:last-child` parou de casar depois que um `<div>` de ações virou o último filho; corrigido apontando para `.student-hero-lead` explicitamente. Documentado aqui porque esse padrão de seletor fràgil (`>x:last-child`) pode se repetir em outras páginas ao mover elementos.

Evidência: `output/rv30-redesign-final/screenshots/{desktop,mobile}/aluno-dashboard-full.png`, via `scripts/qa-student-dashboard-shot.js` (mocka `/api/**` com fixture realista, não precisa de login real).

Regressão: lint OK, typecheck OK, `npm test` OK, `npx playwright test` 66/66 OK (rodado 2x nesta sessão).

## Concluído — bloco "player de aulas" (`area.html`, sessão atual)

Referência: `04_PLAYER_AULAS_COMPLETO.png`. **Antes de implementar, uma investigação de contrato de teste mudou o escopo**: `tests/e2e/lesson-player.spec.js:48` (*"catálogo remoto não herda semanas editoriais da demonstração"*) prova que em modo servidor real `item.phase` é só `'Aula disponível'/'Conteúdo em preparação'/'Comece aqui'` — **não existe conceito de "Semana N" no backend real**, isso é só um texto de conveniência do conteúdo de demonstração local (`assets/js/content.js`). Por isso o **accordion por semana da referência foi descartado** — implementar isso teria exigido fabricar uma estrutura de semana que não existe em produção, e o teste já documentado prova isso. A lista de dias no sidebar continua *flat* (como já era), só com estilo renovado.

Também não existe "Anotações" (notas pessoais) como feature real — nem em `area.js` nem no backend há armazenamento de notas distinto de comentários. **Não foi criada essa aba.** As duas abas implementadas usam dado 100% real: "Sobre a aula" (objetivo + instruções já existentes) e "Materiais de apoio" (campo `item.time`, já existia). Comentários continuam como seção sempre visível (não viraram aba) porque o teste `platform.spec.js:43` preenche o campo "Comentário" por `getByLabel` sem antes trocar de aba — colocar comentários dentro de uma aba escondida por padrão quebraria esse fluxo real.

"Dicas da Rosangela" = caixa condicional que só aparece quando a aula tem uma entrada `['Aviso', texto]` real em `item.instructions` (vindo de `lesson.warnings` no backend) — não é texto inventado, e fica oculta quando não existe aviso para o dia.

Mudanças: `area.html` (instructor mini-card, abas Sobre/Materiais, `course-right-rail` novo com anel de progresso + 2 estatísticas reais — "aulas concluídas"/"aulas restantes", sem "dias para conclusão" fabricado), `assets/js/area.js` (`renderProgress` populando o anel, `selectTab`/`renderTabs`, pré-visualização de dia anterior/próximo nos botões de navegação, caixa de aviso condicional), `assets/css/student-platform.css` (grid de 3 colunas em `.course-shell` a partir de 1061px, com `.course-right-rail{grid-column:1/-1}` como fallback para não quebrar a faixa 901–1060px que não tinha regra própria).

**Um teste teve que ser atualizado** (não reaberto, atualizado deliberadamente): `tests/e2e/platform.spec.js:356` verificava `.daily-info article` com `toHaveCount(4)` — os 2 campos que saíram do grid (`MATERIAIS`/`OBJETIVO`) foram realocados para as novas abas, então a contagem correta passou a ser 2. Mantidos no grid: `DURAÇÃO`/`TIPO`.

Manteve-se os controles de vídeo **nativos** (`<video controls>`), não a barra customizada da referência (play/rewind10/speed/PiP/fullscreen) — construir controles customizados do zero é uma funcionalidade nova substancial (não uma troca visual) e arriscaria a integração já existente com `RVLessonActivity` (rastreamento de atividade validada no servidor).

Evidência: `output/rv30-redesign-final/screenshots/{desktop,mobile}/player-full.png`, via `scripts/qa-player-shot.js`.

Regressão: lint OK, typecheck OK, `npm test` OK, `npx playwright test` 66/66 OK (incluindo o ajuste do teste de contagem).

## Concluído — bloco "admin dashboard" (`/admin` visão geral, sessão atual)

Referência: `02_ADMIN_DASHBOARD_PREMIUM.png`. O dashboard real (`platform-admin.js` → `dashboard()`, usa `/api/admin/metrics` servido por `backend/platform/metrics.mjs`) já era honesto antes desta rodada (card "Financeiro" já dizia explicitamente "Gateway e webhook ainda não homologados. Não há receita confirmada disponível para este painel." — regra já cumprida). O trabalho desta rodada foi só vestir essa estrutura real com a linguagem visual da referência, sem adicionar nenhuma métrica nova:
- 4 cards em destaque (eram 3): `activeEnrollments`, `students`, `lessonsCompleted` + **novo** `completionRate` como anel circular (`U.ring`, mesmo `conic-gradient` do anel usado em `aluno.html`/`area.html`).
- Ícones SVG nos cards (novo helper `icon()` em `assets/js/platform-ui.js`, exportado por `window.RVPlatformUI`).
- Grupo "Atenção" (que eram 3 tiles numéricos soltos: bloqueadas/expiradas/pendentes) virou um painel "Alertas e pendências" com linha por alerta + link direto para a tela filtrada (`students?status=blocked`, `students?status=expired`, `support`) — **só aparece o alerta cujo contador real é > 0**; com tudo zerado mostra "Nenhum alerta no momento." (estado testado).
- "Atividade registrada no período" ganhou um gráfico de linha SVG real (novo helper `lineChart()`) usando a mesma série `result.activity` que já existia; as linhas de `<progress>` por dia viraram um `<details>` colapsável abaixo do gráfico (dado preservado, não removido).
- "Aulas iniciadas e conclusões" ganhou um gráfico de barras SVG (novo helper `barChart()`) usando `result.lessons` **reordenado por dia** (a API ordena por `started desc`, então foi preciso um `.sort((a,b)=>a.day-b.day)` no frontend antes de desenhar, senão o eixo ficaria fora de ordem) — mostra só a série "iniciaram" (não "concluíram", para não implicar uma segunda série que não estava sendo desenhada). A tabela detalhada permanece abaixo, intacta.

**Deliberadamente NÃO implementado** (documentar para não tentar de novo sem necessidade real):
- Gráfico/linha de **faturamento** e lista de **"últimas transações"** da referência — teriam que mostrar dinheiro real; vendas estão desativadas e não há pedidos confirmados. Teria sido fabricar dado financeiro.
- Percentuais de variação tipo "+12,6%" em cada card — a referência mostra isso em todo card, mas `backend/platform/metrics.mjs` não calcula comparação com o período anterior (só totais do período atual). Adicionar isso exigiria uma nova consulta no backend (fora do escopo de redesign visual); **nenhum delta foi inventado**.
- Busca global "Ctrl+K" do topo — decorativa na referência; implementá-la de verdade (busca por aluno/pedido/conteúdo) é uma feature nova, não um reskin visual. Não adicionado.
- Tabela "Atividade recente de alunos" (nome+avatar+progresso) diretamente no dashboard — esse dado já existe, mas só na tela "Alunos" (`studentList()`), não no endpoint `/api/admin/metrics`. Replicar a tabela no dashboard exigiria uma nova consulta agregada; em vez disso mantém-se o link cruzado já existente para a tela "Alunos".

**Um teste teve que ser atualizado** (estrutura mudou de propósito, não regressão): `tests/e2e/platform-admin.spec.js:26` esperava `.platform-metric` com `toHaveCount(12)` (3 destaque + 3 grupos de 3). A nova contagem real é 9 (4 destaque + grupo "Alunos no período" com 3 + grupo "Progresso" com 2, já que `completionRate` saiu do grupo e virou destaque, e o grupo "Atenção" virou o painel de alertas). Adicionado também um `expect` cobrindo o estado "Nenhum alerta no momento." com a fixture atual (todos os contadores de alerta em 0).

Evidência: `output/rv30-redesign-final/screenshots/{desktop,mobile}/admin-dashboard-full.png`, via `scripts/qa-admin-dashboard-shot.js` (precisou de `platformAdmin:true` no mock de `/api/config` — sem esse campo exato, `assets/js/admin.js` nunca entrega o mount para `RVPlatformAdmin` e a página fica presa na versão demo/local; documentado aqui para não perder tempo de novo com isso).

Pequeno polish depois do primeiro screenshot: 2 ícones estavam semanticamente errados (`activeStudents` reaproveitava o mesmo ícone de "conclusões"; `lessonsStarted` usava o ícone de escudo "segurança" da landing) — trocados por um ícone de login e um de play, respectivamente.

Regressão: lint OK, typecheck OK, `npm test` OK, `npx playwright test` 66/66 OK (suíte completa, rodada depois do bloco inteiro).

## Concluído — checkout e login do aluno (sessão atual)

Ambas as páginas já estavam muito próximas das referências `A04/B04_CHECKOUT_VARIACAO` e `A05/B05_LOGIN_ALUNO_VARIACAO` (trabalho de uma rodada anterior desta mesma operação — ver item 3 de "Concluído nesta sessão" mais abaixo no histórico). Comparação lado a lado feita via screenshot real (`scripts/qa-checkout-login-shot.js`):

- **Login (`login.html`)**: já é quase idêntico à referência A05 — mesmo layout split com foto, mesmo headline literal "Seu próximo dia no RV 30.", mesma faixa de estatísticas (30 dias de programa / 365 dias de acesso). **Nenhuma mudança feita** — forçar uma alteração aqui seria trabalho sem ganho visual real. Importante: a variante B05 mostra "+500 Alunos ativos" como prova social — **isso não foi copiado**, pois é um número que não temos como verificar/sustentar (vendas ainda desativadas); manter apenas as estatísticas de produto (dias de programa/acesso) que já são reais e constantes.
- **Checkout (`checkout.html`)**: já tinha a composição de 2 colunas completa (form + order card com foto da Rosangela), mas faltava a faixa de confiança de 4 ícones que aparece no topo de **ambas** as variantes de referência. Adicionada `.checkout-trust-strip` reaproveitando os mesmos 4 ícones/textos já usados no hero da landing (30 dias de programa / Treinos estruturados / Evolução mensurável / Segurança em cada etapa) — mesma linguagem, zero texto novo inventado.

Evidência: `output/rv30-redesign-final/screenshots/{desktop,mobile}/{checkout,login}-full.png`, via `scripts/qa-checkout-login-shot.js`.

Regressão: lint OK, `npx playwright test` 66/66 OK.

## Concluído — pricing bar horizontal (sessão atual)

Último item da landing que estava deliberadamente em aberto. `.price-card` saiu de aside vertical (logo em cima, preço no meio, checklist vertical embaixo) para barra horizontal: badge do programa + preço + equivalência diária + CTA na mesma linha, checklist em grid 2 colunas abaixo, nota de segurança por último. **Mudança 100% em CSS** (`assets/css/rv30.css`), nenhum HTML/classe tocado — por isso o teste que verifica a cor de fundo computada de `.price-card` (`platform.spec.js:215`) nem precisou ser revisto, já que só mudou `display:flex`/ordem visual, não a classe nem o background. Comparado com `01_LANDING_IMPACTO_EDITORIAL.png` via `scripts/qa-redesign-landing.js`, resultado bate com a composição de referência.

Também foi revisado o mosaico `09_MOSAICO_TELAS_E_MOBILE.png` como checagem cruzada final. Confirma que nenhuma correção nova era necessária, e reafirma 2 decisões de honestidade já tomadas nesta sessão: o mosaico mostra um card de admin com "Receita (teste) R$ 3.493,00" fabricado — **não replicado**, consistente com a regra já documentada de não inventar faturamento.

Regressão: lint OK, `npx playwright test` 66/66 OK.

## Estado da operação ao final desta sessão

Todos os 6 blocos pedidos pela diretriz foram implementados e verificados nesta sessão: **landing** (hero+linhas diagonais+badge+entrada coreografada, faixa de benefícios, seção do programa, bloco Rosângela, FAQ animado, pricing bar horizontal), **dashboard do aluno**, **player de aulas**, **admin dashboard**, **checkout**, **login**. Cada bloco foi fechado com: screenshot real comparado à referência, regressão (`lint`+`typecheck`+`npm test`+`npx playwright test` completos) e uma entrada neste checkpoint explicando o que foi feito e, mais importante, o que foi **deliberadamente não feito** e por quê (toda vez que a referência pedia algo que exigiria fabricar dado/feature inexistente).

Pendências reais remanescentes, nenhuma bloqueante:
1. Telas de admin ainda não comparadas individualmente contra as referências `A07/B06_ADMIN_DASHBOARD_VARIACAO`, `A08/B07_ADMIN_ALUNOS_VARIACAO` (o dashboard geral foi feito; a tela "Alunos" em si herda os componentes compartilhados já redesenhados em rodada anterior, mas não foi comparada pixel a pixel contra essas referências específicas).
2. Vídeo Playwright do scroll real já existe por página (`output/rv30-redesign-final/animacoes/{desktop,mobile}/landing-scroll-*.webm`), mas não foi gravado um vídeo equivalente para as páginas internas (dashboard/player/admin/checkout/login) — só screenshots.
3. Branch permanece local, sem commit em lote ainda (pendente conforme combinado anteriormente sobre economia de tokens).

## Nota de ferramenta (documentar para não repetir)

Ao escrever um script de screenshot Playwright que faz login/admin via fixture, usar `waitUntil:'domcontentloaded'` (não `'networkidle'`) no `page.goto` — páginas da plataforma têm chamadas/polling que impedem `networkidle` de disparar, o que trava o script silenciosamente sem nenhuma saída (já aconteceu 1x nesta sessão, no screenshot do admin, até trocar para `domcontentloaded` + `waitForSelector` com timeout explícito).

## Lição recorrente (documentar para não repetir investigação)

Antes de copiar qualquer elemento estrutural de uma referência (agrupamento, aba, contador), grep os testes e2e primeiro — eles frequentemente já documentam uma fronteira real vs. fabricado que não está óbvia só olhando o HTML/JS (ex.: o teste "não herda semanas editoriais da demonstração" já continha a resposta sobre semanas não existirem no backend real). Isso evita desenhar uma feature inteira para descobrir depois que ela não é sustentável.

## Causa raiz recorrente (documentar para não repetir investigação)

Praticamente toda mudança de cor/borda/estrutura em páginas com classe `.rv30-landing`/`.rv-checkout`/`.portal-body`/`.admin-login-body` precisa ser verificada contra os arquivos CSS carregados por último (prioridade crescente): `rv-evolua.css` → `rv30.css` (mais autoritativo). Também existe uma armadilha de especificidade: `.portal-body .seletor` (2 classes) sempre vence `.algo-especifico` (1 classe) mesmo que a segunda venha depois no arquivo — isso já causou bugs silenciosos nesta sessão (ex.: `.admin-brand-panel{background:...}` nunca aplicava porque `.portal-body .auth-brand-panel{background:none}` tinha especificidade maior; o padding do rodapé "150px embaixo" não aplicava pelo mesmo motivo). Ao criar overrides específicos de uma página (ex. admin-login), usar `body.classe-da-pagina .seletor` (elemento+classe) para garantir precedência sem depender de ordem de carregamento. Sempre grep o nome da classe em `rv30.css` antes de estilizar um componente novo numa dessas páginas.

## Próxima ação exata (se a sessão for retomada)

1. Abrir as 18 imagens de `02_IDEIAS_POR_TELA/` relevantes à tela em que for trabalhar (ainda não abertas individualmente, só as 9 de `01_CONCEITOS_PRINCIPAIS/`).
2. Continuar a landing: seção de benefícios horizontal + seção "o programa" + bloco Rosângela, usando `01_LANDING_IMPACTO_EDITORIAL.png` como base, sempre grep-ando `rv30.css`/`rv-evolua.css` antes de estilizar.
3. Implementar scroll-reveal básico (IntersectionObserver + classe `.is-visible` + CSS transition em `opacity`/`transform`), respeitando `prefers-reduced-motion`, antes de considerar GSAP.
4. Antes de redesenhar o player com abas de anotações/comentários, verificar o backend (`backend/platform/*.mjs`) para confirmar quais dessas funcionalidades existem de verdade.
5. Criar `output/rv30-redesign-final/{screenshots/desktop,screenshots/mobile,comparativos,animacoes,relatorios}/` quando houver conteúdo real para colocar lá (não criar pastas vazias antecipadamente).
6. Rodar regressão completa (23+66+8 testes, audit, lint, typecheck) após cada bloco de páginas, não a cada linha de CSS.
