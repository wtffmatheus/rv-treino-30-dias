# Revisão independente da base segura — 25/10/2026

Escopo: `backend/server/api.js`, a proposta `backend/migrations/20261025_rv30_secure_foundation.sql` e os testes automatizados. Revisão feita por um agente diferente do responsável pela implementação do backend. Nenhuma base real, conta real ou cobrança foi alterada.

Problemas encontrados e corrigidos durante a revisão:

1. **Armazenamento privado com políticas antigas permissivas.** Apenas marcar o bucket como privado não impede uma política abrangente existente de permitir leitura. A migração agora inclui políticas restritivas para objetos e configuração do bucket RV 30. O servidor usa a chave de serviço; o aluno recebe somente a URL assinada com validade curta. A necessidade de combinar permissões e políticas está descrita na [documentação de controle de acesso do Supabase](https://supabase.com/docs/guides/storage/security/access-control).
2. **Cadastro público do endereço administrativo.** O cadastro reserva o endereço configurado em `ADMIN_EMAIL`, com resposta genérica. Essa conta deve ser criada ou convidada por um processo administrativo confiável. Isso evita que uma configuração incorreta de confirmação automática permita reivindicar o endereço no cadastro público.
3. **Novas tentativas de pagamento.** Um identificador de tentativa recusada não pode impedir uma aprovação válida posterior para o mesmo pedido. A validação e a transação permitem substituir a tentativa antes da aprovação, mantendo a conferência de produto, comprador, valor, moeda, lojista e ambiente. Uma tentativa nova não substitui o vínculo de pedido já aprovado, reembolsado ou contestado.
4. **Eventos com o mesmo instante do provedor.** O tratamento de repetição não descarta automaticamente um avanço válido de estado só porque o instante informado é igual. Eventos repetidos usam chave única; regressões e eventos antigos continuam bloqueados.
5. **Reutilização de pedido de teste em produção.** A chave de idempotência, as consultas de pedidos, os direitos de acesso e o progresso incluem o ambiente. Uma compra de teste não é reutilizada no checkout nem na confirmação em produção.

Outros controles conferidos no código e nos testes: conta validada novamente no provedor de identidade; e-mail confirmado; administrador definido exclusivamente no servidor; rejeição de papéis enviados por metadados do usuário; cookie opaco HttpOnly; mutações com conferência de origem; consulta de compra vinculada ao identificador da sessão; webhook autenticado seguido de consulta ao provedor; valor definido no servidor; conferência de entrega sem escrita; bloqueio de vendas por padrão.

Validação executada:

- `node tests/backend_security_test.js`: 28 verificações com serviços simulados passaram na revisão.
- `node tests/backend_review_test.js`: verificações independentes da reserva do endereço administrativo e do isolamento de pedidos por ambiente passaram.
- `node tests/video_mapping_test.js`: regras de numeração e consulta de entrega local sem escrita passaram.

**Limites desta evidência:** a migração não foi executada em PostgreSQL/Supabase. As verificações de SQL nos testes são estáticas; não comprovam as políticas em um banco real. A assinatura de webhook foi testada com HMAC fictício e respostas simuladas do provedor; não houve pagamento de teste no Mercado Pago. A integração real exige homologação com duas contas distintas, sessões revogadas, tentativa direta às tabelas e ao armazenamento, eventos repetidos/fora de ordem e um objeto de vídeo privado autorizado. A confirmação do pagamento deve usar o [endpoint autenticado do Mercado Pago](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview), conforme preparado no código.

Antes de publicar, revisar também o proxy HTTPS, a configuração de confirmação de e-mail, os templates de confirmação/recuperação, a política comercial e o procedimento de backup e restauração. O código não aplica a migração automaticamente.
