# Vídeos e conferência da entrega — RV 30

Verificação local em 25/10/2026. Nenhum arquivo de vídeo foi encontrado no repositório. O arquivo `assets/data/rv30-videos-template.json` contém 30 **nomes de exemplo**, sem links. Esses nomes não comprovam a existência dos vídeos no Drive. Os 31 registros de `content.js` — introdução e dias 1 a 30 — estão sem URL de reprodução.

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
