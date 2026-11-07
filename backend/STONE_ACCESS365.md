# Stone e acesso de 365 dias — revisão de 07/11/2026

> Registro da alternativa preparada antes da preferência por menor taxa e sem
> antecipação. O adaptador Stone permanece isolado e testado, mas não é usado pela
> API atual. As instruções vigentes estão em [ASAAS_ACCESS365.md](ASAAS_ACCESS365.md).
> Não executar este roteiro como configuração atual do RV 30.

Regras confirmadas pelo proprietário: **Stone, R$ 399,00, 365 dias a partir da
aprovação do pagamento; vencimento, reembolso ou contestação encerram o acesso
ao programa.** A conta, os pedidos e o histórico são preservados.

## Implementação e limites

O adaptador `server/stone.js` prepara a API digital Pagar.me v5 da Stone. Uma
chave genérica `STONE_API_KEY`, uma conta bancária Stone ou um link avulso do
aplicativo não comprovam que esse contrato esteja habilitado. A confirmação do
tipo de conta foi solicitada; a integração real continua pendente.

O cliente envia apenas `productId` e uma chave de idempotência. O servidor exige
produto ativo, aprovação comercial, provedor Stone, BRL 39900 e prazo 365 no banco.
Preço e identidade recebidos do navegador não determinam o pedido. Uma conta com
acesso ainda ativo não inicia outra compra do mesmo programa.

O pedido é único por usuário, ambiente e chave de idempotência. A função protegida
`rv30_claim_checkout` reserva a criação de um único link. Se a resposta da Stone
for incerta ou houver falha ao persistir o link, não se cria outro automaticamente:
o pedido precisa de conciliação com o provedor. Não foi presumido suporte a um
header de idempotência não documentado para `/paymentlinks`.

Cada link usa `type: order`, o código do pedido, o código da conta compradora e
limite de uma sessão/pagamento. O exemplo preparado usa cartão em uma parcela,
sem acrescentar cobrança recorrente, taxas ou uma promessa de parcelamento.
Outros meios precisam de habilitação e homologação explícitas antes de aparecerem.
O navegador recebe `/api/orders/:id/checkout`; o servidor confere dono, ambiente,
estado e URL antes de responder 303 ao host oficial `payment-link.pagar.me`.

## Confirmação do pagamento

`POST /api/webhooks/stone` usa a notificação apenas como indicação de qual recurso
consultar. O corpo, seu status, valor e e-mail não são prova de pagamento.
O servidor consulta `GET /orders/:id` ou `GET /charges/:id` pela API autenticada
com a chave da própria loja. Não usa um HMAC antigo de outra versão e não presume
um endpoint de inspeção de hooks não demonstrado na documentação atual.

Antes de chamar a transação SQL, confere o código local do pedido, produto,
valor, moeda, código do comprador e pagamento já vinculado. O ambiente vem da
configuração e da chave específica de teste/produção. Aprovação exige uma cobrança
paga pelo valor integral e o instante `paid_at`. Reembolso/chargeback da cobrança
prevalecem sobre um estado antigo de pedido pago. Erros externos são sanitizados.

O webhook não requer `Origin`, pois chega do provedor; as outras mutações exigem
origem exata e sessão. `account.id` e a sintaxe da notificação são verificações de
formato/correlação, não autenticação do remetente. A evidência financeira é a
consulta autenticada do recurso atual no provedor. Notificações falsas ou repetidas
não permitem inventar uma aprovação ou revogação.

## Migrações e expiração

Executar somente após inventário, backup/restauração e revisão em homologação:

1. `20261025_rv30_secure_foundation.sql`.
2. O esboço de migração Stone desta etapa foi substituído pela migração Asaas
   `20261107_rv30_access365.sql`. Ela não habilita o adaptador Stone.

Nenhuma foi aplicada ao Supabase nesta sessão. A segunda registra preço e prazo
aprovados, mantendo produto em rascunho quando assim estiver e vendas desativadas.
Preserva o provedor dos pedidos históricos. Não adivinha datas de pagamentos antigos:
aprovações sem data confiável ficam para conciliação e não geram acesso indefinido.

O vencimento é `approved_at + 8760 horas` (365 × 24 horas), com data da primeira
aprovação confirmada. Um webhook repetido não estende o prazo. Uma aprovação antiga
não substitui uma compra posterior. Reembolso/contestação revogam o vínculo do
pedido correspondente; parâmetros antigos `review`/`preserve` não contornam essa
regra. Eventos antigos não reativam direitos revogados ou vencidos.

Toda leitura de aulas, vídeo e gravação de progresso exige direito ativo e
`expires_at > agora`, inclusive antes de uma limpeza agendada. A manutenção
`rv30_expire_access` muda o estado sem apagar registros. A URL assinada de vídeo
solicita no máximo 120 segundos e limita esse TTL ao prazo restante. Uma URL já
emitida e conteúdo já carregado têm limites próprios: esta solução não é DRM nem
retira cópias ou bytes já entregues após um reembolso.

## Configuração protegida

| Variável | Uso |
| --- | --- |
| `PAYMENT_PROVIDER=stone` | Provedor escolhido |
| `PAYMENT_ENVIRONMENT=test` | Sandbox inicialmente; separar contas e banco de produção |
| `STONE_GATEWAY=stone_pagarme_v5` | Contrato digital específico, sem presumir equivalência com outras APIs Stone |
| `STONE_PAGARME_SECRET_KEY` | Chave específica do ambiente, somente no servidor |
| `STONE_PAGARME_ACCOUNT_ID` | Identificador da loja esperada |
| `STONE_INTEGRATION_VERIFIED=false` | Manter fechado até conferir contrato/credenciais; habilitação controlada em homologação |
| `RV30_SALES_ENABLED=false` | Vendas bloqueadas enquanto o fluxo completo não estiver homologado |
| `RV30_REFUND_ACCESS_POLICY=revoke` | Regra confirmada; a transação SQL sempre revoga reembolso/chargeback |

O processo Node ainda precisa ser hospedado: o deploy estático Vercel/Cloudflare
não executa a API. Antes de funções serverless ou múltiplas réplicas, substituir
sessões/limites em memória por mecanismo compartilhado. Não basta publicar o
handler atual como função e declarar login validado.

## Evidências

- 36 testes do handler cobrem autorização, sessão, separação de ambientes,
  expiração, TTL solicitado, criação única e redirecionamento protegido.
- 8 contratos do adaptador Stone usam respostas simuladas. Não comprovam cobrança
  de sandbox, configuração da conta ou entrega de uma notificação real.
- 10 contratos SQL executam as duas migrações integrais em PostgreSQL via PGlite:
  reexecução, isolamento RLS, Storage privado, transação, prazo, repetição e revogação.
  Auth/Storage são schemas mínimos de teste; não é o Supabase do cliente. PGlite
  tem uma conexão exclusiva; não foi alegado teste de corrida entre conexões.
- A página, o checkout e os termos explicam 30 dias de treinos e 365 dias de acesso.

Fontes primárias conferidas: [criação do link](https://docs.pagar.me/reference/criar-link),
[checkout e URL oficial](https://docs.pagar.me/reference/checkout-response),
[formato das notificações](https://docs.pagar.me/reference/vis%C3%A3o-geral-sobre-webhooks),
[modelos do SDK oficial](https://github.com/pagarme/pagarme-nodejs-sdk),
[PGlite](https://pglite.dev/docs/).
