# RV30 — execução integral por etapas

## Diretriz vigente

O prompt definitivo de 07/11/2026 substitui a identidade azul-marinho pela família azul-petróleo esverdeada extraída da logo original. A publicação principal desta reestruturação exige aprovação dos dez gates, em ordem. A versão atual permanece disponível enquanto a nova plataforma é homologada. Não abrir vendas sem pagamento, webhook, identidade e matrículas homologados.

## Etapa 1 — auditoria integral

### Estado observado diretamente

- Branch de trabalho: `rv30-plataforma-integral-20261107`, criada a partir de `a9a8b5482b97c4ddec7c375fba43f4dda52f62c7`.
- Produção Vercel: `dpl_4iei9qAakJwvSk83Hy9orDcTCPYR`, READY, mesmo commit, domínio `treino.rvfisiologista.com.br`. O build entrega 61 arquivos estáticos. A API não é executada pelo build Vercel: `/api/*` é encaminhado ao Worker `rv30-premium-preview`.
- Worker ativo: banco D1 `rv30-premium-preview`, cinco tabelas de aplicação (`qa_users`, `qa_grants`, `qa_sessions`, `qa_progress`, `qa_limits`). Consulta real: duas contas, uma liberação e zero conclusões no momento da auditoria. É acesso de validação, não cadastro comercial.
- O Worker usa secrets para a lista de origens, os identificadores das contas, o segredo de derivação de senha e o catálogo privado. A autorização das contas de validação deriva da configuração protegida, não de metadados enviados pelo navegador.
- Autenticação real das duas contas foi conferida; aluno sem papel administrativo, administrador sem matrícula própria. A API informa `qaOnly=true`, `salesEnabled=false`. Aluno na API administrativa: 403; mídia anônima: 401.
- R2 `rv30-videos-private`: r2.dev desativado e nenhum domínio público. A API fez HEAD autenticado nos 30 dias: 29 respostas 206 com tipo MP4 e intervalos; dia 30 ausente. O catálogo sozinho não foi usado como prova de existência. A correspondência editorial e a avaliação de áudio/reprodução dos quatro dias exigidos ficam para a etapa 4.
- Outro banco D1 (`rv30-qa-access`) e o Worker de revisão (`rv30-revisao`) continuam existentes. O review está protegido por Cloudflare Access e usa Service Binding. Não foram modificados os recursos de outros projetos da conta.
- Há variáveis Vercel de Supabase e provedores antigos, verificadas somente por nome/tipo. Não foram lidos valores e sua presença não comprova funcionamento. Não há variáveis Asaas na listagem Vercel consultada. O backend Node/Supabase e as migrações presentes no repositório não são a API que atende o domínio hoje.
- Rotas reais `/api/admin/courses`, `/api/admin/metrics` e `/api/support`: 404. Consulta administrativa de aluno e catálogo do curso: 200. Há mensagens honestas de indisponibilidade nas telas, mas as funcionalidades administrativas requeridas ainda não existem nesse backend.

### Diagnóstico por requisito

| Área | Estado observado | Trabalho necessário |
| --- | --- | --- |
| Identidade | Azul-marinho da rodada anterior | Extrair logo e aplicar o novo petróleo/turquesa com tokens compartilhados |
| Layout | Landing e login responsivos; nove CSS históricos | Consolidar as decisões, reduzir conflitos, compactar navegação e conferir todas as telas |
| Aluno | Nome, matrícula, conclusão e retomada pelo primeiro dia não concluído | Datas reais, última aula, histórico, atividade validada, próximas aulas e mensagens |
| Vídeos | 29 objetos privados disponíveis; dia 30 pendente | Testar efetivamente dias 1/15/25/29, busca, retomada, áudio e falhas de sessão/rede |
| Identidade e permissões | Duas contas de validação, papel por allowlist | Identidade, perfis, múltiplos papéis e matrículas separados; credenciais fortes e convites seguros |
| Administração | Uma conta de aluno, bloqueio e liberação persistentes | Gestão completa, filtros, perfis, edição, validade, notas, histórico e exportação |
| Cursos/aulas | Catálogo gerado do manifesto secreto | Editor persistente, rascunhos, publicação, revisões e associação de mídia sem apagar progresso |
| Biblioteca | Inventário privado de importação | Upload autenticado, validação, associação, processamento e histórico de substituição |
| Atividade | Não há eventos ou tempo persistidos | Sessões de atividade, batimentos limitados pelo servidor, visibilidade/reprodução, retomada e retenção |
| Métricas | Sem endpoint real | Indicadores calculados dos registros, filtros e gráficos; não apresentar receita simulada |
| Suporte | Indisponível no modo servidor | Mensagens isoladas por aluno, estados, respostas, histórico e notificações internas |
| Auditoria | Sem tabela administrativa no backend ativo | Eventos estruturados e atômicos com a alteração; sem senha/token no histórico |
| Comercial | Contratos locais preparados, vendas bloqueadas | Homologação externa de gateway/webhook antes de ativar qualquer cobrança |
| Backup/rollback | Deployment anterior identificado | Exportação e restauração verificadas do novo banco; migrações aditivas e reversão de código |

### Riscos e decisões de arquitetura

1. Não expandir o backend de duas contas como se já fosse uma plataforma comercial. Criar um Worker e banco de homologação próprios, mantendo o ambiente atual intacto.
2. Usar Vercel para o frontend, Cloudflare Workers para a API, D1 para persistência relacional e R2 privado para mídia. Reutilizar as conexões efetivamente disponíveis evita depender de um Supabase que não foi homologado. Não há necessidade de framework ou biblioteca de UI adicional.
3. Preservar o contrato do frontend onde for adequado, com respostas versionadas para dados de aluno, curso e administração. Construir módulos separados de autenticação, alunos, aulas, atividade, suporte, mídia e auditoria.
4. Separar identidade, papel, perfil e matrícula. Administrador sem matrícula não deve ser identificado como aluno ativo; um usuário com ambos os papéis deve escolher o contexto. As contas de teste existentes não são migradas automaticamente para contas comerciais.
5. Migrações no novo D1 serão aditivas. Toda alteração administrativa relevante deve registrar auditoria na mesma transação. Validar restauração de backup em banco isolado antes de qualquer promoção.
6. Métricas devem derivar de dados persistidos. Tempo de atividade deve ter limite de intervalo imposto pelo servidor e exigir aula aberta, página visível e reprodução ativa; não comprova atenção humana. Não somar uma aba em segundo plano. Política de retenção e transparência devem constar na interface e documentação.
7. Vídeos permanecem no bucket privado. Cada HEAD/GET/Range verifica sessão e matrícula. O novo ambiente poderá ler os objetos existentes, sem substituir ou excluir originais durante a homologação. Novos uploads usam namespace próprio e limites explícitos.
8. Convites e recuperação precisam de tokens aleatórios, hash no banco, finalidade e prazo, uso único e invalidação de sessões. Entrega de e-mail só pode ser declarada após configurar e testar um provedor; convites entregues manualmente pelo responsável devem ser identificados como tal.
9. Credenciais fracas das contas demonstrativas atuais não aprovam o novo gate comercial. O bootstrap e os testes da nova plataforma usarão segredos protegidos e autenticação administrativa apropriada.
10. Vendas permanecem bloqueadas. Ausência do vídeo 30 e de condições editoriais finais deve ser exibida como pendência. Não inventar duração, objetivo, materiais, credenciais ou resultados para completar telas.

### Evidências da auditoria

`output/integral-stage1-audit.json` contém configuração pública sanitizada, resultados das rotas e status individual dos 30 dias. Capturas reais: `output/playwright/integral-stage1-landing-desktop.png` e `integral-stage1-admin-desktop.png`. Estados autenticados são privados, ignorados pelo Git e nunca enviados como artefato público.

### Plano sequencial e gates

| Etapa | Entrega | Gate |
| --- | --- | --- |
| 1 | Auditoria e arquitetura deste documento | Serviços reais inspecionados, diagnóstico, dependências e plano registrados; CI e preview da branch conferidos |
| 2 | Tokens da logo, componentes e petróleo/Clear Glass | Antes/depois, oito larguras, contraste, teclado e preview |
| 3 | Dashboard e navegação do aluno, dados persistentes necessários | Datas, histórico, retomada e estados reais; desktop/mobile e API |
| 4 | Player e mídia privada | Reprodução 1/15/25/29, áudio, range, busca, retomada e 30 identificado como pendente |
| 5 | Identidade, papéis, sessões e matrículas gerais | Contas distintas, isolamento, expiração, bloqueio, revogação e persistência em homologação |
| 6 | Administração, cursos, mídia, suporte e auditoria | Operações completas conferidas no banco, sem números falsos |
| 7 | Revisão e hardening | Segurança, linguagem, acessibilidade e desempenho verificados |
| 8 | Homologação completa | Jornadas aluno/admin e todos os cenários negativos reais |
| 9 | Release em preview | SHA, Actions, deploy, recursos, API e navegação correspondentes |
| 10 | Publicação | Gates críticos aprovados, backup/restore, migrações e rollback; testes no domínio |

O encerramento de uma etapa aprovada inicia automaticamente a próxima. Dependências externas serão registradas no momento em que impedirem um gate essencial; não serão usadas para apresentar funcionalidades locais como se estivessem homologadas.

## Progresso

- Etapa 1: APROVADA. Commit `2d855b0`, [Actions 42400133028 aprovado](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/42400133028), preview `dpl_P6Bf7SGf88dsGdBf2FkygfDKDuup` READY. Navegação autenticada e catálogo com 30 posições conferidos em `rv-treino-30-dias-61rdis8vq-matheus-silvas-projects-feb13148.vercel.app`. 47 testes locais e verificações estáticas aprovados.
- Etapa 2: APROVADA. Commit `46f0564241008d0574b4e749877d43f9cdb76e71`, Actions `42400888494` aprovado, preview `dpl_AFUHKzirjydMgAVgH12jwHDoQG5C` READY. As 32 combinações públicas de página/largura foram conferidas no preview exato.
- Etapa 3: APROVADA EM STAGING. Commit `1714b46a1e00850640a4a2b3ec94a83352e98ab2`, Actions `42403803838` aprovado, preview `dpl_3e5yc1jmDHq8VXnTCgGm4EhZwyQv` READY. Capturas e persistência conferidas no preview exato.
- Etapa 4: EM IMPLEMENTAÇÃO, após aprovação da etapa 3.
- Etapas 5 a 10: PENDENTES, ainda não iniciadas nesta rodada.
- Veredito da plataforma completa: PENDENTE. O acesso publicado atual continua sendo de validação.

## Etapa 2 — implementação e validação

Fonte única em `assets/css/tokens.css`; extração e contratos registrados em [design system petróleo](DESIGN_SYSTEM_PETROLEO_RV30.md). Treze páginas com tokens, cache busting de todos os CSS alterados e preservação das marcas/fotografias. As prioridades artificiais de estilo foram removidas em vez de sobrepor novas exceções. A auditoria de CSS foi ampliada para todos os arquivos, mantendo o limite de 20 prioridades; o resultado atual é uma.

Validação local: lint, typecheck, build com 62 arquivos, contrastes, auditoria CSS, 47 testes de navegador e 32 combinações de página/largura aprovados. Capturas desktop/mobile foram abertas para comparação. Não há alterações de autenticação, cobrança ou armazenamento nesta etapa. CI e preview do commit específico aprovados conforme o registro de progresso.

## Etapa 3 — área do aluno e processo permanente

### Implementação

Worker `rv30-platform-staging` e D1 `rv30-platform-staging`, isolados dos recursos
que atendem o domínio. A API continua explicitamente em homologação com duas
identidades de validação e vendas desligadas. O backend geral é a etapa 5; não
apresentar o contrato temporário de QA como autenticação comercial concluída.

O dashboard consulta datas reais da matrícula, estado, conclusões, última aula,
posição de retomada, histórico, próximas aulas e avisos. O tempo deriva de eventos
persistidos, com limite de 20 segundos por intervalo, reprodução e visibilidade
informadas pelo player, sequência idempotente e uma sessão de atividade por
usuário. Pausas, busca e intervalos longos não geram tempo indevido. Isso é uma
estimativa conservadora de reprodução, não comprovação de atenção ou exercício.
Os limites por minuto são 30 aberturas e 120 eventos por usuário. Eventos são
retidos até 90 dias e totais diários até 400, com limpeza nas aberturas de aula.

A sidebar desktop mede 244 px e pode ser recolhida por teclado; não possui scroll
interno. O aviso de QA ocupa a linha inteira, evitando deslocar a sidebar e o
player para colunas erradas. A navegação mobile mantém seletor de dias e menu
inferior. O dashboard foi compactado após inspeção das capturas, e os realces
azuis remanescentes de foco/navegação passaram a usar o turquesa compartilhado.

### Validação local e conectada

- `npm test`: contratos anteriores e novo teste com D1/R2 locais reais aprovados.
  Inclui concorrência, duplicação, background, pausas, busca, intervalos longos,
  origem, isolamento de usuário, revogação e rate limiting.
- `npm run test:e2e`: 50 testes aprovados. Os três novos contratos do dashboard
  usam respostas fixture e são identificados explicitamente como testes de UI.
- Lint, typecheck, build, auditorias de contraste/CSS e dry-run do Worker aprovados.
- API remota: administrador sem matrícula, aluno de validação com matrícula,
  estudante recebe 403 em administração, configuração com 29 dias reais e vendas
  desligadas. Nenhuma escrita foi feita nos bancos que atendem o domínio atual.
- Navegador com frontend local e API D1/R2 de homologação: reprodução real do dia
  1 por aproximadamente 18 segundos registrou 17 segundos, posição 17,514391 s
  persistiu e foi restaurada. Recolhimento por teclado e navegação entre dias
  funcionaram; 16 combinações de dashboard/aula com oito larguras sem overflow.
  O proxy loopback é ferramenta privada de integração, não código de produção;
  a origem exata do preview ainda deve ser validada sem esse proxy.
- Capturas reais locais em `output/qa-previews/integral-stage3-local-*`, nas cinco
  resoluções solicitadas. As imagens foram abertas e os defeitos encontrados
  corrigidos antes de gerar a versão revisada. Nomes são mascarados nas evidências.

### Regras persistentes e proteção

`AGENTS.md` e `docs/VALIDACAO_NAVEGADOR_RV30.md` registram o ciclo local/preview.
Playwright aceita `BASE_URL` e `QA_STORAGE_STATE`; a suíte `test:preview` consulta
serviços reais sem interceptação e não produz screenshots automáticas com dados
autenticados. A inspeção visual com capturas é uma etapa separada obrigatória.

A Vercel aceitou a desativação de associação automática de domínios e o Ignored
Build Step para produção da branch `main`. `vercel.json` também desabilita deploy
Git de `main`. O domínio foi consultado depois: continua no deployment
`dpl_4iei9qAakJwvSk83Hy9orDcTCPYR`, SHA `a9a8b54`, sem promover esta reestruturação.
Não foi realizado push em `main` para testar esse bloqueio.

### Arquivos desta etapa

Backend: `backend/platform/{student-schema.sql,student.mjs,worker.mjs}`,
`backend/qa/core.mjs` (exports de contratos existentes) e `wrangler.platform.jsonc`.
Frontend: `aluno.html`, `area.html`, `student-dashboard.js`, `lesson-activity.js`,
`api-client.js`, `student.js`, `area.js`, `student-platform.css`, realces nos estilos
compartilhados e referências de cache dos HTML. Processo: AGENTS, documentação,
configurações Playwright, testes, scripts npm, workflow CI e rewrite de preview.

Estado: TESTADA LOCALMENTE, com API D1/R2 conectada; aprovação de staging aguarda
Actions e inspeção do preview exato. Suporte completo, editor, identidade geral,
pagamentos e vídeo 30 não são declarados concluídos por esta etapa.

O primeiro CI desta etapa (`42403454053`, commit `8b9993e`) reprovou corretamente:
6 px de overflow na aula demonstrativa mobile em Linux. A ação adicional de
resetar a demonstração excedia o cabeçalho compacto. Foi corrigido o encolhimento
e a quebra de linha das ações, preservando os controles. A reprodução local com
fonte Arial confirmou a causa; um teste de regressão cobre 320/375/390/430 px.
O preview anterior não é aprovado como release desta etapa.

### Aprovação em staging

Após a correção, Actions `42403803838` passou no SHA `1714b46` (51 testes de
navegador e os demais checks). Preview READY:
`rv-treino-30-dias-fb17n7qf1-matheus-silvas-projects-feb13148.vercel.app`, deployment
`dpl_3e5yc1jmDHq8VXnTCgGm4EhZwyQv`. Logs de build conferidos e suíte `test:preview`
aprovada com duas verificações conectadas, sem mocks.

Dez capturas `output/qa-previews/integral-stage3-preview-*` foram abertas e
examinadas nas cinco resoluções; sem overflow e com sidebar/player alinhados.
Fundo computado `rgb(11, 29, 38)` e destaque `#27c6bd` confirmados.

Às 16:01 BRT de 07/11/2026, a jornada real no preview reproduziu o dia 1,
aumentou o tempo validado de 17 para 34 segundos, marcou uma conclusão que
persistiu no dashboard e restaurou a posição de `35,488745` segundos ao reabrir.
Recolhimento por teclado, nome acessível da aula concluída e navegação ao dia 15
funcionaram. Solicitações de vídeo/matrícula/progresso responderam 200/206 e não
houve exceções JavaScript nessa jornada. A homologação usou somente a matrícula
de validação no banco isolado, sem compra ou cobrança.

Gate da etapa 3 aprovado. Isso não homologa suporte completo, autenticação geral,
administração, pagamentos ou todos os vídeos. A próxima etapa é a revisão real
do player e dos 29 objetos privados.

## Etapa 4 — vídeos privados e player

Inventário individual em [videoaulas](VIDEOAULAS_RV30_INTEGRAL.md). Os 29 objetos
originais e as 29 cópias de entrega foram conferidos remotamente por HEAD,
ETag/MD5, tamanho e bytes dos intervalos inicial/final. Fontes, numeração e duração
foram preservadas. As cópias foram decodificadas integralmente por FFmpeg. O perfil
H.264/AAC 720×1280 com faststart reduz o lote de 672.319.279 para 208.096.938 bytes
(69%), sem substituir os originais. O Worker isolado aponta para as novas cópias;
o backend do domínio principal mantém o catálogo anterior. Há backup privado do
manifesto anterior para reversão.

O bucket foi consultado após os uploads: r2.dev desativado, nenhum domínio
público. A cada GET/HEAD/Range a API verifica sessão e matrícula. Anônimo recebeu
401; ausência do dia 30 recebeu 404. Objetivos não aprovados deixaram de aparecer
como instruções definitivas; são identificados como em revisão pela responsável.

O novo player mantém controles nativos, mostra carregamento e oferece nova
tentativa sem loop. Diferencia sessão encerrada, matrícula revogada/expirada e
falha de mídia/rede. Durante a reprodução verifica acesso a cada 30 segundos.
No teste real de revogação da matrícula de validação, uma nova Range recebeu 403
imediatamente e o player parou com a mensagem correta em aproximadamente 27,9 s.
A matrícula foi restaurada em `finally`. Dados já entregues ao dispositivo não
podem ser recolhidos; a proteção não é apresentada como DRM.

Retomada usa posição persistida e fechamento com keepalive. A liberação do
elemento de mídia aguarda o encerramento do registro para não sobrescrever a
posição com zero durante a troca de aulas.

Validação local com API/R2 reais:

| Dia | Áudio decodificado (bytes) | RMS máximo | Busca/retomada (s) |
| --- | ---: | ---: | ---: |
| 1 | 49.733 | 0,1148 | 54,22955 |
| 15 | 41.191 | 0,2530 | 6,269999 |
| 25 | 41.123 | 0,3422 | 6,12 |
| 29 | 41.148 | 0,2142 | 5,52 |

Os quatro conteúdos reproduziram no Chromium com frames decodificados, contexto
de áudio ativo e sinal não silencioso; a posição foi restaurada após reload e
houve respostas 206 reais. O dia 30 não criou player nem permitiu conclusão.
Comparações de oito frames originais/otimizados foram abertas e examinadas.
Capturas reais dos quatro dias e da aula nas cinco resoluções ficam em
`output/qa-previews/integral-stage4-local-*`. Não equivalem a revisão editorial
integral das orientações profissionais ou a teste em celulares físicos.

`npm test`, 54 testes de navegador, lint, typecheck, build e dry-run aprovados.
Três testes novos de UI com fixtures verificam sessão encerrada, revogação e
nova tentativa; são separados da reprodução conectada acima.

Estado da etapa: TESTADA LOCALMENTE com serviços conectados. Actions, SHA e
validação do player no próximo preview ainda são necessários antes de aprovar.
