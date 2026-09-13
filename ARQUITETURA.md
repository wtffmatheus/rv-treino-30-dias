# Arquitetura — RV Cursos / RV 30 — V6

## Escopo atual

A V6 mantém o **painel administrativo específico do RV 30**.

O futuro dashboard consolidado dos 3 projetos foi deliberadamente deixado para uma etapa posterior. Nesta versão, apenas a camada de dados e contratos foi preparada para que essa consolidação seja possível sem reescrever tudo.

## Hoje — protótipo/teste

```text
Landing
  ↓
Checkout próprio / provider configurável
  ↓
Pedido aprovado em armazenamento local
  ↓
Criação de conta
  ↓
Login
  ↓
Matrícula/entitlement
  ↓
Área do aluno
  ↓
Progresso + dúvidas
  ↓
Painel admin RV 30
```

O armazenamento em `localStorage` existe somente para validar interface e regras de fluxo.

## Produção recomendada

```text
Landing
  ↓
Gateway de pagamento
  ├── MVP: Stone Link + validação manual
  └── Automação: Mercado Pago/API + webhook
  ↓
Webhook autenticado
  ↓
Backend
  ├── Auth
  ├── Compras
  ├── Matrículas
  ├── Conteúdo
  ├── Progresso
  ├── Comentários
  └── Auditoria
  ↓
Supabase/Postgres
```

## Entidades

- `rv_course_profiles`
- `rv_courses`
- `rv_course_lessons`
- `rv_course_purchases`
- `rv_course_enrollments`
- `rv_course_progress`
- `rv_course_comments`
- `rv_course_admin_notes`
- `rv_course_audit_events`

## Decisão V6: curso não é sinônimo de 30 dias

O curso possui `total_days`.

O RV 30 usa 30 dias, mas a camada de dados pode receber futuramente cursos com outra duração.

Isso evita que o futuro dashboard dos 3 projetos dependa de regras codificadas especificamente para o RV 30.

## Regra de acesso

Um usuário só deve conseguir abrir conteúdo de um curso quando:
- perfil estiver ativo;
- matrícula estiver ativa;
- aula estiver publicada.

No protótipo isso é simulado pela store local. No schema Supabase a regra é representada por RLS/helpers.

## Compra → matrícula

Em produção:
- frontend nunca decide sozinho que a compra foi aprovada;
- webhook/backend confirma o pagamento;
- compra é vinculada ao usuário;
- matrícula é criada/ativada;
- só depois o acesso é concedido.

O schema V6 inclui validação para impedir uma matrícula de usar:
- compra inexistente;
- compra de outro curso;
- compra não aprovada;
- compra de outro usuário.

## Admin

No protótipo:
- sessão admin é separada;
- todos os métodos administrativos validam a sessão;
- senhas não aparecem em snapshots administrativos;
- operações são auditadas.

Na produção:
- função administrativa deve ser determinada server-side;
- mutações sensíveis devem ocorrer por função/RPC/backend protegido;
- `service_role` nunca deve chegar ao browser.

## Futuro dashboard dos 3 projetos

Estrutura recomendada para a próxima etapa:

```text
Dashboard geral
├── Projeto 1 / RV 30
├── Projeto 2
└── Projeto 3
```

O dashboard geral poderá somar:
- alunos ativos;
- compras;
- receita;
- progresso médio;
- retenção;
- dúvidas;
- inatividade;
- distribuição por projeto.

Essa camada não foi criada agora, conforme escopo solicitado.
