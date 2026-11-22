# REDESIGN-CHECKPOINT

Branch: `redesign/rv30-visual-premium-20261121`. Nada publicado, sem push/deploy.
Última regressão completa: 97/97 (23 backend + 66 e2e + 8 e2e real), 0 vulnerabilidades, lint/typecheck OK.

## Status por página

1. [x] **Player** (`area.html`) — vídeo full-width, faixa de 4 infos abaixo (antes: coluna lateral dividindo espaço). `assets/css/rv-moodboard.css`. Commit `9632e3f`.
2. [x] **Checkout** (`checkout.html`) — card-recibo com foto de header full-bleed, form sem caixa. `checkout.html`, `assets/css/projeto.css`, `assets/css/rv30.css`. Commit `1b2954d`.
3. [x] **Login aluno** (`login.html`) — foto de fundo editorial no painel de marca. Admin login mantido sem foto (decisão deliberada, é ferramenta interna). Commit `5fdfc11`.
4. [x] **Admin — componentes compartilhados** (tabela/card/filtros/pills de status) — atualiza automaticamente Alunos/Pedidos/Auditoria/Biblioteca/Atendimento via `table()`/`card()` compartilhados. Verificado com screenshot em Alunos. Commit `d9b506a`.
   - **Pendência real**: Curso e aulas / Biblioteca / Atendimento não foram abertos individualmente com screenshot nesta sessão — herdam o componente mas não foram inspecionados um a um.
5. [x] **Área do aluno** (dashboard) — hero do programa full-width + faixa secundária de estatísticas (rodada anterior, commit `aba2ed6`, confirmado ainda válido).
6. [~] **Landing**:
   - [x] Hero — reconstrução full-bleed (rodada anterior `aba2ed6`).
   - [x] Metodologia — trilho conectando os 3 passos (rodada anterior `ec4a336`/`aba2ed6`).
   - [x] Rosangela — pull-quote real substitui o "espaço vazio" citado. Commit `d9882a8`.
   - [x] Oferta/preço — faixa de 30 dias (rodada anterior `ec4a336`).
   - [x] Catálogo (RV30 × Treinamento personalizado) — diferenciação ativo/planejado (borda sólida+glow vs. tracejada+opacidade). Commit `8ebcd1f`.
   - [ ] **Prévia da área do aluno** (`.student-preview`) — inspecionada, já é um mockup ilustrado distinto (sidebar+vídeo+grid), decisão: não mexer, não é genérica.
   - [ ] **FAQ e rodapé** — inspecionados, accordion simples funcional; não foram redesenhados estruturalmente nesta sessão (menor prioridade frente ao que foi pedido nominalmente).

## Causa raiz recorrente (documentar para não repetir investigação)

Praticamente toda mudança de cor/borda em páginas com classe `.rv30-landing`/`.rv-checkout`/`.portal-body` precisa ser verificada contra **3 arquivos CSS carregados por último** (nessa ordem de prioridade crescente): `rv-evolua.css` → `rv30.css` (o mais autoritativo). `rv30.css` tem várias regras `:is(...)` genéricas (ex.: linha ~215, antiga `:is(.price-card,.catalog-card,.student-preview)`) que resetam border/background de múltiplos componentes de uma vez. Antes de estilizar um componente novo numa dessas páginas, **sempre grep o nome da classe nesses 2 arquivos primeiro** — economiza o ciclo "editei, não mudou nada, investiguei de novo" que aconteceu 3 vezes nesta sessão (hero badge, order-total, catalog-card).

## Próxima ação exata (se a sessão for retomada)

1. Abrir `/admin?view=content`, `/admin?view=media`, `/admin?view=support` com fixtures e conferir visualmente se o componente compartilhado já é suficiente ou se cada tela precisa de ajuste próprio.
2. Se "Prévia da área do aluno" e FAQ/rodapé ainda forem considerados insuficientes, é o próximo passo — mas foram avaliados e julgados não-genéricos nesta sessão.
3. Regressão completa já validada nesta sessão; rodar de novo apenas se houver mudança adicional.
