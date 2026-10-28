# RV 30 — cores originais e publicação — 26/10/2026

## Correção visual solicitada

Os fundos esverdeados introduzidos na revisão foram removidos. A composição
moderna foi preservada, usando a família azul original do projeto:

| Uso | Cor |
| --- | --- |
| Fundo, cabeçalho e capa | `#08151e` |
| Seções | `#101e28` |
| Painéis e cards | `#142732` |
| Textos | `#f5f9f9`, `#d9e5e8`, `#a9bdc5` |
| Destaque original da marca | `#00bbb1`, `#57e4d8` |

A nova logo segue exclusiva do programa RV 30. As fotos fornecidas da Rosangela
e a marca institucional foram preservadas. O checkout claro anterior permanece.
Há uma asserção de navegador que confere os seis fundos principais, além das
verificações de responsividade e de carregamento das fotos.

## Por que o site público ainda mostrava a versão antiga

O domínio usa o projeto **rv-treino-30-dias na Vercel**. O Cloudflare fornece o
DNS, cujo CNAME aponta para a Vercel. O Worker inspecionado no Cloudflare é um
serviço separado sem rota ou custom domain desse hostname.

A produção Vercel consultada está na branch `main`, commit `056761a`. A branch
`rv30-evolucao-20261025` do PR #14 ainda é uma revisão e gera previews. Esse é o
motivo de o site principal não refletir as mudanças da branch.

A correção de `wrangler.jsonc` feita pelo proprietário no commit `1be0e9b` foi
incorporada e preservada. Acrescentamos o controle de HTML/404, o mapeamento de
`/` para `index.html` e testes do runtime. O upload Cloudflare agora possui um
diretório válido, mas esse serviço não atende o domínio público atual.

## Validação da versão azul

- Instalação limpa `npm ci`: passou; audit retornou zero vulnerabilidades.
- `npm test`, lint e tipos: passaram.
- `npm run build` e `npm run check:cloudflare`: passaram; o último é dry-run,
  sem upload ou ativação de tráfego.
- `npm run test:cloudflare`: 27 verificações reais em `wrangler dev --local`
  passaram, incluindo páginas, assets, cabeçalhos e ausência de arquivos privados.
- `npm run test:e2e`: 38 testes Chromium passaram, com a paleta azul restaurada.
- Capturas: `output/qa-previews/landing-desktop.png` e `landing-mobile.png`.

## Publicação e recuperação

O alvo é o projeto Vercel que já atende `treino.rvfisiologista.com.br`, mantendo
o DNS e os demais produtos. Preparar a versão do commit revisado e ativá-la
somente após a autorização explícita prevista no pedido original. Depois,
conferir no domínio a identidade RV 30, os fundos azuis e os arquivos atualizados.

Antes da troca, foi identificado o deployment de produção anterior para eventual
rollback. A recuperação deve apontar o projeto Vercel para esse deployment,
sem alterar banco de dados ou DNS. A identificação operacional fica no ambiente
local de revisão; nenhum segredo é incluído nesta documentação.

Esta atualização visual não habilita vendas, não executa a migração nem conecta
vídeos ausentes. As pendências de conteúdo e de backend continuam registradas na
[entrega anterior](ENTREGA_RV30_20261025.md).
