# RV30 · Redesign da plataforma

22 de novembro de 2026. Implementação local na branch `redesign/rv30-visual-premium-20261121`, sobre `d834543` e as alterações de trabalho que já existiam. A identidade navy/cyan cobre os 13 documentos HTML da aplicação. O ambiente de validação tem dados descartáveis e vendas fechadas.

[Abrir o RV30 local](http://127.0.0.1:18421/) · [Ver a galeria](http://127.0.0.1:18422/) · [Abrir a galeria diretamente do disco](../../output/codex-redesign-completo/comparativos/index.html)

## Implementação e inspeção

| Área | Entrega | Arquivos principais |
| --- | --- | --- |
| Piloto e base comum | A marca usa o arquivo turquesa original. Os tokens definem o fundo `#071621`, o destaque `#67D7F6`, contraste, foco e as superfícies de vidro. Landing e login conservam os componentes do piloto. | `assets/css/tokens.css`, `publico.css`, `aplicativo.css`, `index.html`, `login.html` |
| Aluno | A próxima aula apresenta o dia indicado pela API. Matrícula, período de acesso, progresso, plano de 30 dias, histórico e conquistas usam os dados da conta. O calendário distingue o dia atual, os concluídos e os indisponíveis. | `aluno.html`, `assets/js/student-dashboard.js`, `assets/css/student-platform.css` |
| Treinamento | Vídeo em destaque, dois campos de informações, semanas expansíveis, seletor compacto no celular, abas, calculadora, conclusão e dúvidas. O aviso da conta de validação ocupa uma linha própria e libera a largura da grade para o vídeo. | `area.html`, `assets/js/area.js`, `assets/css/player.css`, `cardio.css` |
| Administração | Sete vistas com capturas individuais. Visão geral com métricas e gráficos da API, busca de alunos e ficha individual, edição e prévia do curso, biblioteca e conferência de mídia, atendimento, pedidos e auditoria. O recorte mobile reorganiza tabelas e navegação. | `admin.html`, `assets/js/platform-admin.js`, `platform-ui.js`, `platform-support.js`, `assets/css/admin-platform.css` |
| Checkout | Formulário, validação e resumo fotográfico com o preço do programa e os 365 dias de acesso. A interface distingue a compra indisponível, o formulário de demonstração e a criação de acesso após pedido de teste. | `checkout.html`, `pagamento-confirmado.html`, `assets/js/checkout.js`, `assets/css/compra.css` |
| Acesso e auxiliares | Login administrativo, formulários de ativação e recuperação, suporte da equipe e do aluno, revisor de vídeos, painel de demonstração, termos, privacidade e 404. | `admin-login.html`, `admin-videos.html`, `suporte.html`, `termos.html`, `privacidade.html`, `404.html`, `assets/js/auth-forms.js`, `assets/css/admin-access.css`, `atendimento.css`, `documentos.css`, `admin-demo.css` |

A inspeção do Chromium revelou três correções de composição. O player deixou de ser comprimido pelo aviso da fixture, a tabela administrativa de demonstração deixou de alargar a página e os gráficos passaram a representar também os períodos com um único ponto. O estado de convite privado ganhou um título próprio. A implementação usa as fotografias já presentes no projeto.

## Regressão e evidências

| Verificação | Resultado local |
| --- | --- |
| Duas falhas originais | 2/2 passaram. Os testes verificam a nova cor, as superfícies calculadas, a área de acionamento e o foco visível. A presença do CSS legado deixou de ser requisito. |
| `npm test` | Os 23 scripts de dados, segurança, serviços e plataforma passaram. |
| `npm run test:e2e` | 66/66 passaram no Chromium. |
| `playwright.real.config.js` | 8/8 passaram com o handler da plataforma, sessões e permissões no D1/R2 local. |
| `npm run lint`, `npm run typecheck`, `npm run build` | Aprovados. O build produziu 81 arquivos estáticos. |
| Workers | `check:cloudflare`, `check:platform` e `check:review` aprovados em dry-run. `test:cloudflare` passou nas 27 verificações locais de rotas, assets, cabeçalhos e caminhos privados. |

O roteiro visual abre 39 telas e estados em 320, 375, 390, 430, 768, 1024, 1366, 1440 e 1920 px. Ele mede overflow, controles fora da tela, obstrução por elementos fixos, imagens quebradas, erros de página e respostas HTTP inesperadas. Também aplica preferências reduzidas de movimento e transparência. Foram inspecionadas as capturas de celular e desktop e as composições intermediárias. As quatro gravações por área acompanham a matriz responsiva. O vídeo **Percurso guiado pelas telas** mantém o desktop fixo.

- [Galeria de capturas e vídeos](../../output/codex-redesign-completo/comparativos/index.html). O seletor percorre os 39 estados. Há 78 capturas de viewport e outras 78 de página inteira, com capturas anteriores disponíveis para seis telas.
- [Matriz de QA, preferências, eventos e reprodução](../../output/codex-redesign-completo/qa/validacao.json) e [verificação da galeria no navegador](../../output/codex-redesign-completo/qa/galeria.json).
- [Regressão de navegação](../../output/codex-redesign-completo/qa/e2e-final.txt), [identidade e mídia com o Worker local](../../output/codex-redesign-completo/qa/e2e-worker-local.txt), [testes do projeto](../../output/codex-redesign-completo/qa/npm-test.txt) e [rotas do Worker](../../output/cloudflare-runtime.json).
- [Capturas adicionais nas cinco resoluções do projeto](../../output/qa-previews/codex-completo/).

## Alcance da validação

A rodada final terminou com 351 medições e zero ocorrências nos critérios automatizados. A galeria carregou as 39 opções, abriu as imagens, verificou os 168 links de capturas e reproduziu os cinco vídeos. O Worker estático local entregou as 13 folhas CSS referenciadas pelos 13 documentos com conteúdo idêntico aos arquivos de origem.

O Worker local autenticou aluno e administrador com contas sintéticas. Nos dias 1, 15, 25 e 29 o Chromium reproduziu o MP4 de teste, decodificou a faixa de áudio, buscou até 1,4 s e retomou nessa posição após recarregar. As requisições privadas com Range retornaram 206. O acesso administrativo pelo aluno e a requisição de mídia pela conta revogada retornaram 403. O dia 30 apresentou o estado pendente. A gravação gerada para o teste identifica explicitamente a mídia de validação.

A compra e a criação de acesso na demonstração usam os dados isolados daquele navegador. Cadastro e recuperação por e-mail por meio do provedor alternativo tiveram o formulário inspecionado com configuração local. O envio real de e-mail, pagamentos, conteúdo privado original e serviços de produção ficam fora desta validação. Aprovação visual a cargo do proprietário. A versão publicada não foi consultada nem modificada.

## Reproduzir localmente

Execute na raiz do projeto. Em três terminais PowerShell separados, com as dependências instaladas:

1. Gere a mídia descartável com `node scripts/qa-studio-media.js`. Para servir a plataforma, defina `$env:PORT='18421'` e `$env:RV_STUDIO_QA='1'` nesse terminal e execute `node scripts/qa-platform-repro-server.js`. As contas locais de aluno e equipe são `golden@example.test` e `equipe@example.test`. A constante `PASSWORD` do próprio servidor contém a senha sintética da fixture.
2. Para a demonstração de compra, defina `$env:PORT='18420'` no segundo terminal e execute `node scripts/dev-server.js`.
3. No terceiro, execute `node scripts/qa-redesign-completo.js`, `node scripts/qa-studio-tour.js` e `node scripts/qa-studio-gallery.js` em sequência. Execute `node scripts/qa-studio-preview.js` para abrir a galeria na porta 18422. O arquivo HTML também funciona diretamente do disco.

A próxima ação do proprietário é avaliar a composição na galeria local. Não há publicação programada.

