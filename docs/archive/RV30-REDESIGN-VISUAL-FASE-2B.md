> **Documento histórico** — arquivado em 22/11/2026. Não descreve o estado atual do RV30; consulte [`docs/ESTADO_ATUAL.md`](../ESTADO_ATUAL.md).

# RV30 — Fase 2B: Transformação visual premium

Branch: `redesign/rv30-visual-premium-20261121` (criada a partir de `qa/rv30-playwright-e2e-20261121`).
Nada publicado, nenhum `git push`, nenhum merge, nenhum deploy. Produção intocada.

## 1. Resumo das melhorias

Esta fase entregou três blocos de mudança real, todos verificados em navegador e por teste automatizado:

1. **Correção comercial e de identidade** (base para tudo o resto): preço do RV 30 padronizado para R$ 499,00 em todo o frontend, backend e testes; equivalência de R$ 16,63/dia; distinção clara entre a plataforma **RV Fisiologia** e o plano **RV 30**.
2. **Tipografia premium**: fonte Manrope ExtraBold auto-hospedada, aplicada a todos os títulos (`h1`/`h2`/`h3`) e números de preço em todas as páginas — a mudança visual mais perceptível desta fase, porque é sistêmica (um único ponto de ajuste no token `--font-display` afeta a landing, checkout, login, área do aluno e admin de uma vez).
3. **Polimento de componentes**: hierarquia de hover nos botões (CTA primário se destaca com elevação; secundário/ghost reagem de forma mais discreta).

Não foi uma reescrita de layout — a paleta petróleo/turquesa, a estrutura de seções e as fotografias reais foram preservadas integralmente, como pedido.

## 2. Skills efetivamente utilizadas

| Skill | Uso real nesta fase |
|---|---|
| `frontend-design` | Carregada no início; orientou a decisão de não trocar a paleta (já fixada em `../design/DESIGN_RV30.md`), investir a "ousadia" em um único lugar (tipografia) e evitar os clichês de IA (eyebrows em excesso, cards genéricos, gradientes repetidos) — diagnosticados ao ler `assets/css/projeto.css`, `rv30.css` e `rv-performance.css` na íntegra. |
| Investigação sistemática (equivalente a Superpowers) | Usada para resolver a cascata de CSS em 5 arquivos sobrepostos (`tokens→projeto→plataforma→rv-performance→rv30`) antes de editar — evitou que a troca de fonte fosse silenciosamente sobrescrita (aconteceu uma vez, diagnosticado e corrigido na hora). |
| Playwright (navegador real) | Usada em cada etapa: renderização real via `scripts/dev-server.js` + Chromium, não apenas leitura de CSS. Confirmou visualmente a fonte aplicada, a ausência de overflow, e serviu para a varredura final de 13 páginas × 5 larguras (375/768/1366/1440/1920). |
| "Impeccable" | Novamente não localizada nesta sessão (nenhum arquivo, skill ou relatório com esse nome existe no ambiente, no repositório ou em `output/`/`docs/`/`reports/`). A revisão visual foi feita por inspeção direta de screenshots reais, comparando com os princípios do `frontend-design`. |
| Outras skills instaladas | Não usadas — não agregariam valor concreto a uma mudança majoritariamente CSS/tipográfica (ex.: não havia necessidade de `accessibility-engineering` isolado, pois o contraste e o foco visível já eram verificados pela suíte `accessibility.spec.js` existente, que continuou passando). |

Não usei múltiplos agentes — todo o trabalho foi feito em uma única sessão, como pedido.

## 3. Correção identidade: plataforma × plano RV 30

| Local | Antes | Depois | Por quê |
|---|---|---|---|
| `404.html`, `login.html`, `privacidade.html`, `termos.html`, `checkout.html`, `admin-login.html` | "Voltar ao/para o RV 30", "Voltar ao projeto", "Voltar ao site" | "Voltar à plataforma" | O destino do link é sempre `/` ou `index.html` — a página inicial da plataforma, não uma página dedicada ao RV 30. |
| `admin.html` (`<title>` e cabeçalho) | "Gestão RV 30 — Admin" | "Painel administrativo — RV Fisiologia" | O admin gerencia alunos, conteúdo, pedidos e auditoria da plataforma como um todo (já é genérico no código: menus "Alunos", "Curso e aulas", "Biblioteca", "Pedidos"), não só o RV 30. |
| `assets/js/platform-admin.js` | `el('span','Gestão RV 30')` (sobrescrevia o header em runtime) | `el('span','RV Fisiologia')` | Esse script roda por cima do HTML estático e é o que realmente aparece na tela — corrigido na fonte. |

A landing (`index.html`) já estava correta (header "RV Fisiologia" + eyebrow "RV 30 · PROGRAMA DE TREINOS"); não precisou de mudança estrutural.

**Não fiz** (fora do escopo seguro desta fase, por envolver rotas): dividir `index.html` em uma página de plataforma separada de uma página de produto RV 30 dedicada — isso exigiria novas rotas e está reservado para quando houver um segundo programa real.

## 4. Padronização comercial — R$ 499,00 / R$ 16,63 por dia

`PRICE_CENTS` mudou de `39900` para `49900` em todo lugar que é fonte de verdade ou fixture, verificado por teste automatizado (não apenas por grep):

- **Backend**: `backend/access-terms.js` (fonte única usada por `backend/server/api.js`), `backend/server/stone.js`, `backend/qa/core.mjs`, `backend/platform/worker.mjs`, seed em `backend/supabase-schema.sql`.
- **Migração não aplicada**: `backend/migrations/20261107_rv30_access365.sql` é explicitamente "REVIEWABLE PROPOSAL ONLY. Not applied automatically" — corrigida diretamente, pois nunca rodou contra um banco real.
- **Frontend**: `assets/js/config.js` (fallback local), `assets/js/projeto.js` (textos de `data-sales-detail`/`data-sales-faq`, agora mencionando "menos de R$ 17 por dia"), `index.html`, `checkout.html`, `termos.html`.
- **Testes/fixtures**: 12 arquivos de teste atualizados (`tests/*.js`, `tests/e2e/*.spec.js`, `scripts/qa-screenshots.js`) — incluindo dois valores "escondidos" que um grep simples não pegaria (`value:399` em reais no fixture Asaas, e um regex `/R\$\s*399,00/`), encontrados porque os testes falharam antes de eu declarar a tarefa concluída.
- **Documentação histórica**: os registros de aprovação de 27/10/2026 em `../payments/ASAAS_ACCESS365.md`, `../payments/STONE_ACCESS365.md` e `../architecture/SECURE_BACKEND_RV30.md` foram **preservados intactos** (são registro histórico); adicionei um adendo datado em `../design/DESIGN_RV30.md` apontando para o novo valor, em vez de reescrever o passado.

Nenhum preço real foi cobrado; nenhuma conta de gateway de produção foi tocada. `RV30_SALES_ENABLED` continua `false`.

## 5. Tipografia — a mudança mais visível

`../design/DESIGN_RV30.md` já registrava que o projeto queria Manrope desde a rodada anterior, mas não conseguiu baixar a fonte na época. Testei agora e o download funcionou: baixei o peso 800 (ExtraBold), subset Latin, licença OFL (`assets/fonts/manrope-800.woff2`, ~14 KB, mais `assets/fonts/MANROPE-OFL.txt`). Hospedado localmente (mesma origem), compatível com a CSP existente do site (`font-src 'self'`) — zero dependência de CDN em runtime.

Descobri, ao investigar por que a fonte não aparecia na primeira tentativa, que o token `--font-display` **já existia** e já era usado por `rv-performance.css` (`h1,h2,h3,.course-title,.price-main strong{font-family:var(--font-display)}`), mas `rv30.css` tinha 7 regras com `"Segoe UI"` **hardcoded por cima**, de uma rodada de design anterior. Troquei esses 7 valores fixos pelo token, o que:

- Aplica Manrope de forma consistente a `h1`/`h2`/`h3`, aos números grandes de preço (`.price-main strong`, `.price-main--simple strong`) e aos títulos de card (`.catalog-card h3`, `.my-course-copy h3`) em **todas** as páginas (landing, checkout, login/cadastro, área do aluno, admin).
- Mantém rótulos pequenos de UI (marca no cabeçalho, legendas, números de métrica) na fonte de sistema, de propósito — não force a fonte de destaque em todo texto em negrito (princípio de "gastar a ousadia em um só lugar").
- Não mexe no corpo de texto (`body` continua em Segoe UI/Arial, rápido e já legível).

## 6. Comparação antes/depois

"Antes" = capturas da Fase 1 (`output/qa-previews/landing-desktop.png`, `landing-mobile.png`, `checkout-desktop.png` etc., geradas antes de qualquer mudança desta fase). "Depois" = nova varredura completa nesta fase, em `output/qa-previews/*-375x812.png` / `*-768x1024.png` / `*-1366x768.png` / `*-1440x900.png` / `*-1920x1080.png` para as 13 páginas (landing, login aluno/admin, checkout, dashboard aluno, player de aula, admin dashboard/alunos/vídeos, suporte, privacidade, termos, pagamento confirmado, 404).

Inspecionei diretamente (não apenas gerei) os seguintes pares antes/depois:

- **Landing** (`landing-1440x900.png` / `1366x768.png`): headline "RV 30 / Um dia de cada vez." agora em Manrope ExtraBold — mais arredondado, mais confiante, visivelmente diferente do Segoe UI anterior. Preço R$ 499,00 / R$ 16,63 por dia corretos.
- **Checkout** (`checkout-1366x768.png`): "Finalize sua inscrição." em Manrope; resumo do pedido com R$ 499,00 e "R$ 16,63/dia" corretos; nav "Voltar à plataforma".
- **Login aluno** (`login-aluno-375x812.png`): "Entrar no RV 30" em Manrope; "← Voltar à plataforma" corrigido.
- **Login admin** (`login-admin-1366x768.png`): "O cuidado continua nos detalhes." em Manrope; "Voltar à plataforma" corrigido.
- **Dashboard do aluno** (`dashboard-aluno-1366x768.png`): "Olá, Aluno." em Manrope; layout e dados inalterados.
- **Painel admin** (`admin-dashboard-375x812.png`, `1366x768.png`): header "RV Fisiologia" (antes "Gestão RV 30"); "Visão geral" em Manrope.
- **Player de aula** (`aula-player-1366x768.png`): sidebar com os 30 dias intacta; título do conteúdo em Manrope.
- **404** (`404-375x812.png`): segue sem overflow (fix da Fase 1, reconfirmado).

Nenhuma captura mostrou texto cortado, sobreposto ou quebrado pela troca de fonte.

## 7. Impeccable

Não localizada nem nesta fase nem na anterior — busca repetida em todo o repositório, `output/`, `docs/`, `reports/`, e na lista de skills instaladas. Se existir como ferramenta externa ao Claude Code, preciso do arquivo de relatório ou de instruções de execução para usá-la; não posso inventar o que ela diria.

## 8. Arquivos modificados

36 arquivos, 2 commits nesta fase (além dos 2 já existentes de `qa/rv30-playwright-e2e-20261121`, preservados):

- **HTML** (nav/branding): `404.html`, `admin-login.html`, `admin.html`, `checkout.html`, `index.html`, `login.html`, `privacidade.html`, `termos.html`.
- **CSS/fontes** (sistema visual): `assets/css/tokens.css`, `assets/css/projeto.css`, `assets/css/rv30.css`, `assets/fonts/manrope-800.woff2`, `assets/fonts/MANROPE-OFL.txt`.
- **JS**: `assets/js/config.js`, `assets/js/platform-admin.js`, `assets/js/projeto.js`.
- **Backend/preço**: `backend/access-terms.js`, `backend/server/stone.js`, `backend/qa/core.mjs`, `backend/platform/worker.mjs`, `backend/supabase-schema.sql`, `backend/migrations/20261107_rv30_access365.sql`.
- **Testes/scripts** (acompanhando o preço): 12 arquivos em `tests/` e `tests/e2e/`, `scripts/qa-screenshots.js`, `scripts/release-audit.js`.
- **Docs**: `../design/DESIGN_RV30.md` (adendo, sem apagar histórico).

## 9. Testes realizados

| Suíte | Resultado |
|---|---|
| Backend (23 arquivos) | 23/23 ✅ |
| E2E mockado (66 specs) | 66/66 ✅ |
| E2E real/zero-mock (8 specs, da Fase 2) | 8/8 ✅ |
| `npm audit` | 0 vulnerabilidades ✅ |
| `npm run check` (lint) | OK ✅ |
| `npm run typecheck` | OK ✅ |
| Varredura visual Playwright | 13 páginas × 5 larguras, 0 overflow novo, 5 ocorrências de console (mesmas de antes, benignas — a própria página 404 de teste logando sua navegação) |

Regressão executada **uma única vez**, ao final de todas as mudanças relevantes, como pedido. 97/97 testes automatizados passando — nenhuma mudança na contagem em relação à Fase 2 (nenhum teste novo foi necessário; os 8 testes reais já existiam).

## 10. Problemas corrigidos

- Preço desatualizado (R$ 399,00) presente em 26+ locais de código, incluindo 2 ocorrências "escondidas" (valor em reais sem formatação, regex de teste) só encontradas porque os testes foram executados, não apenas o grep.
- Rótulos de navegação que confundiam "plataforma" com "RV 30" (6 páginas).
- Branding do admin ("Gestão RV 30") que não refletia seu escopo real (gestão de toda a plataforma).
- Limitação de tipografia de uma fase anterior ("Manrope não pôde ser baixado") — resolvida nesta fase.
- Inconsistência de hover entre botões (`projeto.css` não diferenciava primário de secundário; `rv-performance.css` já diferenciava — agora os dois concordam).

## 11. Pendências identificadas

- **Redesenho de layout por página** (hero reestruturado, grade de dias redesenhada, cards com tratamento visual único por tipo) não foi feito nesta fase — o que foi entregue é um upgrade sistêmico (tipografia + preço + identidade + botões) que já muda a sensação de todas as páginas, mas não uma reconstrução de composição visual página a página. Se "transformação significativa" exigir isso especificamente, é a próxima etapa natural.
- **Eyebrows/rótulos em caixa alta rastreados** aparecem com frequência (`.price-card>small`, `.day-card-top small`, `.qual-card small`, etc.) — identificado como um padrão repetitivo típico de design genérico, mas não alterado nesta fase por risco/tempo (são ~8 pontos espalhados por 3 arquivos CSS com cascata já complexa); documentando para uma próxima iteração focada.
- **"Impeccable"**: segue sem ser localizada; preciso que você aponte onde ela vive para eu poder usá-la.
- **Ferramenta "Superpowers" como motor de planejamento formal**: usei investigação sistemática e verificação passo a passo (o espírito da skill), mas não invoquei um fluxo dela nomeado explicitamente, por não haver uma skill com esse nome exato na lista desta sessão.

## 12. Estado dos commits e da branch

```
redesign/rv30-visual-premium-20261121 (branch atual, isolada)
  bdd9430 feat(design): self-host Manrope ExtraBold for headlines/price display; button polish
  7f2316a feat(commercial): standardize RV30 price to R$ 499,00 and fix platform/program nav copy
qa/rv30-playwright-e2e-20261121 (branch-base, preservada, não tocada)
  911121d ci: validate QA branch and local backend browser regressions   (de outra sessão)
  a64e53b fix(404): keep error message within narrow screens             (de outra sessão)
  9db3804 docs(qa): add Fase 2 audit report
  ... (commits da Fase 1/2, preservados)
```

Nenhum `git push`. Nenhum merge. `publish/rv30-visual-20261121` (de outra sessão, já pushada ao GitHub antes desta fase) não foi tocada, revertida ou excluída, conforme solicitado.

## 13. Como publicar uma Preview para testar online

Sem fazer isso por você (requer sua autorização e, possivelmente, credenciais que não tenho):

1. Confirme que está satisfeito com o estado local: `git log --oneline -5` nesta branch.
2. Publique a branch: `git push -u origin redesign/rv30-visual-premium-20261121` (ou abra um PR contra `main`/`qa/...` pelo GitHub).
3. Se o projeto usa Vercel/Cloudflare Pages com deploy automático por branch (confirme em `vercel.json`/`wrangler.*.jsonc`), o push já deve gerar uma URL de Preview isolada — **não** promove produção.
4. Abra a Preview e repita manualmente (ou com `BASE_URL=<url-da-preview> npm run test:e2e`) pelo menos: landing, checkout, login aluno/admin, área do aluno, admin — exatamente as páginas revisadas aqui.
5. Só promova a produção depois de validar a Preview — e com sua autorização explícita, como de costume.

---

# REDESIGN ESTRUTURAL — EXECUÇÃO DEFINITIVA

A rodada anterior (commit `bdd9430`) entregou tipografia, preço e identidade — mas, como o próprio relatório reconheceu, não alterou a composição estrutural de nenhuma página. Esta seção documenta a rodada seguinte, que implementou mudanças reais de layout/HTML/JS, não apenas CSS.

## Resumo da transformação

| Página | O que mudou estruturalmente (não é CSS cosmético) |
|---|---|
| Landing — Hero | Novo elemento flutuante (`.hero-visual-badge`) sobreposto ao canto superior esquerdo da foto, dentro de um novo wrapper `.hero-visual-frame`. Exigiu corrigir um bug real de `align-items:stretch` que empurrava o badge para fora da foto na primeira tentativa — corrigido e reverificado antes de prosseguir. |
| Landing — Metodologia | Os 3 passos numerados ganharam um trilho vertical conectando marcadores circulares — de texto plano para uma linha do tempo genuína. Corrigido um override específico da landing (`rv30.css`) que cancelava o novo estilo. |
| Landing — Oferta/RV30 | Nova faixa visual de 30 dias (`.day-strip`), agrupada em 4 semanas (7/7/7/9 — a mesma estrutura real já usada na barra lateral do player), ao lado do texto comercial. |
| Área do aluno — Dashboard | A barra `<progress>` genérica foi substituída, em `assets/js/student-dashboard.js`, pelo mesmo componente `.day-strip`, agora **orientado a dados reais**: os primeiros N dias (N = `completedDays` vindo da API) aparecem concluídos, o dia de retomada (`resume.day`) aparece em destaque. Nenhum dado novo foi inventado — a API não tem um array por dia, então a visualização usa exatamente a mesma suposição linear que a barra de progresso antiga já fazia. |
| Painel administrativo | `assets/js/platform-admin.js`: o "Visão geral" deixou de ser uma parede de 12 cards idênticos. Agora são 3 cards grandes em destaque (Matrículas ativas, Alunos cadastrados, Conclusões no período) + 3 grupos com subtítulo ("Alunos no período", "Progresso", "Atenção") para os 9 indicadores restantes. |
| Login / Login admin | Nova faixa de 2 estatísticas (30 dias de programa · 365 dias de acesso) no painel de marca, reaproveitando dados já verdadeiros em vez de inventar prova social. Botão do admin renomeado de "Entrar no painel RV 30" para "Entrar no painel administrativo" (mesmo ajuste conceitual plataforma×produto da fase anterior, que tinha ficado de fora deste botão). |

## Skills realmente utilizadas nesta rodada

- **`frontend-design`**: a decisão de não adicionar mais um "card genérico" e, em vez disso, dar ao conteúdo que já era sequencial (3 passos, 30 dias) um tratamento estrutural de linha do tempo/trilha é diretamente o princípio "marcadores numerados só quando o conteúdo é mesmo uma sequência" da skill — e o motivo de ter rejeitado a ideia inicial de simplesmente duplicar cards.
- **Playwright/Chromium real**: cada uma das 6 mudanças acima foi renderizada e fotografada antes de ser considerada pronta; duas delas (badge do hero, trilho do método) só funcionaram na segunda tentativa porque a primeira captura revelou o elemento no lugar errado ou sem estilo — corrigido olhando o resultado real, não o código.
- **Investigação sistemática da cascata CSS**: necessária de novo, porque `rv30.css` tinha 2 overrides específicos da landing (`.method-stack article>span`, implícito no grid stretch do hero) que cancelavam exatamente as mudanças que eu estava fazendo. Sem essa investigação, as mudanças pareceriam "não ter efeito".
- **"Impeccable"**: segue indisponível; não interrompi o trabalho por causa disso, como instruído.

## Capturas antes/depois desta rodada

Specificamente para as mudanças estruturais (além das capturas gerais da rodada anterior, ainda válidas para preço/tipografia):

- `output/qa-previews/redesign2-hero.png` — hero com o badge "30 dias de sequência guiada" sobre a foto (1440px).
- `output/qa-previews/redesign2-method.png` — metodologia com o trilho conectando os 3 passos numerados (1440px).
- `output/qa-previews/redesign2-pricing.png` / `redesign2-pricing-mobile.png` — oferta com a faixa de 30 dias, desktop e mobile (375px).
- `output/qa-previews/redesign2-dashboard.png` — dashboard do aluno com a faixa de progresso real (12 de 30 concluídos, dia 13 em destaque) substituindo a barra genérica.
- `output/qa-previews/redesign2-admin.png` — painel admin com 3 cards em destaque + 3 grupos com subtítulo, substituindo os 12 cards idênticos.
- A varredura completa (`npm run qa:screenshots`) foi re-executada após todas as mudanças, cobrindo as 14 páginas nas 5 larguras (375/768/1366/1440/1920) em `output/qa-previews/*.png` — sem overflow novo, sem regressão.

## Mudanças efetivamente implementadas (arquivos)

- `index.html` — novo wrapper `.hero-visual-frame` + badge; novo `.day-strip` na seção de oferta.
- `assets/css/projeto.css` — `.hero-visual-frame`/`.hero-visual-badge`, trilho do `.method-stack`, `.day-strip`/`.day-strip-week`, `.auth-stat-row`.
- `assets/css/rv30.css` — correção do override que cancelava os marcadores circulares do método.
- `assets/css/admin-platform.css` — `.platform-metrics--featured`, `.platform-metric--featured`, `.platform-metrics-group`.
- `assets/js/student-dashboard.js` — substituição do `<progress>` pelo `.day-strip` orientado a dados.
- `assets/js/platform-admin.js` — reestruturação do "Visão geral" em destaque + grupos.
- `login.html` — faixa de estatísticas no painel de marca.
- `admin-login.html` — mesmo ajuste de rótulo do CTA ("painel administrativo").
- `tests/e2e/accessibility.spec.js`, `tests/e2e/platform.spec.js`, `tests/e2e/server-flow.spec.js` — asserções atualizadas para o novo rótulo do botão admin.

## Testes executados

Regressão completa **uma vez**, ao final desta rodada: 23 backend + 66 e2e mockado + 8 e2e real/zero-mock = **97/97** ✅, `npm audit` 0 vulnerabilidades ✅, `npm run check` (lint) ✅, `npm run typecheck` ✅. Nenhum teste novo foi necessário (as mudanças de layout não alteraram nenhum contrato de API testado); 3 testes existentes foram atualizados para o rótulo do botão renomeado, não adicionados.

## Problemas corrigidos nesta rodada

- Badge do hero renderizando fora da foto por causa de `align-items:stretch` herdado do grid — corrigido com `align-self:start` no novo wrapper.
- Marcadores numerados do método voltando a texto plano por causa de um override específico de `rv30.css` da rodada de design anterior — identificado e corrigido.
- Botão "Entrar no painel RV 30" remanescente com a mesma confusão plataforma×produto já corrigida em outros lugares na fase anterior.

## Pendências identificadas

- **Player de aula (`area.html`)** e **checkout** não receberam mudança estrutural nesta rodada (apenas tipografia/preço da rodada anterior) — a sidebar de 30 dias do player já era rica o suficiente (lista completa com status por dia) para não exigir retrabalho imediato; o checkout já tinha uma composição de 2 colunas adequada. Se "transformação" exigir ir além disso também, é o próximo passo natural.
- **Hero com foto "sangrando" até a borda do viewport** (composição editorial de revista) foi considerada e descartada nesta rodada por exigir reestruturar a grade em 3 arquivos CSS sobrepostos com risco desproporcional ao ganho visual frente ao que foi entregue (badge + trilho + faixa de dias).
- **"Impeccable"**: segue sem ser localizada.

## Estado dos commits e da branch (atualizado)

```
redesign/rv30-visual-premium-20261121 (branch atual, isolada)
  ec4a336 feat(design): structural redesign — hero, pricing, dashboard, admin, login
  30e5e0e docs(design): add Fase 2B visual redesign report
  bdd9430 feat(design): self-host Manrope ExtraBold for headlines/price display; button polish
  7f2316a feat(commercial): standardize RV30 price to R$ 499,00 and fix platform/program nav copy
qa/rv30-playwright-e2e-20261121 (branch-base, preservada, não tocada)
  911121d / a64e53b (de outra sessão, preservados)
  9db3804 e anteriores (Fase 1/2)
```

Nenhum `git push`, merge ou deploy nesta rodada. `publish/rv30-visual-20261121` (de outra sessão) permanece intocada, conforme instruído explicitamente.

## Instruções para testar localmente

```
npm run dev                     # servidor local em http://127.0.0.1:8081
npm run qa:screenshots          # varredura visual completa (375/768/1366/1440/1920)
npm test && npx playwright test && npx playwright test --config playwright.real.config.js
```

Abra manualmente `/`, `/entrar`, `/admin/entrar`, `/meus-cursos` (com fixture de sessão) e `/admin` para ver as 5 mudanças estruturais listadas acima diretamente no navegador.
