# Backend seguro do RV 30 — implementação revisável

> Complemento de 07/11: a entrega aos compradores agora tem adaptador R2 com
> assinatura temporária, conferência do arquivo e vínculo obrigatório ao pedido
> aprovado. Seguir [o roteiro de próximas compras](../docs/COMPRAS_FUTURAS_RV30_20261107.md)
> e aplicar também a migração R2 proposta após as outras duas em staging.
> A área privada de revisão não concede matrículas a compradores.

Atualizado em 07/11/2026 para o adaptador **Asaas e acesso de 365 dias**.
O contrato preparado, a expiração e os testes SQL estão detalhados em
[ASAAS_ACCESS365.md](ASAAS_ACCESS365.md). A prioridade do proprietário é menor
taxa, sem antecipação. A API continua sem implantação real.

Esta etapa acrescenta uma API Node em `backend/server/api.js` e uma migração
**proposta e não executada** em `backend/migrations/20261025_rv30_secure_foundation.sql`.
As auditorias do preview não encontraram configuração utilizável de Supabase;
o e-mail administrativo já foi definido na hospedagem. Não houve leitura de dados
de clientes nem publicação em produção. O esquema anterior `rv_course_*` é histórico e permanece
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
| `PAYMENT_PROVIDER=asaas` | Adaptador Asaas preparado; conta e homologação pendentes |
| `PAYMENT_ENVIRONMENT=test` | `test` ou `production`; usar projetos separados |
| `ASAAS_API_KEY` | Chave específica do ambiente, somente no servidor |
| `ASAAS_ACCOUNT_ID` | Conta conferida em cada notificação |
| `ASAAS_WEBHOOK_TOKEN` | Segredo independente para autenticar as notificações |
| `ASAAS_WEBHOOK_UTC_OFFSET` | Fuso confirmado na homologação para eventos sem timezone |
| `ASAAS_INTEGRATION_VERIFIED=false` | Bloqueio até concluir a homologação |
| `RV30_SALES_ENABLED=false` | Compra bloqueada por padrão |
| `RV30_REFUND_ACCESS_POLICY=revoke` | Reembolso e contestação confirmados revogam o acesso |
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

Respostas de dados usam JSON e `Cache-Control: no-store`; a rota de checkout usa
303 e URL validada. Mutações normais exigem
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
| `GET /api/courses/rv30/days/:day/video` | Acesso vigente; TTL solicitado de até 120 segundos, limitado ao prazo restante |
| `PUT /api/courses/rv30/progress/:day` | `{complete:boolean}`; somente aula publicada da própria conta |
| `POST /api/orders` | `{productId:'rv30'}`, `Idempotency-Key` aleatório de 16+ caracteres |
| `GET /api/orders/:id` | Somente dono autenticado; retorno não confirma pagamento |
| `GET /api/orders/:id/checkout` | Somente dono; redirecionamento 303 validado no servidor |
| `POST /api/webhooks/asaas` | Token e conta validados; confirmação por consulta autenticada à cobrança atual |
| `GET /api/admin/delivery?orderId=:uuid` | Admin; diagnóstico somente leitura |

O diagnóstico retorna `{result:'correct'|'pending'|'error',reasons,order,product,
account,provider,entitlement,lessons}`. Aulas ausentes e provedor indisponível
produzem pendência. Direito de acesso incompatível produz erro. O botão não altera
pagamento, não cria matrícula e não reprocessa uma compra.
Para cada uma das até 30 aulas publicadas, consulta somente os metadados do objeto
no Storage; um caminho cadastrado sem arquivo acessível não conta como disponível.
`salesEnabled` exige também consulta ao produto ativo e aprovado no banco;
configuração de ambiente sozinha não anuncia vendas disponíveis. Preço e prazo
aprovados (R$ 399/365 dias) podem aparecer mesmo com vendas bloqueadas.
Falha de consulta mantém compras indisponíveis e preserva o acesso ao login.

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
4. Executar a fundação e depois `20261107_rv30_access365.sql` em homologação.
   Conferir que o bucket `rv30-videos` é
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

## Pagamento e condições comerciais

O proprietário confirmou R$ 399,00, 365 dias a partir da aprovação e revogação
em reembolso ou contestação. A sequência de treinos continua tendo 30 dias.
O adaptador atual é Asaas; em 07/11, o proprietário priorizou menor taxa e aceitou
aguardar o recebimento do cartão. A integração permanece
bloqueada e não houve cobrança ou criação de conta em nome do proprietário.

A fundação cria o produto em rascunho. A segunda migração registra as condições
confirmadas, sem ativar o produto nem a flag de vendas. Consultar os detalhes,
limitações e instruções atuais em [ASAAS_ACCESS365.md](ASAAS_ACCESS365.md).

O checkout vincula pedido à identidade autenticada. A notificação é somente uma
indicação para consulta autenticada da cobrança atual, nunca prova financeira
por si só. A transação SQL preserva a data da primeira aprovação, rejeita
regressões e não reativa direitos vencidos ou revogados por um replay.

Teste e produção ficam separados nos pedidos, direitos de acesso e progresso.
A demonstração do navegador não altera tabelas reais. A página de sucesso não
libera o programa. Não houve migração remota, pagamento real ou validação de
e-mail/Storage no Supabase. A publicação aguarda a plataforma completa, por
escolha expressa do proprietário.
