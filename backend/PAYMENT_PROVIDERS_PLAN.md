# Pagamentos — plano de provider para RV Cursos

## Decisão atual

O checkout do portal RV deve ser próprio e contextualizado. O aluno informa nome, e-mail, WhatsApp e aceite dos termos antes de seguir para o gateway.

Provider inicial:
- `stone_link`
- validação manual do pagamento
- liberação manual do acesso enquanto não houver webhook/API adequada

Provider preparado para automação:
- `mercado_pago`
- criação server-side de order/preference
- webhook validado
- consulta server-side do pagamento antes de liberar acesso

## Fluxo MVP com Stone Link

```text
Landing
  ↓
Checkout RV
  ↓
Stone Link
  ↓
Pagamento
  ↓
Validação manual pela RV
  ↓
Admin libera acesso
```

Esse fluxo serve para validar vendas rapidamente, mas não deve ser tratado como automação completa.

## Fluxo automatizado recomendado

```text
Landing
  ↓
Checkout RV
  ↓
Backend cria order
  ↓
Gateway
  ↓
Webhook assinado
  ↓
Backend consulta o gateway
  ↓
Order = paid
  ↓
Entitlement ativo
  ↓
Aluno cria acesso ou recebe curso na conta existente
```

## Regras obrigatórias

- O frontend nunca confirma pagamento.
- Retorno por query string não libera curso.
- `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e segredos Stone ficam apenas no backend.
- Webhook precisa de validação, idempotência e logs sem segredos.
- O acesso ao curso depende de entitlement ativo.

## Variáveis previstas

```text
PUBLIC_SITE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
PAYMENT_PROVIDER=stone_link
PAYMENT_URL=
VITE_ENABLE_PAYMENT_SIMULATION=false

SUPABASE_SERVICE_ROLE_KEY=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
STONE_API_KEY=
STONE_WEBHOOK_SECRET=
```
