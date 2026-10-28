# Vídeos e conferência da entrega — RV 30

Verificação local refeita em 27/10/2026. Nenhum arquivo de vídeo foi encontrado no repositório. O arquivo `assets/data/rv30-videos-template.json` contém 30 **nomes de exemplo**, sem links. Esses nomes não comprovam a existência dos vídeos no Drive. Os 31 registros de `content.js` — introdução e dias 1 a 30 — estão sem URL de reprodução.

**Situação verificável:** 0 arquivos reais vinculados, 0 dias com reprodução e 30 dias pendentes. A introdução também está pendente e é opcional. O relatório estruturado fica em `assets/data/rv30-video-status.json`.

| Dias | Arquivos utilizados | Estado |
| --- | --- | --- |
| 01 a 10 | Nenhum | Aguardando acesso ao arquivo real e preparação privada |
| 11 a 20 | Nenhum | Aguardando acesso ao arquivo real e preparação privada |
| 21 a 30 | Nenhum | Aguardando acesso ao arquivo real e preparação privada |
| Introdução | Nenhum | Opcional; não fornecida no inventário local |

Os links de pastas registrados anteriormente em `backend/VIDEOS_DRIVE.md` são referências para a investigação autenticada. Eles não comprovam que os 30 arquivos estejam presentes, tenham permissão de leitura, estejam aprovados ou possam ser reproduzidos nesta sessão. Não foram alteradas permissões do Drive.

## Importação sem trocar os números dos dias

O painel **Revisão de vídeos** aceita uma lista de nomes locais ou um manifesto privado. A seleção de arquivos locais lê os nomes, tamanhos e datas; não envia nem publica arquivos.

- `1.mov`, `02.MOV`, `12 - Mobilidade.mp4`, `vídeo aula 03.webm` e `dia-30.m4v` identificam os dias correspondentes. A introdução usa `0.mov`.
- A ordenação usa o número do dia. A ausência do dia 3 não desloca o vídeo 12 para outro dia.
- Dois arquivos para o mesmo dia são excluídos dessa importação. Nenhuma das alternativas é escolhida automaticamente.
- Um mesmo ID de arquivo do Drive para dias diferentes é um conflito e não preenche os dois dias.
- Nomes com mais de um número, como `12 - versão 2.mp4`, exigem revisão. O sistema não presume qual número é o dia.
- Dias fora de 0 a 30, extensões não aceitas, links que não pertencem ao domínio exato do Drive e divergências entre `day` e o nome são recusados.
- A interface importa os outros arquivos válidos e mostra os conflitos por escrito. Os dias sem vínculo permanecem listados como pendentes.
- Se o arquivo já estiver associado a outro dia em um lote anterior, o vínculo anterior é preservado e a associação nova é excluída com aviso. Os outros arquivos novos continuam sendo importados. O resumo considera o catálogo combinado, incluindo os lotes anteriores.
- `approved: true` recebido do arquivo é ignorado. A revisão precisa ocorrer novamente no painel. Uma nova importação invalida a aprovação da entrada modificada.

O resumo diferencia **arquivos importados**, **arquivos vinculados no Drive** e **arquivos aprovados editorialmente**. Nenhuma dessas etapas equivale à disponibilidade do vídeo no player.

## Reprodução privada

Não use o preview público do Drive para entregar o produto pago. Não inclua tokens do Google ou chaves de serviço em JavaScript. O manifesto preenchido com links privados também não deve ser adicionado ao diretório público `assets/` nem ao Git.

O fluxo preparado para produção é: localizar o arquivo privado com acesso autorizado; identificar versão/checksum; revisar; transcodificar MOV em formato compatível com celulares quando necessário; armazenar em bucket privado; cadastrar o objeto da aula no banco; disponibilizar uma URL assinada temporária somente depois de verificar a sessão e o direito de acesso ao RV 30 no servidor.

A autorização deve ser verificada para cada solicitação de reprodução. Um aluno sem acesso, bloqueado ou com sessão revogada não pode obter uma URL nova. A URL assinada já emitida continua válida até expirar; manter expiração curta. Dias sem objeto pronto não devem gerar um player: devem mostrar o estado de conteúdo pendente.

Nenhuma reprodução real, tela cheia ou compatibilidade Safari/Android pôde ser confirmada sem um arquivo reproduzível autorizado. O estado sem conteúdo está implementado para evitar um player quebrado.

## Verificar entrega do RV 30

O painel administrativo tem um formulário com o identificador do pedido e o botão **Verificar entrega do RV 30**. A ação é somente leitura.

Em ambiente real, a interface consulta `GET /api/admin/delivery?orderId=...` usando a sessão de cookie HttpOnly. O servidor deve conferir identidade autenticada, e-mail verificado e autorização administrativa antes de ler pedido, conta, acesso ou aulas. O resultado informa pedido/produto, estado confirmado no provedor quando disponível, conta vinculada, direito de acesso, dias disponíveis e motivos de pendência ou erro.

Na demonstração de localhost, a consulta lê apenas o banco local. O resultado é marcado como **diagnóstico de teste local** e nunca afirma confirmação real de pagamento. A associação usa `userId` do pedido; um e-mail igual não vincula uma conta automaticamente. A conferência não escreve no banco, não aprova pagamento e não libera conteúdo.

Não foi criado botão de reprocessamento nem mecanismo de concessão de acesso por essa conferência.

## Validação executada

`node tests/video_mapping_test.js` cobre ordenação 1/2/10/12, preservação de lacunas, duplicidade por dia e por arquivo, nomes ambíguos, divergência de dia, importação parcial, aceite editorial forjado, domínio/caminho inválidos e consulta de entrega sem escrita. Também confirma que uma simulação não comprova pagamento e que o e-mail isolado não associa o comprador.

`node tests/support_media_test.js` continua passando, incluindo revisão obrigatória, reimportação que invalida o aceite, expiração de sessão e bloqueio da demonstração fora de loopback.

Os testes usam exclusivamente identificadores e contas fictícios. A validação real da autorização/RLS, do provedor e dos vídeos depende do ambiente de homologação e está documentada na entrega geral.

## Reauditoria de acesso e inventário em 27/10/2026

A descoberta de integrações foi repetida. O Google Drive aparece disponível para conexão, mas **não instalado/conectado**; nenhuma ferramenta de leitura do Drive ficou disponível. A sugestão de conexão já havia sido apresentada em 25/10 e não foi repetida. Também foi tentada a automação da sessão existente do Chrome: a infraestrutura da ferramenta falhou antes de qualquer leitura de abas ou navegação. Isso não comprova falha de login nem ausência de arquivos no Drive.

A contagem remota permanece **desconhecida**. O inventário JSON identifica expressamente o escopo `repository_only`, mantém `authenticatedDriveChecked: false` e `remoteFileCount: null`. Há zero arquivos vinculados no projeto, sem inventar URLs ou usar os 30 nomes do modelo como evidência. Menções antigas a 29 vídeos continuam sendo históricas, sem revalidação nesta sessão.

Foram corrigidos dois problemas de preparação editorial: conflitos de uma importação nova com lotes anteriores bloqueavam também os arquivos válidos; o validador CLI contava associações com o mesmo ID repetido como se os dias fossem válidos. Agora a importação parcial preserva explicitamente os vínculos anteriores, e a conferência CLI exclui todas as associações conflitantes da contagem. Nenhum arquivo real ou dado de produção foi alterado.

`scripts/check-private-videos.js` aceita os formatos MOV, MP4, M4V e WEBM na entrada editorial e a introdução opcional `0`. Para aprovar o lote, continua exigindo os **30 dias com links privados válidos e exclusivos**, sem ambiguidade nem duplicidade. A introdução, se incluída, também precisa de link válido. Uma entrada ausente não muda os números dos outros dias. O resultado CLI informa apenas números de dias e problemas; não imprime IDs ou URLs privados. Essa verificação é sintática/editorial e não confirma acesso ao arquivo, integridade, aprovação profissional ou reprodução.

Passaram novamente `video_mapping_test.js`, `support_media_test.js` e `check_private_videos_test.js`, incluindo novos casos de conflito entre lotes, conflito em cascata, formatos mistos, introdução opcional, lacuna intermediária e contagem de ID repetido. A execução do validador sobre o modelo público resultou em `readyForEditorialReview: false`, `linked: 0` e dias 1–30 pendentes, como esperado.

Também passaram a regressão de navegador do editor (`revisao exige links, todos os dias e aceite; nao publica aulas`) e quatro cenários de `server-flow.spec.js`: armazenamento local forjado, aluno sem compra, consulta administrativa somente leitura e aula ausente/erro. Os quatro cenários de servidor usam APIs simuladas, sem acessar autenticação, pagamento ou vídeo reais.

Sem um arquivo privado real autorizado, continuam sem execução a reprodução de vídeo, a busca dentro da mídia, a tela cheia, a validade da URL assinada e a compatibilidade de codec em Android/Chrome e iPhone/Safari. Os testes com APIs simuladas validam o estado de aula ausente/erro da interface, sem representar esses testes de mídia reais.

Para avançar: conectar o Google Drive da conta que contém o programa ou disponibilizar um manifesto privado autorizado; conferir os arquivos reais e suas revisões; prepará-los no armazenamento privado; cadastrar cada dia pelo número original; e validar reprodução em homologação com conta compradora e conta sem acesso. Não é necessário tornar a pasta pública nem enviar senhas na conversa.
