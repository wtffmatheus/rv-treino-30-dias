# Checklist para sair do modo demo — V6

## Infraestrutura
- [ ] Criar projeto/ambiente de produção e staging.
- [ ] Revisar `backend/supabase-schema.sql` antes de executar.
- [ ] Aplicar tabelas, índices, triggers e RLS em staging.
- [ ] Criar administradores reais por processo controlado.
- [ ] Implementar adaptador real `RVCourseStore`.
- [ ] Remover/deixar inacessível o fluxo de credenciais demo em produção.

## Pagamento
- [ ] Criar/confirmar produto/oferta correta no provider escolhido.
- [ ] Para MVP Stone Link: inserir URL real e definir processo de validação manual.
- [ ] Para automação: confirmar Mercado Pago Checkout Pro/API ou gateway equivalente.
- [ ] Criar endpoint server-side de webhook.
- [ ] Confirmar autenticação/validação do webhook na documentação vigente do gateway.
- [ ] Implementar idempotência.
- [ ] Tratar pagamento aprovado/paid.
- [ ] Tratar reembolso.
- [ ] Tratar cancelamento, falha e chargeback quando o gateway informar.
- [ ] Testar reenvio/retry do evento.

## Contas e acesso
- [ ] Implementar Supabase Auth/provedor escolhido.
- [ ] Implementar vínculo seguro de compra por e-mail/identificador.
- [ ] Implementar convite/primeiro acesso.
- [ ] Implementar recuperação de senha.
- [ ] Garantir que matrícula revogada bloqueie curso imediatamente.
- [ ] Garantir que conta bloqueada perca acesso/sessão útil.

## Admin RV 30
- [ ] Conectar métricas ao backend.
- [ ] Conectar busca/filtros ao backend.
- [ ] Conectar bloqueio e matrícula a endpoints/RPC seguros.
- [ ] Conectar ajuste de progresso.
- [ ] Conectar respostas de suporte/comentários.
- [ ] Conectar notas internas.
- [ ] Conectar histórico comercial.
- [ ] Registrar auditoria server-side.
- [ ] Implementar RBAC real.

## Conteúdo
- [ ] Aprovar Introdução + Dias 1–30 com Rosangela.
- [ ] Inserir URLs finais dos vídeos.
- [ ] Revisar horários/duração/orientações.
- [ ] Definir quais aulas começam publicadas.
- [ ] Testar player no Safari iPhone e Chrome Android.

## Comercial / jurídico
- [ ] Confirmar preço final e parcelamento no checkout.
- [ ] Confirmar comunicação da faixa 6–9 kg ou removê-la.
- [ ] Validar Política de Privacidade.
- [ ] Validar Termos de Uso.
- [ ] Inserir identificação do fornecedor e canal de privacidade.
- [ ] Definir política comercial/cancelamento/reembolso de acordo com a legislação e configuração real do gateway.

## Marketing
- [ ] Definir consentimento/cookies quando aplicável.
- [ ] Inserir Google Analytics real.
- [ ] Inserir Meta Pixel real.
- [ ] Validar `PageView`, `ViewContent`, `InitiateCheckout`, `Purchase`.
- [ ] Validar UTMs da landing até o checkout.

## QA final
- [ ] Rodar todos os testes automatizados.
- [ ] Comprar com transação real de baixo valor.
- [ ] Validar webhook e criação de acesso.
- [ ] Testar reembolso e revogação.
- [ ] Testar Chrome desktop.
- [ ] Testar Safari iPhone.
- [ ] Testar Chrome Android.
- [ ] Testar internet lenta e vídeo.
- [ ] Testar e-mails transacionais.
- [ ] Fazer backup e plano de rollback antes do lançamento.


## QA automatizado V6

Antes de promover qualquer alteração:

```bash
python tests/smoke_test.py
python tests/deep_audit.py
python tests/css_integrity_audit.py
node tests/admin_security_test.js
node tests/data_flow_test.js
python tests/supabase_schema_audit.py
python tests/content_audit.py
python tests/contrast_audit.py
```

A suite deve terminar sem erro.

## Admin — produção

- [ ] role administrativa definida no backend/banco
- [ ] nenhuma credencial administrativa fixa entregue ao browser
- [ ] mutações administrativas protegidas server-side
- [ ] auditoria de ações sensíveis ativa
- [ ] política de expiração/reautenticação definida
- [ ] exportação de dados restrita a usuário autorizado
- [ ] pagamento confirmado cria acesso/entitlement automaticamente pelo backend
