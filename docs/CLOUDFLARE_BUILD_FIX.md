# Correção do build Cloudflare — 26/10/2026

O log `7efd7bbb-99f4-4d36-9647-fbe22aa1ab15` confirma que `npm run build`
terminou corretamente. A falha ocorreu no comando seguinte,
`npx wrangler versions upload`, porque não havia um script Worker nem um
diretório de assets declarado.

## Correção

- `wrangler.jsonc` identifica o Worker existente `rv-treino-30-dias` e aponta
  exclusivamente para `./dist`.
- Os destinos HTML são servidos sem redirecionamento canônico automático.
  `_redirects` inclui explicitamente `/ → /index.html`, além das rotas do aluno,
  checkout e painel. A regra parametrizada dos dias fica depois das regras fixas.
- Rotas ausentes retornam a página 404; não há fallback que transforme APIs
  ausentes na landing com status 200.
- A versão do Wrangler foi fixada em `4.152.0`, a mesma identificada no log.
  A dependência transitiva Undici usa `7.30.1`, com as correções indicadas pelo
  audit do npm. `npm audit --audit-level=moderate` retornou zero vulnerabilidades.
- O CI valida o empacotamento com `wrangler deploy --dry-run` e inicia o runtime
  local para testar as rotas antes de considerar o código pronto.

A API Node e os segredos permanecem fora de `dist`. Esta correção é de
hospedagem estática e não conecta automaticamente autenticação, pagamento ou
vídeos reais.

## Validação

```text
npm ci
npm run build
npm run check:cloudflare
```

O último comando contém `--dry-run`: valida o pacote sem enviar nem ativar uma
versão. Para conferir as rotas localmente, executar em um terminal:

```text
npx wrangler dev --local --ip 127.0.0.1 --port 8787 --show-interactive-dev-session=false
```

Em outro terminal, `npm run test:cloudflare`. As 27 verificações conferem o HTML
das rotas, logo, retrato e CSS; cabeçalhos de segurança; 404 de páginas ausentes;
e ausência de arquivos de configuração, `.env` e backend no diretório público.
O resultado é gravado em `output/cloudflare-runtime.json`.

Também passaram os testes de regras existentes, o novo contrato estático do
Cloudflare, lint e verificação de tipos do backend. O CI repete os testes de
navegador e as auditorias Python.

## Enviar uma versão e atualizar o domínio são etapas diferentes

O comando configurado no log, `npx wrangler versions upload`, **não ativa a
versão no domínio de produção**. Ele envia uma versão para revisão. Mesmo com
esse build corrigido, o site principal continua na versão ativa até ocorrer uma
publicação de produção.

O PR #14 e a branch de revisão não foram mesclados em `main` nesta correção.
Antes de ativar uma versão, conferir a branch de produção e o comando de deploy
do Worker no painel. A publicação em `treino.rvfisiologista.com.br` requer a
autorização explícita prevista no pedido original. Manter vendas desativadas.

## Hospedagem do domínio confirmada em 26/10

O domínio `treino.rvfisiologista.com.br` aponta para a Vercel: a resposta pública
contém `Server: Vercel` e `x-vercel-id`, e o CNAME termina em `vercel-dns-017.com`.
O projeto Vercel `rv-treino-30-dias` mantém em produção a branch `main`, commit
`056761a`. O PR #14 está aberto e sua branch só gera previews.

A inspeção autenticada do Cloudflare confirmou um Worker separado com uma versão
ativa, mas nenhum custom domain ou rota que o vincule a esse hostname. Portanto,
ativar um build no Cloudflare não muda o site público atual. Para atualizar esse
domínio mantendo a hospedagem existente, é necessário publicar a versão revisada
no projeto Vercel correto. Não é necessário migrar DNS.

Referências oficiais:

- [Diretório e configuração dos assets](https://developers.cloudflare.com/workers/static-assets/binding/).
- [Tratamento de HTML](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
- [Proxies internos e placeholders em `_redirects`](https://developers.cloudflare.com/workers/static-assets/redirects/).
- [Diferença entre upload de versão e deploy](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
