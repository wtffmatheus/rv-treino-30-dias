# Preparação e envio privado dos vídeos — 07/11/2026

> Atualização posterior: os 29 arquivos já estão vinculados à
> [área privada para assistir e revisar](REPRODUCAO_PRIVADA_RV30_20261107.md).
> O vínculo com aulas de compradores no banco continua pendente.

## Origem e conferência

O proprietário confirmou que a referência dos vídeos é a pasta Drive já
informada. A conexão Google Drive continua não instalada; a tentativa de abrir a
sessão Chrome falhou na infraestrutura da ferramenta antes de acessar abas.
Por isso, a quantidade e as versões atuais no Drive continuam desconhecidas.

A busca local encontrou cópias numeradas de **1.MOV a 29.MOV** na pasta
`Área de Trabalho/videos-rv` sincronizada pelo OneDrive. São 29 arquivos, com
907.718.102 bytes. Nenhum arquivo do dia 30 foi encontrado nessa pasta. Isso
não prova ausência do dia 30 no Drive. Não foi inventado, duplicado ou renumerado
um vídeo para preencher o dia ausente.

Os originais são HEVC, 1080 × 1920, com áudio AAC. O arquivo 1 tem cerca de
120,5 segundos; os demais têm aproximadamente 11–33 segundos. Amostras visuais
dos arquivos 1, 2 e 29 foram inspecionadas. Isso não substitui revisão profissional
integral nem confirma que cada arquivo contenha uma aula completa.

## Preparação privada

O comando `npm run media:prepare` usa FFmpeg/FFprobe fornecidos por caminho para:

1. Conferir numeração, lacunas e conflitos antes da conversão.
2. Gerar MP4/H.264, yuv420p, áudio AAC e faststart, preservando os originais.
3. Conferir codec e duração e decodificar integralmente cada saída, com erro fatal
   em corrupção. Recalcular o hash do original para detectar alteração no processo.
4. Calcular SHA-256 e MD5 das saídas e gerar manifesto privado fora do build.

Exemplo, com os executáveis e a pasta real autorizada:

```powershell
npm.cmd run media:prepare -- --source 'D:/pasta-autorizada' --ffmpeg 'D:/ferramentas/ffmpeg.exe' --ffprobe 'D:/ferramentas/ffprobe.exe'
```

O destino padrão é `output/rv30-media/prepared/`, ignorado pelo Git. O comando
não faz upload nem publica aulas. Nomes conflitantes interrompem a preparação;
dias ausentes não deslocam os outros. MOV, MP4, M4V e WEBM são formatos de entrada.

O build também recusa arquivos de vídeo e manifestos `.private.` na lista de
arquivos publicados. Relatórios com caminhos, hashes e chaves de objetos ficam
somente em `output/rv30-media/`; não colocar esses manifestos em `assets/`.

## Destino e integridade

**Resultado confirmado:** 29 MP4 enviados, dias 1–29, total de 672.319.279 bytes
(aproximadamente 672 MB), com 649,3 segundos de conteúdo somado. Todos os tamanhos
e MD5 coincidiram com os objetos remotos. Os 29 arquivos foram decodificados
integralmente antes do envio, sem erros reportados pelo FFmpeg. A leitura anônima
de um dos objetos pela origem R2 foi recusada com HTTP 401. O bucket permanece
sem domínio público. Há zero vínculos com aulas publicadas e o dia 30 está pendente.

Foi criado o bucket R2 exclusivo `rv30-videos-private`, separado dos arquivos
de outros projetos. Nenhum domínio personalizado ou acesso `r2.dev` foi habilitado.
O envio é de cópias MP4 para preparação editorial; os MOV originais não foram
alterados. O conteúdo não foi publicado no site nem vinculado às aulas no banco.

As chaves usam o dia e o SHA-256 do arquivo convertido. Antes de repetir um envio,
conferir recibo e metadados remotos; não enviar novamente para chaves de versões
diferentes sem registrar a revisão. Não remover arquivos de outros programas.
O envio direto usa a sessão Wrangler já autenticada, sem gravar credenciais no
script ou solicitar tokens na conversa. O conector Cloudflare confere o bucket
e os metadados; os arquivos grandes são transmitidos a partir do computador.

Depois de confirmar novamente que o bucket está privado, enviar cada arquivo
aprovado para preparação usando a chave indicada no manifesto privado:

```powershell
npx.cmd wrangler r2 object put 'rv30-videos-private/CHAVE_DO_MANIFESTO' --remote --file 'CAMINHO_DO_MP4' --content-type 'video/mp4' --cache-control 'private, max-age=0'
```

Conferir conta e bucket antes do envio; `--remote` é obrigatório para gravar no
R2 real. O lote desta sessão usou um recibo retomável privado e não reenviou os
mesmos arquivos após confirmação. Não usar os placeholders acima literalmente.

A verificação remota executada exigiu exatamente uma cópia para cada dia enviado,
tamanho igual ao local, ETag igual ao MD5 da cópia transmitida em PUT simples e
tipo `video/mp4`. O recibo privado registra a comparação. A leitura anônima do
bucket permanece bloqueada. O armazenamento R2 não transcodifica os vídeos;
a preparação acima acontece localmente.

## Pendências para entregar aos alunos

- Conectar o Drive para conferir as versões oficiais e localizar o dia 30.
- Revisar integralmente os arquivos e aprovar o conteúdo correto para cada dia.
- Conectar o banco e cadastrar as versões aprovadas, preservando o número original.
- Integrar o R2 à reprodução autenticada. A API atual emite URLs Supabase Storage;
  este envio ao R2 não altera automaticamente esse adaptador nem habilita o player.
  Escolher entre transferir ao Storage privado homologado ou adaptar o backend
  para acesso temporário ao R2 após conferir compra, expiração e sessão.
- Homologar reprodução, busca, permissões e expiração na plataforma completa.

Não tornar os objetos públicos para contornar a integração pendente. A publicação
de produção continua aguardando a plataforma completa, conforme o proprietário.

Referências: [envio R2](https://developers.cloudflare.com/r2/objects/upload-objects/),
[privacidade do bucket](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[download FFmpeg](https://ffmpeg.org/download.html).
