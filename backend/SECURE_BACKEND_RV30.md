# Backend seguro do RV 30 — implementação revisável

Esta etapa acrescenta uma API Node em `backend/server/api.js` e uma migração
**proposta e não executada** em `backend/migrations/20261025_rv30_secure_foundation.sql`.
Não foram encontradas credenciais de Supabase, provedor ou administração no
ambiente disponibilizado. Não houve leitura de dados de clientes nem alteração
de produção. O esquema anterior `rv_course_*` é uma proposta histórica e permanece
intacto; a nova API utiliza tabelas `rv30_*` separadas. Não há migração automática
de usuários, pedidos ou acesso da demonstração do navegador.

## Executar e configurar

O servidor existente integra `createApi()` antes do roteamento estático. Use
Node 22+ para executar o projeto. A API usa recursos nativos; não precisa de um
SDK com segredo no cliente. O servidor lê `.env` local ignorado pelo Git quando
presente; na hospedagem, prefira as variáveis protegidas do processo.
No desenvolvimento, `PUBLIC_SITE_URL` deve ser exatamente a origem acessada no
navegador; `localhost` e `127.0.0.1` são origens diferentes.

| Variável somente no servidor | Uso |
| --- | --- |
| `PUBLIC_SITE_URL` | Origem canônica, HTTPS na hospedagem |
| `SUPABASE_URL` | Projeto exclusivo de homologação inicialmente |
| `SUPABASE_ANON_KEY` | Chave pública usada pelo servidor para Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Consultas protegidas, nunca publicar |
| `ADMIN_EMAIL` | Único e-mail administrativo autorizado; vazio bloqueia admin |
| `PAYMENT_PROVIDER=mercado_pago` | Adaptador automatizado preparado |
| `PAYMENT_ENVIRONMENT=test` | `test` ou `production`; usar projetos separados |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token do ambiente correspondente |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Assinatura HMAC das notificações |
| `MERCADO_PAGO_COLLECTOR_ID` | Conta recebedora esperada, verificada em cada pagamento |
| `RV30_SALES_ENABLED=false` | Compra bloqueada por padrão |
| `RV30_REFUND_ACCESS_POLICY=review` | Revisão pendente; `revoke`/`preserve` somente após definição comercial |
| `NODE_ENV=production` | Cookie Secure e exigência de HTTPS |

Para trocar o administrador, altere somente `ADMIN_EMAIL` no ambiente protegido e
reinicie o servidor. A pessoa precisa autenticar com senha pelo Supabase e ter
`email_confirmed_at`; nome, metadados, armazenamento local e parâmetros de URL
nunca conferem papel administrativo. Nenhum primeiro usuário é promovido.
O e-mail reservado não pode ser registrado pelo formulário público; a resposta
genérica é mantida, sem criar conta ou sessão. Provisionar a conta administrativa
pelo painel Auth protegido, com convite e confirmação do e-mail. Manter a
confirmação habilitada e revisar contas preexistentes antes da autorização.

O processo mantém sessões opacas em memória por até uma hora, sem refresh token
no navegador. Reinício encerra todas as sessões. Esta versão executável requer
**um processo Node persistente**; antes de múltiplas réplicas ou funções serverless,
substitua o armazenamento de sessões e os limites de tentativas por armazenamento
compartilhado com expiração. Publicar somente `dist/` em hospedagem estática não
implanta a API. Em produção, coloque o processo atrás de proxy TLS confiável,
remova acesso direto ao processo e configure o proxy para sobrescrever
`X-Forwarded-Proto`. O servidor local escuta somente em loopback.

## Contrato HTTP

Todas as respostas usam JSON e `Cache-Control: no-store`. Mutações normais exigem
`Content-Type: application/json` e `Origin` igual a `PUBLIC_SITE_URL`; nenhum CORS
aberto é permitido. A sessão é um cookie HttpOnly, SameSite Strict, Secure em
produção. O servidor consulta o usuário no Auth a cada operação e exige perfil
ativo. Depois dessa validação do provedor, extrai `session_id` e `sub` do token
recebido exclusivamente do Auth e consulta a existência da sessão em `auth.sessions`
pela função `rv30_session_active`, executável somente por `service_role`. A função
também exige `not_after` ausente ou posterior ao instante da consulta: uma linha
Auth remanescente após o limite de duração não é autorização válida. Tokens
sem esse vínculo ou com sessão removida são recusados, mesmo se `getUser` ainda
aceitar um access token após logout. Não há aceitação de JWT enviado pelo navegador
nem autorização baseada apenas em decodificação local. A função é parte da migração
proposta; enquanto ela não estiver aplicada, o acesso real falha fechado.
Erros são mensagens genéricas em português, sem respostas internas,
segredos ou tokens. Limites por IP usam o socket, ignorando cabeçalhos arbitrários.

| Método e rota | Entrada / resposta principal |
| --- | --- |
| `GET /api/config` | `{configured,salesEnabled,environment,product}` |
| `POST /api/auth/signup` | `{name,email,password}` senha 12+; resposta genérica, confirmação por e-mail |
| `POST /api/auth/login` | `{email,password}`; cookie e `{user,isAdmin}` |
| `POST /api/auth/recover` | `{email}`; resposta sem revelar existência da conta |
| `POST /api/auth/verify` | `{tokenHash,type:'email'}` ou `{tokenHash,type:'recovery',password}` |
| `POST /api/auth/logout` | `{}`; revoga sessão e expira cookie |
| `GET /api/account` | `{account:{id,name,email,status,entitlements},isAdmin}` |
| `GET /api/courses/rv30` | Somente matriculado; aulas sem caminho privado e progresso próprio |
| `GET /api/courses/rv30/days/:day/video` | Somente matriculado; URL de Storage assinada por 120 segundos |
| `PUT /api/courses/rv30/progress/:day` | `{complete:boolean}`; somente aula publicada da própria conta |
| `POST /api/orders` | `{productId:'rv30'}`, `Idempotency-Key` aleatório de 16+ caracteres |
| `GET /api/orders/:id` | Somente dono autenticado; retorno não confirma pagamento |
| `POST /api/webhooks/mercado-pago?data.id=:id` | HMAC válido e consulta autenticada ao provedor |
| `GET /api/admin/delivery?orderId=:uuid` | Admin; diagnóstico somente leitura |

O diagnóstico retorna `{result:'correct'|'pending'|'error',reasons,order,product,
account,provider,entitlement,lessons}`. Aulas ausentes e provedor indisponível
produzem pendência. Direito de acesso incompatível produz erro. O botão não altera
pagamento, não cria matrícula e não reprocessa uma compra.
Para cada uma das até 30 aulas publicadas, consulta somente os metadados do objeto
no Storage; um caminho cadastrado sem arquivo acessível não conta como disponível.
`salesEnabled` exige também consulta ao produto ativo e aprovado no banco;
configuração de ambiente sozinha não anuncia vendas disponíveis. Preço e moeda
só são retornados na configuração pública quando as condições protegidas estiverem
aptas. Falha de consulta mantém compras indisponíveis e preserva o acesso ao login.

### E-mails sem consumir credenciais em pré-visualizações

No Supabase, mantenha confirmação de e-mail habilitada e configure os templates
para abrir uma página de confirmação própria, por exemplo
`{{ .SiteURL }}/entrar#token_hash={{ .TokenHash }}&type=email` e a recuperação com
`type=recovery`. O token no fragmento não entra no acesso HTTP do servidor. A
interface deve exigir o envio explícito do formulário e então chamar `POST
/api/auth/verify`. Não use redirecionamento automático a `/auth/v1/verify` no
template; uma simples visita GET à API deste projeto não consome o token. O
provedor controla expiração e uso único. Defina `Site URL` e redirects somente
para as origens oficiais, SMTP e seus limites de tentativas no Supabase.

## Banco, armazenamento e recuperação

1. Escolher projeto de homologação vazio ou aprovado e inspecionar tabelas,
   políticas, Storage, extensões e versões do banco existentes.
2. Fazer backup verificável do schema e dos dados do projeto, do Storage e da
   configuração Auth. Restaurar uma cópia em projeto descartável antes de aplicar.
3. Revisar a migração SQL. Ela cria tabelas `rv30_*`, políticas apenas de leitura
   própria e uma função transacional executável exclusivamente pelo servidor.
   Não apaga, renomeia ou transforma dados antigos. A publicação de aulas e
   mudanças comerciais exigem canal administrativo confiável.
4. Executar a migração em homologação. Conferir que o bucket `rv30-videos` é
   privado. Policies restritivas próprias impedem `anon` e `authenticated` de
   acessar seus objetos ou alterar o bucket, inclusive quando existem policies
   permissivas amplas anteriores. As restrições só afetam esse bucket; outros
   produtos mantêm suas políticas. Validar também acesso direto fora da interface.
5. Associar cada arquivo válido ao seu dia no catálogo. Importar somente material
   autorizado, preservando números ausentes e resolvendo ambiguidades antes da
   publicação. `storage_path` é um caminho privado, não um link público do Drive.
6. Testar usando contas distintas, chaves anon e sessões reais; a API usa filtros
   próprios e as tabelas aplicam RLS para acesso direto. Nenhuma chave de serviço
   pode aparecer em arquivos gerados pelo build.

Para recuperar após falha: desabilitar `RV30_SALES_ENABLED`, retornar à versão
anterior do código e manter as tabelas aditivas para preservar auditoria e compras.
Não executar `DROP TABLE` como rollback. Se houver divergência de dados, restaurar
o backup em outra base e reconciliar com os registros do provedor antes de reabrir.
As transações de pagamento e chaves únicas impedem duplicidade na repetição de
eventos. Nenhuma migração foi aplicada nesta entrega.

## Pagamento e decisões comerciais

O código anterior configurava `stone_link`, URL vazia e R$ 399,00 no navegador.
Isso não comprova uma integração ativa nem uma condição comercial aprovada. A
migração cria o produto em rascunho, **sem preço** e sem aprovação comercial;
não importa aquele valor. A ativação exige definir `price_cents` no banco protegido,
`commercial_approved=true`, `status=active` e habilitar a variável de vendas.
Não foi inventada duração do acesso. Stone Link permanece uma referência histórica;
não foi escolhido nem cobrado um gateway em nome do usuário.

O adaptador Mercado Pago é preparatório: cria preferência no servidor vinculada
ao usuário autenticado, com produto e valor lidos do banco. Ignora preço, e-mail e
identificador de comprador enviados pelo cliente. O webhook valida HMAC, janela
de tempo, ID, valor exato, BRL, ambiente, conta recebedora, referência e metadados
de produto/usuário/pedido, após consultar o provedor. A função SQL registra versão
do pagamento, bloqueia a linha do pedido, ignora eventos duplicados/antigos e
impede regressão de aprovado para pendente ou de reembolsado para aprovado.
Tentativas do mesmo checkout podem ter IDs de pagamento diferentes antes da
aprovação, desde que todos os vínculos e valores sejam novamente validados no
provedor. Um pedido já aprovado, reembolsado ou contestado mantém seu pagamento
vinculado. Versões com mesmo instante podem avançar de pendente a aprovado ou
de aprovado a reembolsado; regressões continuam bloqueadas.

`test` e `production` são separados na matrícula e nas consultas da API. Ainda
assim, use projetos, contas e credenciais distintos. O pedido de teste nunca deve
ser usado como evidência de compra real. Nenhum botão de simulação altera as
tabelas reais. A página de sucesso só consulta o pedido próprio.

Reembolso/contestação têm o estado real registrado. Com a configuração padrão
`review`, a matrícula preexistente é preservada e o pedido fica marcado para
revisão, sem criar uma regra comercial de revogação. Antes de abrir vendas, o
responsável deve definir `revoke` ou `preserve` e validar o comportamento em teste.
Não há reprocessamento automático de casos em revisão nesta etapa.

## Evidências e limites

`node tests/backend_security_test.js` cobre autorização, e-mail confirmado,
cookie, sessão forjada/expirada/revogada (inclusive `getUser` ainda aceitando o token
com a sessão Auth já removida), logout, CSRF por origem, limites de
tentativas, isolamento de conta/ambiente, vídeo ausente, assinatura de webhook,
substituição de identificadores, incompatibilidade de pagamento e diagnóstico.
São testes do handler com respostas externas controladas. Asserções SQL verificam
restrições críticas no arquivo; não substituem execução em Postgres real.
`npm run typecheck` executa TypeScript com `checkJs` e `noEmit` sobre
`backend/server/api.js` usando `jsconfig.json`; contratos JSDoc cobrem pagamentos,
pedidos, identidade, perfis, matrículas, diagnóstico e requisições HTTP. A validação
não inclui todo o JavaScript legado de demonstração.

Não foram executados cadastro/e-mail/SMTP reais, revogação no Supabase de produção,
RLS em banco vivo, concorrência de RPC em Postgres, uploads/reprodução de vídeos
privados reais, teste de sandbox Mercado Pago, HTTPS da hospedagem ou sessões
entre réplicas. Faltam conexões autorizadas, contas de teste, conteúdo e decisões
comerciais para essas verificações. Antes da publicação são obrigatórios esses
ensaios e revisão do comportamento de metadados do pagamento no sandbox.

Referências oficiais consultadas:
- [Supabase: consulta autenticada do usuário](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase: confirmação por token de uso único](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [Supabase: atributos e confirmação do usuário](https://supabase.com/docs/guides/auth/users)
- [Supabase: sessões, revogação e limites de duração](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Auth: definição oficial do campo not_after](https://github.com/supabase/auth/blob/master/migrations/20221114143122_add_session_not_after_column.up.sql)
- [Mercado Pago: assinatura e consulta de notificações](https://www.mercadopago.com.br/developers/pt/docs/links-and-debts/additional-content/your-integrations/notifications/webhooks)
- [Supabase Storage: API de informações de objetos](https://supabase.github.io/storage/)
- [Supabase Storage: arquivos privados e validade das URLs assinadas](https://supabase.com/docs/guides/storage/serving/downloads)
