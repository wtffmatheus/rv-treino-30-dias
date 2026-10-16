# RV 30 — Etapa 4: vídeo privado, nunca embed público

## Verificação realizada (Google Drive autenticado)
A pasta fornecida contém **29 vídeos**, chamados de `1.MOV` até `29.MOV`, identificados por seus IDs reais. `30.MOV` continua **ausente** no inventário verificado; não vincular outro arquivo ao Dia 30.

Os testes com **2.MOV** e **8.MOV** revelaram formato `video/quicktime`, codecs **HEVC** e **AAC**, resolução **1080x1920** (vertical), duração de aproximadamente **16,2 s** e **32,7 s**, respectivamente. Não se pode presumir que os demais tenham as mesmas características. Reprodução direta de MOV/HEVC varia por navegador/dispositivo.

## Validação de manifesto sem expor arquivos pagos
O manifesto privado de 30 itens, contendo 29 links reais e o Dia 30 vazio, foi entregue ao proprietário fora do GitHub e dos assets públicos. Para verificá-lo:
```bash
node scripts/check-private-videos.js /caminho/fora/do/site/RV30_manifesto_privado_29_de_30.json
```
O validador informa apenas contagens, dias faltantes e problemas (não imprime IDs). Com o arquivo atual espera-se `linked:29`, `missingDays:[30]`, `readyForEditorialReview:false` e retorno não zero, impedindo promoção.

## Fluxo obrigatório até liberação dos alunos
1. Confirmar `30.MOV` na mesma pasta e reler os metadados de todos os 30.
2. Validar conteúdo, áudio e direito de uso com a RV. A aprovação editorial ocorre por arquivo e versão.
3. Fazer ingestão **server-side** do Drive com credenciais mantidas fora do navegador.
4. Converter/empacotar os vídeos para streaming privado com compatibilidade mobile, preferencialmente H.264/AAC/HLS ou serviço gerenciado compatível.
5. Verificar matrícula autenticada antes de criar cada URL de playback temporária.
6. Bloquear acesso após expiração/revogação/reembolso e auditar downloads/erros.
7. Validar em iPhone Safari, Android Chrome e desktop, em redes diferentes. Só marcar Dia 30 disponível após testes reais.

**Importante:** o validador não prova reprodução e não publica os vídeos. Não mover os links privados do manifesto para `assets/js/content.js`, `assets/data` ou o HTML estático.
