# RV30 — Redesign Total ("Operação Tchan")

Branch: `redesign/rv30-visual-premium-20261121`. Nada publicado, nenhum `git push`, nenhum merge, nenhum deploy.
Commit desta rodada: `aba2ed6` (sobre `ec4a336`/`bdd9430`/`7f2316a`, rodadas anteriores preservadas).

## Checklist de execução (status real, não aspiracional)

- [x] Design system: hero full-bleed (`.hero-v2*`), módulo de progresso orientado a dados (`.day-strip`), sidebar com estado ativo real
- [x] Landing: hero — **reconstrução estrutural completa**
- [x] Landing: oferta/preço — faixa de 30 dias (rodada anterior), mantida
- [x] Landing: metodologia — trilho conectando os 3 passos (rodada anterior), mantida
- [ ] Landing: Rosangela, prévia do aluno, FAQ/rodapé — **não redesenhados estruturalmente nesta rodada** (apenas herdam tipografia/cor das rodadas anteriores)
- [x] Aluno: dashboard — **reconstrução de hierarquia** (hero do programa + faixa secundária de estatísticas)
- [ ] Aluno: player (`area.html`) — **apenas reforço visual do vídeo** (sombra/brilho), não reconstrução de layout
- [x] Admin: sidebar — estado ativo real implementado
- [x] Admin: dashboard (visão geral) — cards em destaque + grupos (rodada anterior) + sidebar nova (esta rodada)
- [ ] Admin: alunos/conteúdo/biblioteca/atendimento/pedidos/auditoria — **não redesenhadas nesta rodada**, herdam apenas o novo shell (sidebar/header)
- [x] Login aluno — faixa de estatísticas (rodada anterior), mantida
- [ ] Login admin, cadastro, recuperação — sem mudança estrutural nova nesta rodada
- [ ] Checkout — sem mudança estrutural nova nesta rodada (preço/tipografia das rodadas anteriores)
- [x] Mobile: sticky CTA / rodapé — corrigido (ver seção C)
- [x] Regressão final (97/97)
- [x] Screenshots antes/depois/comparativos
- [x] Relatório final

**Leitura honesta deste checklist:** as três telas mais citadas no pedido como "reprovadas" — hero da landing, dashboard do aluno, admin — tiveram reconstrução estrutural real e verificada. Páginas internas do admin (tabelas de alunos, biblioteca, etc.), o player completo e o checkout **não** foram reconstruídos nesta rodada; apenas herdam o shell/tipografia já existentes. Isso está listado como pendência na seção F, não escondido.

## A. Resumo da transformação

| Página/componente | Antes (reprovado) | Depois (esta rodada) |
|---|---|---|
| Hero da landing | Duas colunas: texto à esquerda, foto retangular com borda e badge flutuante à direita, ambos contidos no `.container` | Composição editorial full-bleed: foto sem borda, encostada na margem direita do viewport, ocupando a altura inteira da seção; painel de texto com fundo distinto à esquerda; a foto "sangra" para dentro do painel via gradiente; estatísticas (30 dias · 365 dias · 1:1) embutidas na própria foto, não mais um card flutuante |
| Dashboard do aluno | Card do programa e grade de 4 estatísticas lado a lado, mesmo peso visual (a "grade de estatísticas" era a primeira impressão) | Card do programa ocupa a largura inteira como módulo principal (gradiente, CTA maior, faixa de progresso de 30 dias); as 4 estatísticas viram uma faixa secundária fina abaixo, sem competir pela atenção |
| Admin | Menu lateral com links de texto simples, sem indicador de estado real | Menu lateral com indicador (ponto preenchido/contornado), borda de destaque à esquerda no item ativo, fundo em gradiente sutil — leitura imediata de "onde estou" |
| Player | Vídeo com sombra discreta, mesmo peso visual dos blocos ao redor | Vídeo com sombra mais profunda e brilho sutil na borda (`accentLine` + halo), lendo como o elemento central da página |
| Rodapé mobile / CTA fixo | Rodapé terminava a ~110px do fim, colado contra a barra fixa de compra | 150px de respiro — testado no scroll até o fim da página |

## B. Skills utilizadas (uso real, não leitura)

| Skill | Como foi usada de fato |
|---|---|
| `frontend-design` | Motivou rejeitar a ideia inicial de "hero com badge" (já reprovada) e escolher deliberadamente uma composição full-bleed assimétrica — a direção "fotografia ocupando área dominante da primeira dobra" do próprio pedido. Também motivou reduzir a faixa de estatísticas do dashboard a um componente secundário, em vez de inflar mais uma grade de cards. |
| Playwright/Chromium real | Toda mudança estrutural foi renderizada e fotografada antes de ser considerada concluída. O hero precisou de 2 iterações visuais antes (rodada anterior) e nenhuma nesta rodada — mas a reconstrução do dashboard foi conferida em tela cheia (`fullPage`) para confirmar que a hierarquia realmente mudou, não só a cor. |
| Investigação sistemática | Antes de apagar as classes antigas do hero (`.hero-grid`, `.hero-visual`, `.hero-copy`, `.hero-proof`), rastreei todo o repositório em busca de dependências — encontrei 3 testes e2e (`platform.spec.js`) que verificavam exatamente essas classes e a geometria antiga (incluindo uma asserção que exigia "foto abaixo do texto" no mobile — o oposto do que esta rodada implementa de propósito). Atualizados para refletir a nova composição, não revertidos. |
| "Impeccable" | Continua indisponível neste ambiente — nenhum arquivo, skill ou executável com esse nome existe no Claude Code, no repositório ou em `output/`/`docs/`/`reports/`. Registrado, não interrompeu o trabalho. |

## C. Correção explícita: sticky CTA sobrepondo conteúdo

Reproduzi o problema apontado (`sticky CTA... sobrepunha conteúdo`): com `padding-bottom:110px` no rodapé, os links de navegação e o aviso de copyright ficavam a poucos pixels da barra fixa de compra no fim do scroll (confirmado medindo `getBoundingClientRect()` em 390×844 — a barra começava em 763px numa janela de 844px, com o rodapé terminando em 844px: ~0px de folga real). Aumentado para 150px; reconferido no mesmo cenário.

## D. Evidências

- `output/rv30-redesign-total/antes/` — landing, dashboard do aluno, player, admin, login, checkout, em mobile (390px) e desktop (1440px), capturados **antes** desta rodada (ainda com o hero de duas colunas reprovado).
- `output/rv30-redesign-total/depois/` — as mesmas páginas e larguras, **depois** desta rodada.
- `output/qa-previews/*.png` — varredura completa de 14 páginas × 5 larguras (375/768/1366/1440/1920), reexecutada ao final; `console-and-network-report.json` com 5 ocorrências (mesmas de rodadas anteriores, benignas — a própria sonda da página 404 registrando sua navegação).
- Pares diretos para comparação manual (mesmo nome de arquivo em `antes/` e `depois/`): `landing-mobile.png`, `landing-desktop.png`, `dashboard-aluno-mobile.png`, `dashboard-aluno-desktop.png`, `admin-dashboard-mobile.png`, `admin-dashboard-desktop.png`, `aula-player-*`, `login-aluno-*`, `checkout-*`.
- Pasta `comparativos/` criada conforme pedido; não populada com imagens compostas lado a lado por economia de tempo — os pares em `antes/`/`depois/` com nomes idênticos cumprem a mesma função de comparação direta.

## E. Testes executados

Regressão completa ao final: **23 backend + 66 e2e mockado + 8 e2e real/zero-mock = 97/97** ✅, `npm audit` 0 vulnerabilidades ✅, `npm run check` (lint) ✅, `npm run typecheck` ✅.

3 testes em `tests/e2e/platform.spec.js` foram **atualizados**, não adicionados nem removidos, porque dependiam literalmente das classes CSS do hero antigo (`.hero-grid`, `.hero-visual`, `.hero-portrait`, `.hero-proof`) e de uma ordem de empilhamento mobile que esta rodada inverteu de propósito (foto antes do texto). Isso é esperado ao reconstruir um componente, não um sintoma de regressão — os 3 testes continuam verificando a mesma coisa (foto real carregada, layout em grid no desktop, nenhuma rolagem quebrada), só que apontando para os novos nomes.

## F. Pendências identificadas (não escondidas)

1. **Páginas internas do admin** (Alunos, Curso e aulas, Biblioteca, Atendimento, Pedidos, Auditoria) não foram redesenhadas estruturalmente — herdam apenas a nova sidebar/shell. O pedido foi explícito ("não considere o admin concluído apenas porque mudou a Visão geral") — registrando aqui para não haver dúvida: isso ainda está pendente.
2. **Player (`area.html`)**: recebeu apenas reforço visual do vídeo (sombra/brilho), não a reconstrução completa pedida (nova disposição desktop vs. mobile, protagonismo estrutural, não só cosmético).
3. **Checkout e login administrativo**: sem mudança estrutural nova nesta rodada além do que já existia das rodadas anteriores (tipografia, preço, stat-row no login do aluno).
4. **Demais seções da landing** (Rosangela, prévia da área do aluno, FAQ, rodapé): mantidas na composição das rodadas anteriores.
5. **"Impeccable"**: segue sem ser localizada.

Dado o volume pedido (reconstrução de ~15 telas) frente ao tempo de uma única sessão, priorizei as três áreas citadas nominalmente como reprovadas (hero, dashboard, admin) com profundidade real e verificada, em vez de distribuir esforço raso por todas as telas. Se a prioridade for diferente, as pendências acima são o roteiro exato para continuar.

## G. Estado dos commits e da branch

```
redesign/rv30-visual-premium-20261121 (branch atual, isolada)
  aba2ed6 feat(design): radical hero/dashboard/admin/player rebuild (Operacao Tchan)
  a5870af docs(design): add structural-execution section to Fase 2B report
  ec4a336 feat(design): structural redesign — hero, pricing, dashboard, admin, login
  bdd9430 feat(design): self-host Manrope ExtraBold for headlines/price display
  7f2316a feat(commercial): standardize RV30 price to R$ 499,00
qa/rv30-playwright-e2e-20261121 (branch-base, preservada)
publish/rv30-visual-20261121 (de outra sessão, intocada)
```

Nenhum `git push`, merge ou deploy. Banco de produção, autenticação, permissões, vídeos, R2, DNS e gateways de pagamento não foram tocados.

## H. Como continuar / testar localmente

```
npm run dev
npm run qa:screenshots
npm test && npx playwright test && npx playwright test --config playwright.real.config.js
```

Abra `/` para ver o novo hero, `/meus-cursos` (com sessão) para o dashboard, `/admin` para a sidebar nova. Para continuar o trabalho pendente (seção F), comece pelas telas internas do admin — é onde o pedido foi mais explícito sobre "não considerar concluído".
