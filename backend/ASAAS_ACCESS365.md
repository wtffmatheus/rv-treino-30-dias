# Asaas e acesso de 365 dias — 07/11/2026

O proprietário priorizou menor taxa e pode aguardar o recebimento do cartão.
O adaptador principal preparado é Asaas. Isso não cria conta financeira, aceita
contrato nem comprova a taxa individual que o provedor oferecerá. Conferir a
proposta da conta antes da ativação. A integração real ainda não foi homologada.

## Condições e fluxo

- Compra única de R$ 399,00 em BRL, via Pix ou cartão no checkout hospedado.
- 365 dias contados da primeira aprovação confirmada, sem assinatura ou renovação.
- Ao vencer, o programa fica indisponível; conta, pedidos e histórico permanecem.
- Reembolso confirmado, inclusive parcial, ou contestação retiram o acesso.
- Nenhum cartão é recebido ou armazenado pelo portal. Não se pede antecipação.

O servidor exige produto ativo e aprovado, preço, prazo e provedor corretos no
banco. A configuração pública pode informar preço e prazo com vendas bloqueadas.
O navegador envia somente produto e chave de idempotência; a identidade vem da
sessão validada. Quem já tem acesso vigente não inicia outra compra do programa.

A RPC `rv30_claim_checkout` reserva a criação uma única vez. Se a chamada externa
ou a persistência de sua resposta falhar de forma incerta, o pedido permanece em
conferência; um retry não cria outro checkout. Não se presume idempotência externa
não documentada. O índice único por provedor, ambiente e checkout impede associar
o mesmo checkout a dois pedidos.

O redirecionamento passa por rota de pedido pertencente ao aluno. O servidor
aceita somente HTTPS, host exato do ambiente e caminho documentado com o ID
armazenado. Página de sucesso e campos enviados pelo cliente não liberam acesso.

## Notificações e data de aprovação

Configurar `POST /api/webhooks/asaas`, incluindo eventos de confirmação,
recebimento, reembolso e contestação. O servidor compara o header
`asaas-access-token` em tempo constante e confere a conta. Depois consulta a
cobrança pela API autenticada. Eventos de checkout precisam identificar uma única
cobrança. Conferem-se checkout, pedido, valor bruto, método, produto e ambiente.
Os dados financeiros enviados no corpo da notificação não substituem essa consulta.

`PAYMENT_CONFIRMED` pode liberar o acesso antes da liquidação do cartão.
`PAYMENT_RECEIVED` não deve iniciar outro ano quando o saldo é disponibilizado.
A primeira aprovação usa a data do evento financeiro autenticado, compatível com
o dia de confirmação informado pela cobrança. Preserva-se `approved_at` existente.
Eventos sem timezone exigem um `ASAAS_WEBHOOK_UTC_OFFSET` confirmado na sandbox.
Não presumir esse fuso pela localização do cliente ou do servidor.

Se apenas um evento tardio de liquidação chegar e não houver data original
comprovada, a liberação fica pendente de conciliação. A API atual não oferece uma
rotina administrativa de conciliação: esse procedimento ainda precisa ser
homologado antes de vender. Nunca inventar uma data para conceder mais 365 dias.
Versões observadas usam o horário da consulta autenticada; eventos têm chave
idempotente e as regras SQL impedem regressões, extensão por replay e reativação
de acesso revogado. A expiração é conferida em cada pedido de conta, aula,
progresso e vídeo, mesmo sem executar a rotina periódica de expiração.

## Homologação pendente

1. Criar ou confirmar a conta Asaas e sua proposta comercial, sem antecipação.
2. Usar conta sandbox separada. Configurar as variáveis de `.env.example`
   diretamente no ambiente protegido. Não colocar chaves no chat, Git ou frontend.
3. Revisar backup e esquema existente do Supabase; aplicar em staging a fundação
   `20261025_rv30_secure_foundation.sql` e depois `20261107_rv30_access365.sql`.
   Essas migrações ainda não foram executadas remotamente. Produto fica em rascunho.
4. Hospedar a API: `dist/` é estático e não inclui `/api`. A implementação atual
   requer um processo Node persistente. Antes de Functions ou múltiplas instâncias,
   substituir sessões e limites em memória por armazenamento compartilhado.
5. Cadastrar webhook e conferir conta, token, formato do timestamp e fuso com eventos
   reais de sandbox. Validar Pix, cartão, estados pendentes, confirmação antes da
   liquidação, repetição, atraso, reembolso, contestação e conciliação.
6. Verificar e-mails, sessões, isolamento entre dois alunos, 30 vídeos privados,
   expiração e diagnóstico administrativo na infraestrutura real.
7. Somente após homologação e autorização explícita, configurar produção, ativar
   produto e vendas e publicar. O proprietário pediu aguardar a plataforma completa.

Os testes locais usam respostas simuladas. O teste SQL executa as duas migrações
completas em PostgreSQL via PGlite, com fixtures de Auth e Storage. Não comprova
integração Supabase, concorrência entre conexões, entrega de e-mail ou pagamento real.

## Referências oficiais consultadas

- [Taxas Asaas](https://www.asaas.com/precos-e-taxas): comparar condições padrão,
  promoções temporárias, parcelamento e eventual antecipação na proposta da conta.
- [Criar checkout](https://docs.asaas.com/reference/criar-novo-checkout).
- [FAQ checkout](https://docs.asaas.com/docs/faq-do-asaas-checkout).
- [Eventos de checkout](https://docs.asaas.com/docs/eventos-para-checkout).
- [Consulta da cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca).
- [Eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas).
- [Sandbox](https://docs.asaas.com/docs/sandbox).
