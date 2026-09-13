# Kiwify → RV Cursos: plano de integração

## Objetivo
Usar a Kiwify como checkout e manter a **área de membros externa** no portal RV. A documentação da Kiwify informa que, nessa modalidade, a Kiwify processa o pagamento e pode enviar o evento de compra aprovada via webhook para que a área externa entregue o acesso.

Referências oficiais consultadas em 09/09/2026:
- https://ajuda.kiwify.com.br/pt-br/article/como-cadastrar-o-seu-produto-1lxh5g7/
- https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/
- https://ajuda.kiwify.com.br/pt-br/article/como-funciona-a-api-da-kiwify-1iosjhu/

## Eventos mínimos para um produto de pagamento único
1. **Compra aprovada** → registrar/atualizar compra e liberar matrícula.
2. **Reembolso** → revogar a matrícula vinculada à compra.
3. **Chargeback** → revogar a matrícula e registrar o motivo/status.

Se o produto virar assinatura no futuro, adicionar renovação/cancelamento/atraso conforme o modelo comercial real.

## Regra de segurança principal
O navegador nunca deve liberar um curso porque recebeu `?pagamento=aprovado` ou porque o usuário clicou em um botão. A liberação precisa acontecer no backend depois que o evento recebido do provedor for validado.

## Fluxo recomendado

```text
Landing RV
  ↓
Checkout Kiwify
  ↓
Pagamento aprovado
  ↓
Webhook Kiwify → função server-side
  ↓
Idempotência por provider_event_id / provider_order_id
  ↓
rv_course_purchases = approved
  ↓
Usuário existe?
  ├─ sim → upsert rv_course_enrollments = active
  └─ não → compra fica aguardando vínculo de conta / convite seguro
  ↓
Aluno entra no portal
  ↓
Backend/RLS confirma matrícula ativa
  ↓
Conteúdo RV 30 liberado
```

## Idempotência
Webhooks podem ser reenviados. O endpoint deve aceitar o mesmo evento mais de uma vez sem criar compras ou matrículas duplicadas. O esquema proposto usa chaves únicas para evento e pedido do provedor.

## Payload e autenticação
Não foi fixado neste pacote nenhum nome de header, campo ou algoritmo de assinatura da Kiwify que não tenha sido confirmado na documentação técnica específica da conta. Ao conectar o produto real:

1. abrir a documentação atual dos webhooks;
2. confirmar o mecanismo de autenticação/validação disponibilizado;
3. mapear os campos reais de evento, pedido, produto, comprador, valor e status;
4. salvar apenas os dados necessários;
5. nunca logar segredos, tokens ou dados financeiros sensíveis.

## Reembolso/chargeback
O backend deve localizar a compra por `provider + provider_order_id`, mudar o status e revogar a matrícula correspondente. O painel admin deve continuar mostrando o histórico da compra mesmo depois da revogação.

## Administração
O painel da V6 já representa as operações desejadas. Na integração real, trocar o `localStorage` por consultas server-side/Supabase para:
- listar alunos;
- filtrar status/progresso;
- bloquear/desbloquear conta;
- conceder/revogar matrícula;
- ajustar progresso quando necessário;
- tratar comentários;
- registrar observações internas;
- auditar ações.
