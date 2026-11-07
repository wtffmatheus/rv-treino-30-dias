# RV30 — design system petróleo

## Origem da paleta

Análise do PNG original fornecido pelo responsável, 1254 × 1254 pixels, sem editar a marca. Foram selecionados 287.189 pixels cromáticos da faixa turquesa; a mediana foi `#01E0D5`. O agrupamento quantizado dominante foi `#00E0D8` (201.322 pixels). A interface usa `#27C6BD`, com a mesma família de matiz e menor intensidade, para evitar aparência neon. Não há recoloração da logo ou das fotografias.

## Fonte única

`assets/css/tokens.css` contém as decisões de cores, fontes, espaçamento, bordas, elevação, vidro e controles. Os demais estilos consomem os tokens; os blocos `:root` duplicados foram removidos. Aliases das classes históricas apontam para os mesmos tokens, sem criar paletas independentes. Todas as 13 páginas carregam essa fonte uma única vez.

| Uso | Token | Valor |
| --- | --- | --- |
| Fundo | `--bg` | `#0B1D26` |
| Seção secundária | `--bg2` | `#102B35` |
| Superfície | `--panel` | `#173945` |
| Elevação | `--panel2` | `#204650` |
| Ação/destaque | `--accent` | `#27C6BD` |
| Destaque claro | `--accent2` | `#70D4D0` |
| Texto | `--text` | `#F4F8FA` |
| Texto secundário | `--muted` | `#BCD0D5` |

A escala de espaçamento é 4/8/12/16/20/24/32/40/48 px. A fonte é Segoe UI com alternativa Arial local, sem download ou referência a fontes indisponíveis. Controles têm altura de 48 px, painéis usam bordas de até 12 px e metadados rem inferiores a 12 px foram corrigidos. A tipografia mantém níveis claros sem uso de maiúsculas desnecessárias nos títulos.

## Componentes compartilhados

| Componente | Implementação |
| --- | --- |
| Botões | `.button`, variantes primary/secondary/ghost; foco visível, desabilitado e altura de toque |
| Formulários | `.portal-form`; rótulos, controles de 16 px, foco, erros e estados de submissão |
| Cards | `.my-course-card`, `.price-card`, `.catalog-card`, `.course-panel`, `.admin-panel`; superfícies da mesma família |
| Tabelas | `.admin-table`, `.admin-table-wrap`; hierarquia de cabeçalho/célula e tratamento responsivo |
| Modais | `.admin-dialog`, `.support-dialog`; mesmas bordas, fonte e cores |
| Alertas | `.form-error`, `.environment-note`, `.rv-qa-notice`; texto legível e cores sem dependência exclusiva do matiz |
| Menus | Cabeçalhos e navegação do aluno com a mesma paleta, estados ativos e foco |
| Carregamento/vazio | Placeholders do player e estados de curso/suporte, sem métricas inventadas |

O vidro é uma camada translúcida `rgba(23,57,69,.82)` com blur de 10 px em superfícies selecionadas. Existe fundo opaco `#15343F` para ausência de suporte e preferência por transparência reduzida. Não se aplica blur a todos os elementos nem se adicionam animações decorativas.

## Verificação

As auditorias agora examinam todos os arquivos CSS, em vez de apenas `projeto.css`. Isso revelou 103 prioridades `!important` históricas. Depois da revisão há uma única prioridade, para a semântica global de `[hidden]`. O limite do teste não foi aumentado.

Contrastes medidos no fundo principal: texto 16,14:1; texto secundário 10,77:1; destaque 8,13:1. O teste visual mantém exigência de 4,5:1 nos textos afetados do checkout sobre a superfície de painel.

Capturas anteriores estão prefixadas por `integral-stage1-`; as novas capturas locais usam `integral-stage2-`. Resultados de CI, commit e preview são registrados no andamento de [plataforma integral](PLATAFORMA_INTEGRAL_RV30.md). Estes ajustes visuais não aprovam as etapas de dados, mídia ou administração.
