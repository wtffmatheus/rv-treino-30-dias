# RV 30 — reprodução privada disponível em 07/11/2026

A área para o responsável assistir aos arquivos está publicada em
**https://revisao-treino.rvfisiologista.com.br/**. O endereço alternativo é
https://rv30-revisao.user-matheus169.workers.dev/.

Entrar com o e-mail administrativo já configurado e o código enviado pela
Cloudflare. Não existe senha de demonstração nessa área. O acesso está limitado
ao endereço exato do responsável; não foi usado o domínio genérico de e-mail
permitido por uma configuração histórica de outro Worker.

## O que está vinculado

Os 29 MP4 verificados no R2 foram associados aos dias 1–29 no catálogo privado
do servidor. O player oferece controles nativos, áudio, busca, tela cheia,
seleção de dia e navegação anterior/próximo. O dia 30 permanece indisponível.
O tema usa os fundos azul/navy do projeto e a logo fornecida do pacote RV 30.

O manifesto real e o administrador ficam em secrets do Worker, fora do Git e
dos arquivos públicos. A API do catálogo retorna apenas dia, duração e rota de
reprodução; não divulga chaves R2 ou credenciais. O streaming passa pelo Worker,
que consulta o objeto privado com a binding R2 e transmite o corpo sem carregá-lo
inteiramente na memória. Suporta HEAD e ranges para busca/reprodução.

## Autenticação e isolamento

Foi criado o Worker exclusivo `rv30-revisao`, com configuração em
`wrangler.review.jsonc`, ligado ao bucket `rv30-videos-private`. Uma aplicação
Access exclusiva protege o Worker inteiro, incluindo domínio, workers.dev e
quaisquer rotas futuras. Usa o provedor de código por e-mail existente e sessão
de quatro horas. A policy autoriza um único e-mail administrativo.

O handler exige `ctx.access` autenticado pela plataforma, audience da aplicação
correta e identidade correspondente ao administrador protegido. Cabeçalhos de
identidade forjados não bastam. Sem contexto Access, falta de configuração ou
usuário diferente, o servidor não consulta nem transmite vídeo. O Worker não
usa Static Assets, cuja camada de roteamento não propaga `ctx.access`.

Nenhuma policy de outros projetos foi ampliada ou desabilitada. O bucket segue
privado e nenhum objeto recebeu URL pública. Não houve alteração do DNS ou da
publicação principal de `treino.rvfisiologista.com.br`.

## Validação realizada

- Contratos do handler: contexto ausente/forjado, audience diferente, aluno,
  administrador não configurado, manifesto inválido, arquivo divergente,
  catálogo sem chaves, streaming, HEAD, intervalos válidos/inválidos, If-Range,
  métodos indevidos e dia 30 ausente.
- Runtime local com R2 remoto real: 29 rotas de vídeo responderam 206 com
  intervalo e cabeçalho MP4 corretos. A identidade Access foi simulada somente
  nesse ambiente local, em loopback; não há mecanismo de simulação no Worker.
- Navegador real: reprodução dos dias 2 e 29, metadados de 1080 × 1920, avanço
  até o final após busca, entrada/saída de tela cheia, navegação por dia e ausência de overflow horizontal
  em desktop e viewport de 390 pixels. Capturas em `output/rv30-review-*.png`.
- Os endereços remotos do domínio e workers.dev, sem autenticação, redirecionaram
  para Cloudflare Access. A configuração remota confirmou policy de um único
  administrador, provedor OTP e os secrets esperados, sem expor seus valores.
- `npm test`, lint, typecheck e build aprovados. A suíte da revisão está incluída
  em `npm test`; `npm run check:review` valida e empacota sem publicar.

Não foi consumido um código real recebido por e-mail do responsável. Essa
confirmação de login é feita pelo próprio usuário. O runtime local instalado
suporta compatibilidade até 26/10; o teste local usou essa data, enquanto o
Worker publicado usa 07/11/2026. As identidades locais de teste não foram publicadas.

## Limites para a plataforma de compradores

Esta é a visualização privada do responsável, pronta para assistir e revisar.
Não altera matrículas, pagamentos, aprovação editorial ou aulas no Supabase.
Os compradores ainda dependem da API de autenticação, do banco e do checkout
reais. Os 365 dias e a revogação por reembolso/contestação continuam exigidos na
entrega aos alunos. O catálogo de compradores permanece bloqueado até homologação.

Falta conectar o Drive para comparar as versões e localizar o dia 30. As cópias
atuais foram obtidas na pasta local já identificada, preservando os originais.

## Manutenção e recuperação

Para atualizar um vídeo: preparar e conferir o arquivo, enviar uma nova chave
com hash, verificar integridade e atualizar o manifesto protegido. Não sobrescrever
uma versão sem registrar o vínculo. Depois de adicionar o dia 30, o catálogo passa
a mostrá-lo automaticamente.

Revisar os recursos e a conta antes de executar `wrangler deploy --config
wrangler.review.jsonc`. A publicação estática principal continua usando
`wrangler.jsonc`; os fluxos são separados. Preservar os dois secrets existentes.

Para retirar a revisão do ar: primeiro desativar o domínio e o Worker de revisão,
mantendo o Access enquanto houver endpoint ativo. Depois remover os recursos
exclusivos se necessário. Não apagar o bucket ou os vídeos como rollback e não
desativar a proteção para diagnosticar uma falha de login.

Referências oficiais: [Access para Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
e [API R2 para Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
