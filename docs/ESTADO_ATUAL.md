# RV30 — estado atual

Atualizado em 22/11/2026 (branch `feat/rv30-auth-cursos-20261122`). Este é o documento de referência do projeto. Relatórios datados ficam em [`archive/`](archive/) e não descrevem o estado atual.

## Infraestrutura em uso

| Peça | O que é | Fonte |
| --- | --- | --- |
| Domínio oficial | `treino.rvfisiologista.com.br`, servido pelo projeto Vercel `rv-treino-30-dias` | Vercel |
| API do domínio | `/api/*` é reescrito para o Worker `rv30-platform-staging` | `vercel.json` |
| Identidade, matrículas e progresso | D1 `rv30-platform-staging` (`83d1c103…`) | `wrangler.platform.jsonc` |
| Vídeos | R2 privado `rv30-videos-private`, entregue só com sessão e matrícula a cada requisição | `backend/review/handler.mjs` |
| Revisão privada do responsável | Worker `rv30-revisao` (Cloudflare Access) | `wrangler.review.jsonc` |
| Bancos antigos, fora do domínio | D1 `rv30-qa-access` (conta `aluno@rv.com.br`) e `rv30-premium-preview` | sem uso pelo login oficial |

O Worker se chama “staging” por razões históricas, mas é a fonte de identidade do domínio oficial. Trocar o destino de `/api` sem migrar os usuários repetiria a falha descrita abaixo.

## Senhas que “paravam de funcionar” — causa comprovada

Em 07/11 o `/api` do domínio apontou sucessivamente para três Workers com bancos diferentes: `rv30-qa-access` → `rv30-premium-preview` → `rv30-platform-staging` (commits `384ee32`, `69e4daf`, `8b9993e`). A conta `aluno@rv.com.br` existe somente em `rv30-qa-access`, e a página privada `/conta-teste` continuava gravando a senha dela nesse banco. O login oficial consulta outro banco, onde essa conta não existe, e responde “E-mail ou senha inválidos”. Em 22/11 houve 7 tentativas com esse e-mail no D1 oficial.

Verificado e descartado: seeds, migrações ou inicialização redefinindo senhas (não há código que faça isso fora de operações auditadas); troca de `AUTH_PASSWORD_PEPPER` (logins com hashes antigos continuaram válidos após as alterações de segredos de 10/11); `credential_version` mudando indevidamente (só muda em senha definida, recuperação aceita, bloqueio e papel, sempre auditados, e não altera o hash); `trim` na senha (somente o e-mail é normalizado); login de demonstração (só existe em `localhost`).

Correções: a rota antiga `/api/qa/set-password` da revisão privada responde 410 e explica qual conta usar; os textos das páginas privadas indicam o banco real; matrículas e perfil não tocam credenciais (coberto por teste); recuperação self-service por código.

## Funcionalidades

| Área | Situação |
| --- | --- |
| Login, logout, sessões | Funcionando no domínio |
| “Esqueceu sua senha?” com código de 6 dígitos | Implementado e testado localmente; **envio real depende da ativação do Email Sending** (abaixo) |
| Cadastro de alunos com escolha de cursos e convite por e-mail | Implementado e testado localmente; sem e-mail ativo, a equipe usa o link privado (a equipe nunca vê a senha) |
| Catálogo multi-curso, aulas, matrículas por curso | Implementado (migração aditiva `backend/platform/catalog-schema.sql`) |
| Meus cursos e página `/curso/:id` | Implementado |
| Vendas e pagamentos | Desativados até integração homologada |

### Recuperação por código — regras do servidor

Código de 6 dígitos com `crypto.getRandomValues` e amostragem por rejeição; armazenado só como HMAC-SHA256 com o pepper; validade de 10 minutos; uso único com consumo condicional (corrida concorrente coberta por teste); máximo de 5 tentativas contadas antes da comparação; reenvio após 60 s; limites de 20 pedidos por IP e 5 por e-mail a cada 15 minutos; resposta idêntica para e-mail inexistente; se o provedor falhar, o código é descartado e nenhuma senha muda; senha nova de 12 a 128 caracteres; sessões antigas encerradas só após a troca.

### Envio de e-mail — configuração pendente

O Worker usa o binding `EMAIL` do Cloudflare Email Service (alternativa: segredo `RESEND_API_KEY`). Remetente configurado: `RV Treino 30 Dias <nao-responda@avisos.rvfisiologista.com.br>`. Para ativar:

Teste real em 23/11/2026 00:12 UTC, no domínio oficial: o Worker tentou enviar e o Cloudflare respondeu `E_SENDER_DOMAIN_NOT_CONFIGURED`. O código foi descartado e nenhuma senha mudou. Por isso a variável `EMAIL_DELIVERY_ENABLED` está em `"false"`.

1. No painel Cloudflare (Email → Email Sending), ativar o envio para o subdomínio `avisos.rvfisiologista.com.br`. O painel cria os registros SPF/DKIM desse subdomínio; o SPF `-all` do domínio raiz não muda. O token atual do Wrangler recebe `Unauthorized [2036]` nessa API, então a ativação é feita pelo painel.
2. Em `wrangler.platform.jsonc`, mudar `EMAIL_DELIVERY_ENABLED` para `"true"` e publicar o Worker (`npx wrangler deploy --config wrangler.platform.jsonc`).
3. Em `/entrar`, usar “Esqueceu sua senha?” com uma conta própria e confirmar o recebimento. No D1, o evento `recovery_email_sent` comprova a entrega; `recovery_email_failed` indica nova falha (o código de erro aparece em `wrangler tail`).

Sem isso, `/api/config` informa `recoveryMode: administrative_invite` e a tela explica que a recuperação está em ativação. Nada é simulado.

## Banco de dados

`catalog-schema.sql` só cria tabelas (`courses`, `course_enrollments`, `course_lessons`, `course_progress`, `recovery_codes`) e insere a linha do curso `rv30` se não existir. O RV30 continua em `enrollments`, `lesson_records` e `qa_progress`. Aplicar com backup prévio (`wrangler d1 export`) e antes de publicar o Worker.

## Comandos

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` (use `BASE_URL` com servidor próprio quando houver outra sessão na porta 8081), `npx playwright test --config playwright.real.config.js`, `npm run check:platform`, `npm run check:review`.

QA visual local: `PORT=8147 RV_STUDIO_QA=1 RV_LOCAL_OUTBOX=1 node scripts/qa-platform-repro-server.js` e depois `node scripts/qa-auth-courses-shots.js all` ou `QA_OUT_DIR=… QA_PLATFORM_URL=http://127.0.0.1:8147 QA_DEMO_URL=… node scripts/qa-redesign-completo.js` (11 larguras). Cada execução grava em pasta própria em `output/`, sem apagar as anteriores.

## Documentação

| Pasta | Conteúdo |
| --- | --- |
| [`architecture/`](architecture/) | Arquitetura, plano da plataforma integral, contrato da API, segurança |
| [`design/`](design/) | Sistema visual azul-petróleo e checkpoints do redesign; `referencias/` guarda o briefing |
| [`testing/`](testing/) | Validação e contas de teste |
| [`deployment/`](deployment/) | Checklists de produção e publicação |
| [`media/`](media/) | Vídeos privados, upload e reprodução |
| [`payments/`](payments/) | Provedores de pagamento (todos desativados) |
| [`archive/`](archive/) | Relatórios datados e o README anterior |
