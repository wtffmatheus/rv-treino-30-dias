# Mercado Pago — decisão e critérios de homologação

Decisão do proprietário em 08/11/2026: usar Mercado Pago. Substitui a escolha
anterior de Asaas e Stone para novas compras. Preço aprovado: R$ 399,00;
acesso por 365 dias desde a confirmação do pagamento, com encerramento automático.
Reembolso ou contestação confirmados removem o acesso.

Estado: PENDENTE. O proprietário informou que ainda precisa criar/configurar
a aplicação. Não há credenciais de teste conectadas, checkout Mercado Pago
implementado no Worker ativo ou transação homologada. A troca dos textos e da
configuração pública não habilita pagamentos. As rotas financeiras continuam 503.
Os adaptadores legados Asaas/Stone e seus testes ficam preservados como histórico;
não atendem a API D1 atual nem comprovam integração com Mercado Pago.

Antes de implementar a comunicação real, criar a aplicação no painel oficial,
identificar o produto/API habilitado e configurar credenciais de teste e segredo
de Webhooks diretamente no ambiente protegido, nunca em chat, Git ou screenshot.
Não instalar outro gateway, contratar serviço ou fazer cobrança para contornar
essa dependência. A configuração comercial não pode reutilizar compradores de teste.

Critérios obrigatórios para a integração:

- Pedido criado no servidor para uma identidade verificada; valor, moeda e
  referência imutáveis, sem aceitar confirmação do navegador ou página de retorno.
- Checkout hospedado no Mercado Pago, com destino validado, vinculado ao pedido
  e idempotência. Nenhum dado de cartão passa por formulário ou log do RV 30.
- Webhook com validação de assinatura e posterior consulta autenticada do recurso
  na API oficial. Conferir aplicação/vendedor, ambiente, referência, moeda e valor.
- Eventos repetidos ou fora de ordem não podem duplicar matrícula, renovar os
  365 dias ou restaurar acesso revogado por contestação. Persistência atômica de
  pedido, matrícula e auditoria; prever reconciliação e retentativas verificáveis.
- Testar aprovação, pendência, recusa, cancelamento, reembolso, contestação,
  assinatura inválida, referência alheia, duplicação e falha de entrega. Os cenários
  reais em teste devem ser separados dos contratos locais com fixtures.
- Entrega automática e recuperação de identidade precisam de canal homologado.
  Não abrir vendas antes de pagamento, identidade, matrícula e mídia funcionarem
  juntos na prévia exata. Cobranças reais exigem autorização específica.

Documentação oficial consultada em 08/11/2026:

- [Webhooks e assinatura](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Consulta de estado do pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/response-handling/query-results)

A documentação apresenta produtos distintos, inclusive Checkout Pro com Orders.
A implementação deverá seguir o produto efetivamente configurado na aplicação;
não misturar contratos de APIs ou supor que um retorno visual aprova o pagamento.
