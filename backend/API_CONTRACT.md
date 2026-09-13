# Contrato de dados para substituir o modo demo — V6

A interface consome `window.RVCourseStore`. Hoje, em modo de teste, `auth-demo.js` fornece o contrato. O adaptador demo só assume `RVCourseStore` se nenhum adaptador real já existir e falha fechado quando `testMode !== true`.

## Aluno
- `login(email, password)`
- `logout()`
- `isLoggedIn()`
- `account()`
- `hasAccess(courseId)`
- `courseProgressSummary(courseId)`
- `setDayComplete(courseId, day, complete)`
- `comments(courseId, day)`
- `addComment(courseId, day, text)`

## Checkout / acesso

A versão real **não** deve usar `createDemoOrder`/`claimApprovedOrder` como fonte de verdade. O backend recebe a confirmação do provedor, valida o evento, registra a compra e cria/atualiza a matrícula.

## Admin do RV 30

Leituras necessárias:
- listar alunos do curso;
- métricas do curso;
- compras aprovadas aguardando vínculo;
- detalhes/progresso de um aluno;
- dúvidas/comentários por aluno e dia;
- notas internas;
- pedidos;
- auditoria.

Mutações necessárias:
- atualizar nome/telefone/status;
- conceder/revogar matrícula;
- ajustar/reiniciar progresso;
- responder/moderar comentário;
- adicionar nota interna;
- criar/vincular acesso por fluxo seguro.

Operações administrativas sensíveis devem passar por API server-side/RPC controlada; não entregar `service_role` ao navegador.

## Recuperação de senha

O painel real não deve exibir nem armazenar senha do aluno. Recuperação/troca deve usar o provedor de autenticação e fluxo de e-mail seguro.

## Dashboard futuro

O painel atual trabalha com `courseId = 'rv30'`. O futuro dashboard dos três projetos deve ser uma camada agregadora por curso, sem substituir as operações detalhadas do painel RV 30.
