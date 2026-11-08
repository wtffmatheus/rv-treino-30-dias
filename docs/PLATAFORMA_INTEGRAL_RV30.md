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
- Etapa 4: APROVADA EM STAGING. Commit `c85e0f8a750bd30865d30835f25d8bfb314ffd10`, Actions `42405439742`, preview `dpl_5M9CdLJy1nbT35xDLEZjkZvgZMZ7` READY; áudio, reprodução, busca, retomada e revogação comprovados.
- Etapa 5: APROVADA EM STAGING. Commit `badeaf0d3541c9a59329089912eb51168145ddd9`, Actions `42408546531`, preview `dpl_FfMd8oCSmQuBvmen75B18WN39tNw` READY; quatro perfis, recuperação, isolamento e expiração reais conferidos.
- Etapa 6: APROVADA EM STAGING. Commit `6bae377f5dc6ddd82410854fb85744c466b136c9`, Actions `42511656121` aprovado, preview `dpl_AFM15E699t5gf2RZj4oRgeL1umcb` READY; jornada administrativa e mídia reais repetidas na URL exata.
- Etapa 7: EM REVISÃO, após aprovação da etapa 6.
- Etapas 8 a 10: PENDENTES, ainda não iniciadas nesta rodada.
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

### Aprovação da etapa 4 em staging

SHA `c85e0f8a750bd30865d30835f25d8bfb314ffd10`, Actions `42405439742` aprovado,
deployment `dpl_5M9CdLJy1nbT35xDLEZjkZvgZMZ7` READY no endereço
`rv-treino-30-dias-b70zvs9lx-matheus-silvas-projects-feb13148.vercel.app`.
Logs de build conferidos: commit correto, conclusão e nenhum erro de build;
há avisos não bloqueantes do npm sobre configuração e scripts de instalação.

Reprodução real repetida nesse preview em 07/11/2026 às 16:20 BRT. Dias
1/15/25/29 decodificaram respectivamente 237/267/261/243 frames e
130.638/148.825/142.908/133.278 bytes de áudio. RMS não silencioso em todos,
busca a 45% e retomada após reload, com 90 respostas Range 206 observadas na
jornada. Sem exceções JavaScript na jornada positiva. O dia 30 continuou sem
player e sem botão de conclusão habilitado.

Revogação real no preview: nova Range 403 e player interrompido em 21.184 ms;
matrícula de validação restaurada ao final. Os erros HTTP esperados de acesso
negado nesse cenário não foram tratados como falhas inesperadas de aplicação.
A suíte conectada de preview passou nas duas verificações, sem mocks.

Quatro capturas dos vídeos e cinco capturas responsivas foram abertas e
examinadas em `output/qa-previews/integral-stage4-preview-*`. Sem overflow ou
desalinhamento grave. Os JSON sanitizados de reprodução e revogação ficam em
`output/platform-stage4-preview-{browser,revoke}.json`, fora do Git.

Gate técnico da etapa 4 aprovado para os 29 vídeos disponíveis, com dia 30
explicitamente pendente. Isso não aprova conteúdo clínico/editorial, gateway ou
o lançamento comercial. O domínio principal não foi promovido.

## Etapa 5 — identidade, papéis e matrículas

Migração aditiva aplicada somente no D1 isolado, com exportação privada anterior.
`qa_users` permanece como tabela física para preservar as referências de progresso
e atividade; a autorização nova não depende da lista de dois e-mails. As novas
tabelas separam identidade, papéis múltiplos, matrícula, sessões, convites, limites
e eventos. O progresso e o histórico existentes foram preservados.

Sessão opaca de 256 bits, hash no banco, cookie `__Host-` HttpOnly/Secure/Strict,
prazo absoluto de uma hora e inatividade de 30 minutos. Papéis, situação da conta,
versão da credencial e matrícula são conferidos no servidor por solicitação.
Administração e matrícula são independentes. O ambiente de homologação aceita
somente identidades de validação; o modo de produção aceita somente comerciais.
Não há migração automática de uma conta de teste para um comprador.

Convites/recuperação têm finalidade, validade de 30 minutos, hash, versão da
credencial e consumo atômico de uso único. Abrir o link não o consome. Nova senha
exige pelo menos 12 caracteres; a troca encerra sessões anteriores e exige login.
Entrega é manual por canal privado, após conferência pelo responsável. Não há
envio automático de e-mail homologado nem comprovação de posse de caixa postal.
Esse limite aparece no formulário e na resposta administrativa. Credenciais e
tokens de validação permanecem em arquivos ignorados e fora dos screenshots.

As escritas administrativas exigem sessão recente de até 15 minutos e registram
evento junto à alteração. Bloqueio invalida sessões; desbloqueio não as restaura.
Revogação e vencimento retiram o curso e a mídia, preservando a identidade e o
histórico. Limites de tentativas são aplicados por IP, e-mail e token; eventos de
identidade são retidos por até 90 dias. Cadastro e pagamentos públicos continuam
desabilitados.

Validação local com API/D1/R2 reais: formulários de quatro perfis (admin sem
matrícula, dois alunos independentes, conta com ambos os papéis), login inválido,
cookie inacessível ao JavaScript, aluno em administração 403, alternância de
contexto e logout com conta subsequente 401. Recuperação real: GET sem consumo,
senha curta impedida, troca única, senha antiga recusada, nova senha aceita,
sessão anterior 401 e replay 400. Corrigido logout que aguardava a carga do
histórico antes de vincular o botão; teste de regressão mantém a resposta do
dashboard pendente e confirma a saída.

Vencimento real de matrícula de fixture: conta 200, mídia 403 e nenhuma ação de
continuar. Vencimento da sessão: formulário de login e conta 401. Matrícula
restaurada em `finally` e novo login confirmou acesso ativo. O teste usa o horário
do servidor: o computador estava aproximadamente 90 segundos adiantado em
relação ao cabeçalho Date do Cloudflare. Isso não foi classificado como defeito
de expiração da aplicação. O relógio da aplicação é resolvido a cada requisição.

Testes automatizados: contratos D1/R2 locais de concorrência, IDOR, separação de
ambiente, expiração, revogação, bloqueio, tentativas e recuperação; 58 testes de
navegador aprovados, incluindo quatro casos novos de UI. Lint, typecheck, build e
dry-run aprovados. As dez capturas locais de login/dashboard em cinco resoluções
foram abertas e examinadas em `output/qa-previews/integral-stage5-local-*`; sem
overflow, inclusive nas larguras adicionais 320/375/430/1024. Console sem exceções
nessa captura. Evidências privadas sanitizadas: `output/platform-ui-*-sanitized.log`,
`output/platform-recovery-evidence.json`, `output/platform-live-expiry-evidence.json`.

Estado: TESTADA LOCALMENTE com serviços conectados. Commit/Actions e repetição no
preview exato ainda são necessários para aprovar a etapa. A gestão completa,
editor de cursos/mídias, suporte e métricas pertencem à etapa 6.

### Aprovação da etapa 5 em staging

Commit `badeaf0d3541c9a59329089912eb51168145ddd9` confirmado no remoto,
[Actions 42408546531 aprovado](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/42408546531),
deployment `dpl_FfMd8oCSmQuBvmen75B18WN39tNw` READY:
`rv-treino-30-dias-hdogj6b4s-matheus-silvas-projects-feb13148.vercel.app`.
Logs confirmam esse commit, build concluído e nenhum erro de build. Worker
isolado com o novo módulo de identidade; versão de código
`bb5faa3c-7a88-4530-97c1-e8703b41de87`, com origem exata do preview configurada
posteriormente como secret. Proteção de acesso da Vercel preservada.

No preview, os quatro perfis passaram pelo formulário real; admin sem matrícula,
aluno com admin 403 e alternância de contextos confirmados. Recuperação passou
sem consumo no GET, com senha forte, senha antiga recusada, nova senha aceita,
replay 400 e sessão anterior 401. As repetições inicialmente atingiram o limite
real de tentativas (429); a proteção foi mantida e a jornada foi repetida após
a janela. O harness passou a iniciar por outro documento antes do link com
fragmento, evitando navegação de âncora sem reinicializar os scripts.

Dois alunos reais de validação foram abertos em contextos separados. Um PUT com
`userId` do outro aluno e papel administrativo forjado alterou somente o
progresso da identidade autenticada; o progresso da outra conta permaneceu
idêntico. O estado inicial da fixture foi restaurado. Administração continuou
403. Matrícula vencida: conta 200, vídeo 403 e sem continuar; sessão vencida:
login e conta 401; matrícula restaurada e novo login ativo.

Player novamente conferido com a nova identidade: dias 1/15/25/29 reproduziram
237/266/260/244 frames e áudio não silencioso, buscaram e retomaram a posição.
84 respostas Range válidas; nenhuma exceção JavaScript na jornada positiva.
Dia 30 permaneceu bloqueado. Duas verificações conectadas de preview passaram,
sem interceptação de requisições. Dez screenshots de login/dashboard e quatro
dos vídeos foram abertos e examinados em `output/qa-previews/integral-stage5-preview-*`.

Gate técnico da etapa 5 aprovado. Isso não homologa envio automático de e-mail,
cadastro comercial, gestão completa ou pagamentos. O domínio principal foi
consultado novamente: continua em `dpl_4iei9qAakJwvSk83Hy9orDcTCPYR`, commit
`a9a8b5482b97c4ddec7c375fba43f4dda52f62c7`, READY, sem promoção desta rodada.

## Etapa 6 — administração persistente

Migração aditiva em `backend/platform/admin-schema.sql`, aplicada apenas no D1
isolado após exportação privada de 104.213 bytes. O Wrangler recusou a exportação
por autorização (10000); a conexão Cloudflare disponível concluiu o backup e a
migração. A API retornou 81 instruções e 92 alterações de preparação. Nenhum
comando foi direcionado ao banco ou ao Worker do domínio principal.

Catálogo persistente com 30 posições, 29 vídeos importados e dia 30 pendente.
Não foram sobrescritos os objetos originais. Preço inicial aprovado: R$ 399;
matrícula comercial permanece em 365 dias e não é editada pelo painel. Períodos
administrativos podem ser alterados, com origem identificada e auditoria.

Módulos implementados:

- Perfis: criação sem matrícula e sem senha conhecida pelo administrador,
  convite privado de ativação, busca, filtros, paginação de 25 itens, detalhes,
  contato, validade administrativa, notas, conclusões, histórico e atividade.
  Liberação, revogação, bloqueio e papéis consultam permissões no servidor.
  Exportação CSV limitada a 5.000 registros, com proteção contra fórmulas.
- Curso/aulas: rascunhos e publicação separados, objetivo, orientações, materiais,
  avisos, duração informada, ordem, vídeo, capa e confirmação de revisão. Versões
  persistidas e restauração como rascunho. Revisão otimista impede sobrescrita
  concorrente; índice único protege a ordem publicada. Alterações não removem
  progresso. Nova publicação exige mídia pronta, tamanho no R2 e revisão editorial.
- Biblioteca: upload multipart autenticado em blocos de 5 MiB, retomada, cancelamento,
  limite de 2 GiB por vídeo/5 MiB por capa e quota diária por administrador. Chaves
  e identificadores multipart não são expostos. Servidor confere tamanho e
  metadados MP4 faststart/H.264/AAC, duração e dimensões; capas PNG incluem CRC e
  imagens aceitas são PNG/JPEG. Upload termina em revisão; somente aprovação
  explícita permite associação. Não há transcodificação automática nem alegação
  de decodificação integral no Worker. Arquivos incompatíveis são recusados.
- Suporte: solicitação privada por aluno, associação opcional ao dia, mensagens,
  resposta da equipe, leitura, não lidas e situação do atendimento. Outro aluno
  recebe 404. Conteúdo de mensagem e notas não aparece no log de auditoria.
- Métricas: matrículas, contas, período, logins, inícios, conclusões, progresso,
  atividade, aulas e pendências calculados do banco. Aula sem conclusão marcada
  não é apresentada como prova de abandono. Gráfico usa totais diários reais.
- Comercial: tabela e consulta de pedidos/estados preparados; não existe botão
  para inventar confirmação de pagamento ou executar reembolso. Gateway/webhook
  continuam não homologados, receita indisponível e vendas bloqueadas.
- Auditoria: operações administrativas registradas com ator, entidade, referência,
  operação e data. Versão/publicação e evento são persistidos na mesma transação.
  Senhas, cookies e tokens não são incluídos no histórico.

Interface com navegação compacta, menu mobile por teclado, formulários com rótulos
explícitos e tabelas reorganizadas em blocos no celular. Corrigido espaço vazio
em páginas curtas causado pela distribuição automática das linhas do grid.
Seletores e botões usam os tokens compartilhados; a biblioteca expõe o formulário
de novo envio em um painel expansível antes da listagem. Na aula, o primeiro
convite à calculadora fica depois do player, sem impedir a reprodução.

Corrigida uma falha real da inicialização: o login podia receber envio antes do
handler estar pronto. Botões começam desabilitados e há prevenção síncrona do
POST nativo; somente a vinculação do formulário habilita a ação. Convite,
recuperação e cadastro também usam POST e ativação controlada. Testes mantêm a
configuração pendente e verificam que nenhum envio nativo ocorre.

Jornada local com frontend no Chromium e API/D1/R2 reais: criação e convite de
um perfil exclusivo de validação, login, edição de contato, validade e nota;
solicitação e resposta privada; upload do arquivo correto do dia 29 e da logo
como capa de teste; reprodução privada do upload (35 frames, 720×1280, 12,266667 s);
aprovação de mídia; associação e publicação; reprodução pelo aluno e capa 200;
conclusão; despublicação com mídia 404 sem perder progresso; restauração de versão;
revogação 403, bloqueio 401, desbloqueio sem restaurar sessão e exportação CSV.
Foram observadas 97 respostas e nenhuma exceção JavaScript na jornada aprovada.
O perfil criado terminou bloqueado e revogado, sem cobrança.

O conteúdo técnico temporário foi restaurado ao snapshot anterior da aula 29,
com nova revisão e evento `technical_validation_restored`, sem apagar o histórico.
As tentativas interrompidas do harness também ficaram identificadas como contas
de validação bloqueadas/revogadas. Não houve criação de compradores comerciais.
Evidência sanitizada: `output/platform-stage6-local-journey.json`; CSV e estados
autenticados permanecem privados e ignorados pelo Git.

Player revalidado após o catálogo persistente: dias 1/15/25/29 com áudio não
silencioso, busca/retomada e respectivamente 180/262/256/239 frames. Houve 21
respostas Range válidas e dia 30 bloqueado. Fonte:
`output/platform-stage6-local-videos.json`. Isso não equivale a aprovação editorial
das orientações de treino, que continua pendente da responsável.

Recuperação do responsável preparada em `/plataforma` no serviço de revisão
privado. O contexto Cloudflare Access é obrigatório; cabeçalhos forjados não o
substituem. RPC restrito às duas contas de homologação já configuradas, senha
forte e invalidação das sessões; indisponível para identidades comerciais.
Testes D1 locais e de contexto Access passaram. Requisição anônima real foi
encaminhada ao login Access (302); a troca real de senha pelo proprietário ainda
não foi executada e não é apresentada como homologada. A versão antiga do
domínio principal usa outro banco e suas senhas não são alteradas por essa página.

Estado desta etapa: TESTADA LOCALMENTE com serviços conectados; revisão visual,
CI e repetição na URL exata de preview ainda necessárias para aprovação.

Fechamento local: `npm test`, 65 testes E2E, lint, typecheck, build e dry-runs
aprovados. Sete casos novos de UI cobrem navegação/teclado, filtros, conflito de
cadastro, revisão concorrente, texto inerte no suporte, inicialização dos dois
logins e distribuição de página curta no mobile. As 35 capturas administrativas
nas cinco resoluções foram abertas e examinadas; correções de tabela mobile,
seletores, página curta e acesso ao upload foram recapturadas. Larguras adicionais
320/375/430/1024 sem overflow. Os registros da auditoria foram traduzidos para
português na interface, preservando os códigos no backend.

Na revisão final, a reativação administrativa passou a distinguir matrícula
existente de nova liberação por 365 dias. Matrículas de origem pagamento não
podem ser renovadas, reativadas ou ter validade alterada manualmente. Bloqueio,
liberação e revogação também entram na auditoria central na mesma transação.
Esses limites têm contratos D1 locais, sem simular confirmação de pagamento.

### Fechamento em staging — 08/11/2026

Preview exato: `https://rv-treino-30-dias-jjo5u8wl2-matheus-silvas-projects-feb13148.vercel.app`.
A jornada real foi repetida sem interceptações: 97 respostas, convite, login,
perfil, validade, suporte, upload de vídeo e capa, revisão, publicação, conclusão,
despublicação, restauração, revogação, bloqueio, exportação e auditoria aprovados.
Evidência sanitizada: `output/platform-stage6-preview-journey.json`.
O perfil exclusivo terminou bloqueado e revogado. A aula 29 retornou ao conteúdo
anterior, com revisão 19 e mídia `import-day-29`, preservando versões e auditoria.

Os dias 1/15/25/29 reproduziram respectivamente 180/266/262/242 frames, com áudio
não silencioso e posição restaurada. As requisições Range retornaram 206; o dia
30 permaneceu bloqueado. Evidência: `output/platform-stage6-preview-videos.json`.
Isso não constitui aprovação editorial nem teste real de upload de 2 GiB.

Foram abertas e examinadas individualmente 35 capturas administrativas, 15
capturas públicas e quatro capturas de reprodução do preview, além das quatro
capturas locais dos vídeos. As cinco resoluções obrigatórias e larguras
adicionais constam dos registros `platform-stage6-preview-{captures,public-captures}.json`.
Não houve overflow ou exceção JavaScript nos respectivos percursos. As capturas
ficam em `output/qa-previews/integral-stage6-*`; dados pessoais foram mascarados.

O bucket continua privado: domínio gerenciado desabilitado e nenhum domínio
customizado. O domínio principal foi consultado novamente: deployment
`dpl_4iei9qAakJwvSk83Hy9orDcTCPYR`, SHA `a9a8b54`, sem promoção desta versão.
Pagamento, entrega automática por e-mail, revisão editorial e dia 30 continuam
pendentes. O reset real de senha pelo proprietário via Access não foi executado.

Na inspeção visual foram identificados dois ajustes para a revisão da etapa 7:
referência fixa a Asaas no checkout, ainda sem provedor homologado, e subtítulos
de semanas oriundos do catálogo demonstrativo na navegação das aulas remotas.

## Etapa 7 — revisão em andamento

Correções implementadas após inspeção da prévia:

- A navegação remota usa disponibilidade real das aulas, sem nomes de semanas
  herdados da demonstração. Os critérios de regressão conferem também o dia 30.
- Provedor escolhido em 08/11: Mercado Pago. Landing, checkout, configuração,
  termos e privacidade atualizados; a interface informa integração em preparação.
  A aplicação ainda precisa ser criada pelo proprietário. Ver
  [pendências e critérios](MERCADO_PAGO_RV30.md). Não há pagamento homologado.
- Quota e limite de uploads ativos passam por verificação SQL atômica no momento
  da inserção. O multipart recém-aberto é abortado se perder essa disputa.
- Nova tentativa de conclusão enquanto o R2 ainda processa o upload retorna 409,
  preservando o estado, em vez de marcar o arquivo como rejeitado. A conclusão
  persistida não duplica o evento de auditoria. Contratos com D1/R2 locais incluem
  quatro aberturas concorrentes e uma conclusão deliberadamente pausada.
- Títulos do suporte usam a escala compacta compartilhada da administração;
  a inspeção encontrou tamanho herdado da landing no formulário de atendimento.

Verificação local: `npm test`, 66 E2E, lint, typecheck, build, dry-runs dos três
Workers e seis auditorias Python aprovados antes da repetição em staging.
`npm audit --omit=dev` não relatou vulnerabilidades nas dependências de produção
nesta consulta; isso não é auditoria de segurança integral. Os testes de UI
continuam identificados como fixtures; os testes D1/R2 locais não são apresentados
como serviços comerciais homologados.

O novo código do Worker foi enviado somente a `rv30-platform-staging`:
deployment `b6fd630792da4db1ae899d580e4a434e`, sem migração ou alteração nos bancos
da produção. As configurações protegidas foram preservadas. Contratos de batch
e multipart foram conferidos na documentação oficial da Cloudflare:
[D1](https://developers.cloudflare.com/d1/worker-api/d1-database/) e
[R2](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/).

Capturas locais de checkout, aula e suporte nas cinco resoluções, mais detalhe
do estado do provedor, em `output/qa-previews/integral-stage7-local-*`.
As capturas iniciais que ainda mostravam carregamento foram descartadas e refeitas
após estabilizar a API e decodificar vídeo; capturar uma tela vazia não aprovou
o resultado. Revisão de preview exato, CI e verificação conectada continuam
necessárias antes de aprovar esta etapa. Não há certificação WCAG integral nem
medição de desempenho de usuários reais neste registro.
