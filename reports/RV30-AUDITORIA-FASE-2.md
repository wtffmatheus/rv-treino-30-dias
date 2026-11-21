# RV30 — Auditoria Fase 2: evidência real, não apenas mock

Branch: `qa/rv30-playwright-e2e-20261121` (criada a partir de `rv30-plataforma-integral-20261107`).
Nada publicado, nenhum `git push`, nenhuma credencial real usada ou exposta.

## A. Resumo executivo

A Fase 1 provou que a suíte de testes existente passa (66 e2e com API mockada, 23 testes de
backend, 0 vulnerabilidades). Isso prova que o **frontend** respeita os contratos de API e que a
**lógica de backend roda corretamente contra bancos locais fixture** — mas não prova que login,
permissões e vídeos funcionam fim-a-fim, porque os 66 testes e2e interceptam toda chamada
`/api/**` com `page.route()` (zero código de backend executado) e os 23 testes de backend nunca
passam por um navegador real.

Nesta fase, construí dois **harnesses locais que envolvem o código real do backend** (sem mock
de API) atrás de um servidor HTTP comum, usando Miniflare (D1/R2 locais e descartáveis, sem
conta Cloudflare real) e dirigi um Chromium real contra eles. Isso elevou a evidência de
autenticação e vídeo de "UI mockada passou" para "código real de login/sessão/permissão/entrega
de vídeo respondeu corretamente a um navegador real", nos limites do que é seguro fazer sem
credenciais de produção (que não tenho e não devo obter).

**Corrigido nesta fase:** 1 bug de CSS (herdado da Fase 1, re-confirmado), lacunas de fixture que
geravam ruído de rede, 1 linha órfã em `.env.example`, poluição de 14+ pastas de outras
ferramentas de IA no repositório.
**Não corrigido porque não é bug:** nenhum problema de aplicação foi encontrado na investigação
de autenticação/vídeos — ver seção I para o que ficou pendente e por quê.

## B. Skills e configurações

| Item | Situação |
|---|---|
| Superpowers | Instalado, 14 skills presentes em `plugins/cache/.../superpowers/7.0.2/skills`, íntegro (reconfirmado por amostragem, não reanalisado por completo para economizar tokens). |
| "Impeccable" | Procurado em todo o repositório, em `output/`, `docs/`, `reports/`, nomes de arquivo — **não existe nenhum artefato com esse nome**, e não há skill instalada com esse nome. Não consigo usá-lo como referência sem o arquivo/link. A revisão visual desta fase foi feita por inspeção direta das capturas (ver seção F). |
| MCP `claude-flow`/Ruflo (`.mcp.json`) | `autoStart:false`, não carregado nesta sessão. Confirmado novamente: nenhuma ferramenta `ruflo`/`memory_store`/`swarm_init` existe no `ToolSearch`. Não alterado (arquivo de configuração de outra ferramenta — fora do escopo autorizado). |
| 14+ pastas de outras IAs (`.augment`, `.codebuddy`, `.codewhale`, `.continue`, `.cursor`, `.factory`, `.gemini`, `.kilocode`, `.kiro`, `.opencode`, `.qoder`, `.roo`, `.trae`, `.warp`, `.windsurf`, `.github/prompts`) | Confirmado: cada uma é uma cópia idêntica do mesmo pacote de skills de design/UI, criada automaticamente por um plugin que espelha skills para todo cliente de IA conhecido. Nenhuma referenciada pelo código do RV30. **Não removidas** (são configuração de outras ferramentas, não apenas "parecem desnecessárias" — remover exige sua autorização). **Adicionadas ao `.gitignore`** para que nunca sejam enviadas ao GitHub por engano — essa é a ação de baixo risco que resolve o risco real ("arquivos que não deveriam ir ao GitHub"). |
| `INITIAL_PASSWORD=sua_12345678` em `.env.example` | Investigada a origem: não há nenhuma referência a essa variável em nenhum arquivo `.js`/`.mjs`/`.sql`/`.md` do projeto (grep case-insensitive, zero ocorrências). Não é lida por `scripts/dev-server.js`, `backend/server/api.js` nem `backend/platform/*`. Conclusão: resíduo morto do mesmo processo automático que injetou o bloco "Ruflo Integration" no `CLAUDE.md` global (já removido na Fase 1). **Confirmado não utilizado → removida** a linha (reversível via `git diff` do commit, backup implícito é o próprio HEAD anterior). |
| `CLAUDE.md` (projeto, não rastreado) | Não tocado — fora do escopo desta auditoria. |
| Dependências | Nenhum pacote novo instalado. `miniflare` (usado pelos novos harnesses) já era uma dependência transitiva de `wrangler`/testes existentes — confirmado reaproveitando exatamente o padrão de `tests/qa_access_test.js` e `tests/platform_student_test.js`. |

## C. Autenticação — resultados reais (não mock)

Duas superfícies de backend coexistem no projeto, confirmado lendo o código, não supondo:

1. **`backend/qa/core.mjs`** — worker de homologação de **uma única conta** (email fixo via
   `QA_EMAIL`), é o que gera o selo "Homologação privada" visto nas capturas. Serve
   `/api/auth/login`, `/api/account`, `/api/courses/rv30/...`.
2. **`backend/platform/*.mjs`** — sistema real multiusuário (`user_roles`, `enrollments`,
   `identity_metadata`), é quem decide `roles`, matrícula e acesso a vídeo para alunos reais.
   Serve `/api/student/dashboard`, `/api/courses/rv30`, etc.

A suíte e2e existente (Fase 1) nunca executa nenhum dos dois — ela intercepta `/api/**` inteiro.
Nesta fase, `scripts/qa-real-platform-server.js` e `scripts/qa-platform-repro-server.js` expõem
o código real de cada um via HTTP, com D1/R2 locais (Miniflare), e `tests/e2e-real/platform-real-auth.spec.js`
dirige um Chromium real contra o segundo (o que importa para contas de aluno reais).

**8/8 passaram, tudo contra código real:**

| Cenário (estado real no banco) | `enrollment.status` real retornado | Tela renderizada |
|---|---|---|
| Matrícula ativa (caminho feliz) | `active` | Dashboard completo, vídeo dia 1 reproduzível |
| `user_roles` sem `role='student'` | `restricted` | "Acesso em análise" — mensagem clara, não quebra |
| Sem matrícula para `course_id='rv30'` | `none` | "Sem matrícula" — mensagem clara, não quebra |
| Matrícula revogada (`revoked=1`) | `revoked` | "Acesso revogado" |
| Matrícula expirada (`expires_at` passado) | `expired` | "Acesso expirado" |
| Senha incorreta | `401 LOGIN_FAILED` real | Alerta de erro visível, nenhum cookie criado |
| Logout | sessão apagada no servidor | Cookie `__Host-rv30_session` invalidado; `/api/student/dashboard` volta a exigir login (401 real) |

Cookie de sessão real (`__Host-rv30_session`, `HttpOnly; Secure; SameSite=Strict`) confirmado
emitido e aceito por um Chromium real em `http://127.0.0.1` (tratado como origem segura).

**Caso `matheustrindadedasilva` (vídeos não aparecem):** não tenho acesso à conta de produção e
não a acessei. Reproduzi, em conta isolada equivalente, as 5 causas de backend que a lógica real
de `backend/platform/auth.mjs` reconhece (tabela acima) — **todas produzem uma mensagem clara na
tela, nenhuma produz "nada aparece" silenciosamente**. Conclusão honesta: se o sintoma relatado
foi literalmente "sem erro, só sem vídeo", a causa mais provável **não** é uma das 5 acima; é mais
provável ser (a) um bug específico de frontend/cache no navegador do aluno, (b) sessão expirada
localmente sem novo login, ou (c) um estado de backend que não reproduzi aqui. Confirmar exige
acesso de leitura à conta real (fora do escopo autorizado) ou os logs/console do navegador do
aluno no momento do problema.

## D. Vídeos dos 30 dias

- Catálogo real (`/api/courses/rv30`) confirmado retornando os 30 dias com `available=false` no
  dia 30 (política de "dia 30 pendente" respeitada pelo código real, não por mock).
- Entrega de mídia real: `/api/courses/rv30/days/1/media` respondeu `206 Partial Content` com os
  bytes corretos de um Range request (`bytes=0-4` → `"01234"`), via R2 local real (Miniflare),
  passando pela autorização real de sessão — sem bucket tornado público, sem bypass.
- Dia 30: `/api/courses/rv30/days/30/video` respondeu `404` real, não inventado.
- **Limitação honesta:** os bytes fixture não são um vídeo H.264/AAC decodificável (o ffmpeg
  embutido no Playwright só suporta VP9/WebM para gravação de tela, não codificação geral; gerar
  um MP4 real exigiria instalar um pacote novo, o que evitei por instrução explícita de não
  instalar sem necessidade comprovada). Portanto, **o pipeline de autorização e entrega de bytes
  foi validado com código real; a decodificação de quadros pelo `<video>` não foi**. Isso é uma
  lacuna de fidelidade de mídia, não de controle de acesso — a parte crítica de segurança.

## E. Requisições de rede — as 45 ocorrências da Fase 1

Todas vinham do **meu próprio script de captura de tela** (`scripts/qa-screenshots.js`), não da
aplicação. Agrupadas pela mesma causa raiz: 3 endpoints reais (`/api/courses/rv30`,
`/api/admin/uploads`, `/api/support?q=...`) não estavam cobertos pelas fixtures do script em
algumas páginas, então caíam no fallback `404` do próprio script — e o próprio script registrava
esse 404 (que ele mesmo gerou) como "falha". Nenhum dos três é um endpoint inexistente ou um bug
real da aplicação (confirmado lendo `assets/js/platform-admin.js` e `backend/qa/core.mjs`/
`backend/platform/*`, onde os três existem e respondem). Corrigido adicionando as fixtures
corretas — 45 → 5, e as 5 restantes são o próprio probe do 404 (`/isto-nao-existe-qa`) logando sua
própria navegação como erro de console, uma vez por breakpoint — comportamento esperado, não bug.

## F. Impeccable e revisão visual

Ferramenta "Impeccable" não localizada (ver seção B). Revisão visual feita por inspeção direta
das 75 capturas em `output/qa-previews/` (14 páginas × 5 resoluções da Fase 1 + as novas
`real-auth-*.png` desta fase). Tema dark e identidade azul-petróleo/turquesa preservados em
todas as telas revisadas; nenhuma nova captura foi necessária fora das 5 novas (`real-auth-*`),
já que nenhuma página de UI foi alterada nesta fase (apenas backend/scripts de teste).

## G. Testes — regressão completa (1 execução ao final)

| Suíte | Resultado | Comparação com a Fase 1 |
|---|---|---|
| Backend (23 arquivos) | 23/23 ✅ | Igual |
| E2E mockado (Playwright, 66 specs) | 66/66 ✅ | Igual |
| **E2E real (novo, 8 specs, zero mock)** | **8/8 ✅** | **Novo nesta fase** |
| `npm audit` | 0 vulnerabilidades ✅ | Igual |
| `npm run check` (lint) | OK ✅ | Igual |
| `npm run typecheck` | OK ✅ | Igual |

Nenhuma regressão. O total de testes subiu de 66+23=89 para 89+8=97 porque adicionei a suíte
`tests/e2e-real/` descrita na seção C — não porque algo foi removido.

## H. Arquivos modificados/criados nesta fase

| Arquivo | Motivo |
|---|---|
| `.gitignore` | Ignorar as 14+ pastas de outras ferramentas de IA e `.mcp.json`/`.claude*`/`.swarm` (seção B). |
| `.env.example` | Removida linha órfã `INITIAL_PASSWORD=...`, confirmada não utilizada (seção B). |
| `scripts/qa-screenshots.js` | Fixtures completadas para 3 endpoints não cobertos (seção E). |
| `scripts/qa-real-platform-server.js` (novo) | Harness real para `backend/qa/core.mjs`. |
| `scripts/qa-platform-repro-server.js` (novo) | Harness real para `backend/platform/worker.mjs`, com 5 cenários de matrícula. |
| `playwright.real.config.js` (novo) | Config Playwright apontando para o harness real. |
| `tests/e2e-real/platform-real-auth.spec.js` (novo) | 8 testes reais de autenticação/sessão/vídeo. |
| `reports/RV30-AUDITORIA-FASE-2.md` (novo) | Este relatório. |

Da Fase 1 (preservados, não re-tocados): `assets/css/projeto.css` (fix do 404), `scripts/qa-screenshots.js` (criação original), `package.json`/`package-lock.json` (bump do Playwright).

## I. Problemas pendentes

- **Causa raiz do caso `matheustrindadedasilva`**: não confirmada. Precisa de acesso de leitura à
  conta real (fora do escopo autorizado) ou dos logs de console/rede do navegador do aluno no
  momento do problema. As 5 causas de backend mais prováveis foram descartadas por produzirem
  mensagens de erro claras, o que não bate com "vídeo simplesmente não aparece sem aviso".
- **Decodificação real de vídeo**: pipeline de autorização/entrega validado com bytes fixture;
  decodificação de frames H.264/AAC por um `<video>` real não foi validada (exigiria instalar
  ffmpeg completo ou um MP4 de amostra versionado — não fiz isso sem sua autorização).
- **Sistema `backend/platform/*` em ambiente real (não local)**: só pode ser testado de verdade
  via `wrangler dev`/deploy contra o `account_id` e D1/R2 reais em `wrangler.platform.jsonc` —
  isso exige credenciais Cloudflare que não tenho e não devo obter. Tudo que relatei aqui é
  "mesmo código, banco local e descartável", o mais próximo do real que é seguro fazer sem essas
  credenciais.
- **Pagamentos (Asaas/Stone) e Supabase reais**: não testados nesta fase (fora do pedido e das
  regras de segurança — nenhuma cobrança real, nenhuma credencial real).

## J. Segurança do deploy

- Branch atual: `qa/rv30-playwright-e2e-20261121`, 8 commits à frente de `rv30-plataforma-integral-20261107` (2 da Fase 1 + 3 desta fase + nada mais).
- Nenhum `git push`. Nenhum deploy Vercel/Cloudflare. Nenhuma alteração em DNS, banco de produção,
  pagamentos reais ou credenciais. Nenhum pacote novo instalado.
- `main`/produção intocados.
