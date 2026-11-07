# Processo permanente de validação

O Chrome/Chromium deve ser usado antes e depois de cada preview. A habilidade
Playwright CLI conduz a inspeção manual assistida; a suíte automatizada não
substitui abrir e examinar cada captura.

## Comandos reproduzíveis

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run check:platform` e `npm run test:e2e` validam os contratos locais.
Os testes com fixtures são identificados como tais.

Para o preview exato, no PowerShell, definir `BASE_URL` e executar
`npm run test:preview`. Opcionalmente definir `QA_STORAGE_STATE` apontando para um
arquivo ignorado e protegido de sessão autorizada. Não passar senha ou cookie na
linha de comando. Essa suíte faz solicitações reais, sem interceptar a API, e
informa quando um teste autenticado foi pulado por ausência de sessão.

O `playwright.config.js` também aceita `BASE_URL`, sem subir servidor local
quando definida. Nem todos os testes antigos são apropriados para homologação:
casos de demonstração só funcionam em loopback. Usar a suíte `test:preview`
dedicada para o serviço real. A proteção Vercel continua habilitada; usar acesso
temporário restrito ao deployment e revogá-lo após a revisão.

## Evidências

Capturas: `output/qa-previews/`, em 390×844, 768×1024, 1366×768, 1440×900 e
1920×1080. Conferir também os demais breakpoints do AGENTS.md. Examinar cada
imagem com o visualizador e registrar defeitos/correções. Dados pessoais e
segredos não podem estar em artefatos públicos. Uma captura de dashboard de
validação deve mascarar nomes/e-mails antes do envio, mantendo o layout real.

Conferir estados de carregamento/erro, teclado, hover/foco, cores computadas,
imagens, console, respostas HTTP, persistência, reprodução e autorização.
Registrar SHA, Actions e ID/URL READY. Repetir os fluxos no preview correto.

## Proteção de publicação

O projeto Vercel foi configurado para não associar domínios automaticamente e
ignorar builds de produção originados de `main`. A configuração versionada
também desabilita deploy Git de `main`. Isso não altera o deployment atualmente
associado ao domínio. A promoção manual só é permitida após os gates integrais,
backup/restauração e testes de um deployment de produção sem domínio.
Nenhum teste de push não homologado em `main` deve ser criado para demonstrar
a proteção. A mudança de configuração não equivale a homologar o produto.
