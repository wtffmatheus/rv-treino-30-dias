# Revisão dos requisitos do RV 30 — 27/10/2026

**A revisão técnica encontrou e corrigiu erros adicionais. O projeto ainda não
está integralmente validado para operação real. A atualização visual permanece
em revisão, e o domínio principal ainda serve a versão anterior.**

Esta conferência usa o pedido original como critério e incorpora a correção
posterior: manter os tons azuis existentes e modernizar o layout. Não considera
testes com respostas simuladas como comprovação de uma integração real.

## Comparação com o pedido

| Requisito | Situação verificável |
| --- | --- |
| Inspeção, histórico e branch própria | Repositório e histórico remoto preservados; branch `rv30-evolucao-20261025`, PR #14. Hospedagem e domínio conferidos pelas conexões autorizadas e pelo navegador. |
| Identidade RV 30 | Nome e identificador `rv30` consistentes no produto. Logo nova restrita ao pacote; RV Fisiologia preservada como marca institucional. |
| Banco existente | Migração aditiva revisável preparada, sem execução. Não há comprovação de backup/restauração, políticas RLS ou isolamento de contas em um banco real. A presença de nomes de variáveis na hospedagem não comprova uma conexão válida. |
| Vídeos numerados | Importação numérica, lacunas e conflitos tratados e testados. **Zero vídeos reais vinculados; dias 1–30 pendentes.** Contagem remota do Drive desconhecida, pois a conexão não está disponível. |
| Acabamento e cores | Layout moderno com azul original, revisão de contraste, teclado, formulários e 11 larguras entre 320 e 1920 px. `plataforma.css` não contém a troca indevida para uma paleta verde. Referências e princípios em `DESIGN_RV30.md`. |
| Fotos da profissional | Os dois retratos fornecidos foram conferidos e usados em WebP: clínica na capa; fisiologia na apresentação/checkout. Sem substituição por outra pessoa. |
| Administração | Autorização preparada no servidor por conta autenticada, e-mail verificado e `ADMIN_EMAIL`. Testes de isolamento e revogação passaram com provedor simulado. Sem API publicada e configuração confirmada, o acesso real continua bloqueado. |
| Checkout e entrega | Adaptador Mercado Pago preparado, com conferência de produto/valor/ambiente/comprador, assinatura de webhook e transação idempotente. Provedor definitivo e condições comerciais não presumidos. Nenhuma cobrança real nem teste de pagamento no provedor executado. |
| Verificar entrega do RV 30 | Botão e consulta somente leitura implementados. Testes verificam que não aprova pedidos nem concede acesso. Consulta real depende de API, banco, conta administrativa e integração de pagamento operantes. |
| Testes | Resultados abaixo; testes reais de e-mail, banco, Storage, pagamento e reprodução continuam sem execução. |
| Publicação | Prévia revisável disponível no PR. A versão nova ainda não está no domínio principal. Publicação depende da autorização explícita exigida no pedido original. |

## Erros corrigidos nesta revisão

- A retomada no modo servidor começava na introdução, embora o progresso real
  aceite dias 1–30. Agora abre o primeiro dia incompleto e ignora entradas de
  progresso inválidas ou duplicadas.
- A consulta protegida de sessão considerava apenas a existência da linha no
  Auth. A migração proposta também verifica `not_after`, para rejeitar sessões
  cujo prazo venceu mesmo antes da limpeza da linha. SQL conferido contra o
  schema oficial e por teste estático; migração ainda não aplicada.
- Conflitos de um lote de vídeos com arquivos já associados podiam impedir a
  importação dos demais arquivos válidos. Agora os conflitos ficam explícitos,
  preservam os vínculos anteriores e não descartam os arquivos válidos.
- O validador CLI contava associações com o mesmo arquivo em dias diferentes
  como válidas. Agora exclui esses conflitos da contagem, aceita os formatos do
  editor e preserva a introdução opcional, exigindo 30 dias válidos para revisão.
- Avisos de inscrições em preparação permaneciam mesmo com disponibilidade
  confirmada pelo servidor. Agora acompanham o estado real sem habilitar vendas.
- O checkout expunha linguagem de implementação; o login ainda pressupunha
  cadastro somente após a compra. Textos ajustados ao fluxo atual.
- Falhas da simulação local de pagamento não tinham região visível de erro.
  Agora são anunciadas, inclusive em exceções, sem confirmar uma compra.

## Testes executados nesta revisão

| Verificação | Resultado e limite |
| --- | --- |
| `npm test` | Passou: 13 scripts de regras, fluxos e segurança; inclui 32 verificações do backend e 6 regressões do progresso no modo servidor. Provedores externos simulados. |
| `npm run test:e2e` | **40 testes Chromium passaram**, incluindo os dois casos adicionados nesta revisão. |
| Responsividade | Oito rotas em 11 larguras, 88 combinações sem overflow horizontal ou imagem quebrada. |
| Lint e tipos | Passaram: sintaxe/referências/allowlist e TypeScript checkJs/JSDoc. |
| Build estático | Passou: somente 61 arquivos públicos em `dist/`; não inclui API, segredos, testes ou migrações. |
| Wrangler dry-run | Passou, sem publicação nem alteração de tráfego. |
| Runtime local Cloudflare | **27 verificações passaram** para rotas, assets, cabeçalhos e ausência de arquivos privados. |
| Seis auditorias Python | Passaram localmente com `beautifulsoup4` e `tinycss2` em ambiente virtual isolado: smoke, conteúdo, estrutura, CSS, esquema histórico e contraste. Isso não executa PostgreSQL nem verifica todas as combinações WCAG. |
| Dependências | `npm audit` retornou zero vulnerabilidades no momento da revisão. |
| `npm run audit:launch` | **NO_GO**, resultado esperado: faltam provas das integrações e das condições comerciais. Não foi alterado para produzir uma aprovação artificial. |

Capturas locais: `output/qa-previews/` e
`output/playwright/revisao-azul-{desktop,mobile}-20261027.png`. A faixa de
simulação nas capturas locais identifica o ambiente loopback; não representa
compra ou acesso real. O browser integrado não conectou nesta sessão; foi usado
o Playwright CLI como alternativa, sem ler cookies ou perfis de outros serviços.

## Situação real de treino.rvfisiologista.com.br

O domínio atende pelo projeto Vercel `rv-treino-30-dias`. Na leitura desta
revisão, a produção continua no deployment
`dpl_56oXH8JWKPqzGPKF3ttadfYe47rH`, commit
`056761af491e229fb899c0b16f41d4ce55eab00d`, branch `main`.
O navegador exibiu o título antigo **RV Fisiologia | Evolua no seu ritmo ·
Método RV**. `/api/config` e `/api/account` responderam 404.

O Cloudflare fornece o DNS desse hostname. O Worker separado não possui sua
rota/domínio; seus comandos de upload de versões não atualizam este site.
A falha de empacotamento original foi corrigida e o check da versão azul
concluiu com sucesso. Não houve mudança de DNS nem de tráfego de produção.

O primeiro limite do fluxo real já está identificado: a página não encontra a
API. O build estático não executa o servidor Node. Para hospedar esse backend,
é necessário um serviço Node persistente atrás de HTTPS na mesma origem ou
adaptar sessões/limitação de tentativas para armazenamento compartilhado antes
de usar múltiplas instâncias ou funções serverless. Não basta copiar o handler
atual para uma função Vercel e depender de seus Maps em memória.

## Auditoria do ambiente existente

Foram encontrados 11 nomes de variáveis cadastradas na Vercel, incluindo
Supabase e provedores de pagamento. Seus valores não foram impressos nem
copiados para o código. A conexão não devolve os valores secretos para inspeção.
`ADMIN_EMAIL`, `MERCADO_PAGO_COLLECTOR_ID` e `RV30_SALES_ENABLED` não foram
encontrados entre os nomes cadastrados.

Foi preparada uma auditoria de build isolada, com o script
`scripts/audit-connected-backend.js`, usando somente GET, sem RPCs, pagamento,
migração ou registros de clientes. O script aceita apenas a origem HTTPS padrão
do Supabase, proíbe redirecionamentos e solicita zero linhas às tabelas.
O relatório contém somente presença de configuração, status HTTP e códigos
sanitizados; o script não é distribuído em `dist/` e não cria endpoint público.

No primeiro preview isolado, o script executou com sucesso, mas as variáveis
Supabase esperadas não estavam disponíveis com valor utilizável. Retornou
`not_configured` sem consultar o serviço externo. Portanto não se afirma que o
banco foi acessado, que essas credenciais são válidas ou que as tabelas existem.

A segunda e última execução distinguiu explicitamente chave ausente de valor
vazio: os 11 nomes cadastrados estavam definidos no processo, porém todos sem
conteúdo utilizável. Os marcadores da plataforma confirmaram ambiente `preview`.
Logo, a herança dos nomes ocorreu; falta configuração utilizável nessa prévia.
`ADMIN_EMAIL`, `MERCADO_PAGO_COLLECTOR_ID` e `RV30_SALES_ENABLED` continuaram
ausentes. Essa é uma evidência do build de preview executado, não uma leitura
dos valores secretos globais ou uma prova sobre outro ambiente.

Evidências protegidas na Vercel: previews de auditoria
`dpl_BbpSmMbTFCMJT92ppRDMN4uBSH5p` e
`dpl_7RzM6t5y7V4cAvzwbYFqZ5F3hpbG`, ambos no projeto que atende o domínio,
com target de preview. Não houve chamada ao banco nem ao provedor financeiro.

Depois dessa auditoria, o proprietário informou o e-mail administrativo. Foi
cadastrado como `ADMIN_EMAIL` do tipo Secret na configuração do projeto Vercel,
nos escopos preview e produção. O endereço não foi incluído no Git. A existência,
o tipo protegido e os dois escopos foram conferidos pela API, sem imprimir o valor.
Não houve novo deployment de produção nem criação/concessão de conta no Supabase.
O administrador continua dependendo de identidade autenticada, confirmação do
e-mail e API operante. Configurar a variável não equivale a validar esse login.

## Pendências necessárias para concluir o projeto real

1. Disponibilizar a conexão autorizada ao Drive ou um manifesto privado dos
   arquivos reais; revisar, preparar e testar os vídeos no armazenamento privado.
2. Disponibilizar o ambiente Supabase de homologação com configuração utilizável
   no runtime autorizado; inventariar a base, validar backup/restauração e aplicar
   a migração revisada em homologação antes de qualquer mudança em produção.
3. Usar o `ADMIN_EMAIL` já cadastrado na hospedagem, criar/convidar a conta por um
   canal administrativo confiável e testar conta verificada, SMTP, cadastro,
   recuperação, logout e revogação com duas contas reais de teste. Se a API for
   hospedada em outro serviço, configurar a variável também nesse runtime.
   Não enviar senhas ou tokens na conversa.
4. Hospedar a API com o modelo correto de sessões e limites, na origem do site;
   validar o fluxo navegador → API → banco → autorização → player.
5. Confirmar provedor, preço, prazo de acesso e política de reembolso/contestação;
   testar pagamento de sandbox, notificações repetidas/atrasadas e entrega real.
6. Autorizar explicitamente a publicação da versão visual revisada, se desejado,
   mantendo vendas bloqueadas enquanto as etapas anteriores não forem validadas.

A publicação visual isolada não conclui a plataforma de alunos. Para publicar,
usar o projeto Vercel já associado ao domínio, o commit exato aprovado e os
checks correspondentes. Depois conferir no próprio domínio a identidade, as
cores, os assets e os estados de acesso. Manter o deployment anterior acima
como alvo de rollback; nenhuma migração precisa acompanhar uma troca visual.

Referências operacionais: [PR #14](https://github.com/wtffmatheus/rv-treino-30-dias/pull/14),
[guia do backend](../backend/SECURE_BACKEND_RV30.md),
[vídeos](VIDEOS_RV30.md) e [publicação/cores](REVISAO_AZUL_PUBLICACAO_20261026.md).
