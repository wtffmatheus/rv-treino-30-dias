# Validação do RV 30 — 25/10/2026

> Registro histórico. A revisão de 27/10 executou as seis auditorias Python
> localmente, ampliou a suíte para 40 testes de navegador e confirmou a correção
> do build Cloudflare. A situação atual do domínio e as limitações reais estão em
> [REVISAO_REQUISITOS_RV30_20261027.md](REVISAO_REQUISITOS_RV30_20261027.md).

Ambiente local Windows, Node 24, Chromium e dados exclusivamente fictícios. As APIs externas nos testes de segurança e de interface foram simuladas. Nenhuma cobrança, envio real de e-mail, migração ou alteração em produção foi executada.

| Verificação | Resultado | Alcance da evidência |
| --- | --- | --- |
| `npm test` | Passou | Dez scripts de regras, fluxos locais, isolamento, vídeos e revisão independente; 32 verificações específicas do handler seguro. |
| `npm run lint` / `npm run check` | Passou | Sintaxe JavaScript de cliente/servidor/scripts/testes, referências HTML e allowlist do build. Não utiliza ESLint. |
| `npm run typecheck` | Passou | TypeScript `checkJs`/JSDoc, sem emissão, no novo backend. Não é uma migração do frontend para TypeScript. |
| `npm run build` | Passou | 61 arquivos estáticos em `dist/`. Nenhum backend, segredo, migração ou arquivo de teste no bundle. |
| `npm run test:e2e` | 38 testes passaram | Fluxo demo, interface com API simulada, autorização, checkout, estados de erro, teclado, retratos e capturas. |
| Responsividade | Passou | 11 larguras entre 320 e 1920 px em oito rotas; 88 combinações sem overflow horizontal ou imagens quebradas. |
| Acessibilidade básica | Cinco testes passaram | Atalho de conteúdo, movimento reduzido, menu por teclado, Escape/foco, mensagens anunciáveis, rótulos e alternativas das imagens. Não equivale a auditoria WCAG completa. |
| `tests/content_audit.py` | Passou | Introdução + dias 1–30 estruturados; 31 URLs pendentes e 30 durações finais pendentes. Não comprova existência de vídeos. |
| `tests/css_integrity_audit.py` | Passou com fallback | Verificação simplificada; `tinycss2` não estava instalado localmente. |
| `tests/supabase_schema_audit.py` | Passou | Verificação estática do esquema histórico, sem acesso a PostgreSQL. A nova migração também recebe asserções estáticas nos testes JavaScript. |
| `tests/contrast_audit.py` | Passou | Variáveis textuais do CSS base acima de 4,5:1. Não verifica toda combinação final de cores da interface. |
| `tests/smoke_test.py` / `tests/deep_audit.py` | Pendente localmente | `beautifulsoup4` não instalado. Tentativa de preparar dependências foi interrompida durante a aprovação; nenhum download concluído. CI está configurado para executá-los com as dependências. |
| `npm run audit:launch` | `NO_GO` esperado | Saída 2 bloqueia abertura comercial até comprovação real; código preparado e serviços homologados são estados distintos. |

## Validação remota no GitHub

Os dois jobs de qualidade do commit de código `e293212` concluíram com sucesso:
[push](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/40220696008) e
[pull request](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/40220725938).
Além das verificações JavaScript, o workflow executou as seis auditorias Python
com `beautifulsoup4` e `tinycss2`. Isso resolve a execução dessas duas auditorias
no CI; a limitação de dependências na máquina local permanece registrada acima.

A Vercel concluiu o build e gerou uma prévia protegida por login. O check separado
do Cloudflare Workers falhou e permanece pendente: seu resultado aponta somente
para o painel autenticado, sem disponibilizar os logs nesta sessão. Portanto,
**não são todos os checks de hospedagem que passaram**. Essa pendência não é
tratada como aprovação nem altera o `NO_GO` comercial.

## Principais casos cobertos

- Credenciais inválidas, identidade sem e-mail confirmado, cookie opaco HttpOnly, sessão forjada, expirada, revogada no Auth e sessão removida de `auth.sessions` mesmo com token ainda aceito.
- Cadastro público impedido de reivindicar o e-mail administrativo reservado. Administrador ausente da configuração permanece bloqueado. Papel enviado por metadados, URL ou localStorage não concede autorização.
- Conta sem compra não consulta reprodução; compra de outro aluno é filtrada no servidor. Teste e produção têm identificadores de pedido, direito de acesso e progresso separados.
- Webhook falso, timestamp inválido e divergência entre corpo e query rejeitados. Pagamento incompatível em valor, moeda, produto, comprador, lojista e ambiente rejeitado. Handler usa transação SQL preparada para idempotência e eventos antigos; a concorrência SQL real ainda precisa de teste.
- Retorno à página de sucesso não aprova pedido nem concede acesso. Checkout ignora o valor adulterado no navegador e usa o produto e o preço validados pelo servidor.
- Diagnóstico de entrega somente leitura. Vídeo ausente sem player quebrado; erros de reprodução com mensagem clara. Logout com falha mantém a tela e permite repetir.
- Token de confirmação/recuperação só é enviado após confirmação explícita. Pré-visualização por GET não o consome. Expiração/uso único são respondidos pelo provedor simulado.
- HTML e mensagens não interpretam textos de usuário como marcação. Origens de mutações são conferidas e as tentativas de autenticação recebem limite.

## Capturas e relatórios locais

- `output/qa-previews/`: landing, checkout e aula, em desktop e celular.
- `output/playwright/responsividade.json`: medições das 88 combinações.
- `output/playwright/results.json`: resultado da suíte completa.
- `output/playwright/site-publicado-antes.png`: referência do site publicado, sem alteração remota.
- `output/release-audit.json`: bloqueios objetivos para a abertura comercial.

As fontes externas foram removidas. A versão final utiliza fontes locais do sistema; as duas fotografias e a logo também são servidas pelo próprio projeto.

## Não verificado e dependências para homologação

Faltam projeto Supabase autorizado, inspeção da base existente, backup/restauração, execução da migração e testes diretos de RLS/Storage com duas contas reais. Cadastro, SMTP, expiração/uso único de links e revogação precisam de ensaio com o provedor real. Não foram enviados vídeos nem comprovada reprodução em iOS/Android/Safari reais.

Faltam escolha/credenciais de pagamento, condições comerciais aprovadas e teste no sandbox do provedor, incluindo concorrência e eventos fora de ordem. Os ensaios não confirmam o comportamento real de metadados nem as notificações do Mercado Pago. HTTPS, proxy e execução persistente da API na hospedagem ainda precisam de prévia autorizada.

O novo servidor mantém sessões em memória de um processo. URLs de vídeo assinadas já emitidas permanecem válidas por até 120 segundos; a sessão é validada novamente antes de emitir outras. A abertura comercial depende desses limites serem avaliados na homologação.

A aprovação da profissional para conteúdo e condições comerciais não foi presumida. O inventário atual registra **zero vídeos vinculados**, com dias **1–30 pendentes**. O plano de publicação e recuperação está em [ENTREGA_RV30_20261025.md](ENTREGA_RV30_20261025.md).
