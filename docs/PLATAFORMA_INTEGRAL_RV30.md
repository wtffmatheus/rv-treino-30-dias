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

- Etapa 1: diagnóstico implementado; validação de CI e preview em andamento.
- Etapas 2 a 10: PENDENTES, ainda não iniciadas nesta rodada.
- Veredito da plataforma completa: PENDENTE. O acesso publicado atual continua sendo de validação.
