# Suporte: estado atual e contrato de producao

Frontend: `suporte.html`, `assets/js/support.js`. Store atual: `auth-demo.js`.
Rotas `/suporte` e `/admin/suporte`. Parametro `perfil=admin` seleciona a tela,
mas nao concede permissao: todos os metodos administrativos verificam a sessao.

## Demonstracao entregue

Conversa por aluno, assunto, curso opcional, historico, busca, filtros, indicador
de novas mensagens, respostas da equipe e encerramento. Nova mensagem reabre o chamado.
Mensagens limitadas a 2.000 caracteres e renderizadas como texto, nunca HTML.
Sessao expirada/bloqueada falha fechada. Nao ha anexos, notificacoes por email ou SLA prometido.
O chat atual NAO e remoto: sincroniza somente abas da mesma origem via storage event.
O localStorage e manipulavel, portanto esses guards nao equivalem a seguranca server-side.

## Proposta SQL, ainda nao aplicada

`support-schema.sql` acrescenta threads, mensagens e recibos ao schema independente
dos cursos. Nao aplicar ao RV App. Nao foi executado contra Postgres nesta entrega.
Clientes autenticados tem SELECT limitado por RLS; escrita direta e revogada.
Identidade/papel/status/datas sao derivados no servidor, nao do formulario.

| Operacao | RPC/consulta prevista |
| --- | --- |
| Listar conversas | SELECT rv_support_threads sob RLS, ordenado por updated_at, paginado |
| Ler historico | SELECT rv_support_messages sob RLS, por thread_id, paginado |
| Criar/responder | rv_support_send(threadId ou null, body, UUID de idempotencia, subject, courseId) |
| Registrar leitura | rv_support_mark_read(threadId) |
| Resolver | rv_support_resolve(threadId), somente admin |

O envio proposto e transacional, com UUID por mensagem para evitar duplicacao em retry,
limite de 10 mensagens/minuto por usuario e bloqueio serializado do perfil.
Nenhum service_role no frontend. Na integracao futura, usar sessao Supabase propria,
adaptador assincrono e erros de dominio traduzidos; nao expor erros SQL ao aluno.
Realtime opcional depois de validar RLS, reconexao e paginacao; nao ativado agora.

## Testes obrigatorios antes de conectar

- Postgres: permitir leitura propria/admin; negar anon, outro aluno e perfil bloqueado.
- Negar INSERT/UPDATE direto, falsificacao de sender_role e alteracao de proprietario.
- RPC: negar chamada anonima, curso sem entitlement e conversa de outra conta.
- Concorrencia: deduplicar retry, rejeitar mesmo UUID com payload diferente e aplicar rate limit.
- Revalidar sessao revogada no backend para a politica de logout escolhida.
- Integracao: conversar entre aparelhos diferentes; renovar/expirar sessao; enviar offline sem perda silenciosa.
- Privacidade: definir retencao, exclusao e responsaveis autorizados.

Referencia tecnica: [RLS e grants do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
