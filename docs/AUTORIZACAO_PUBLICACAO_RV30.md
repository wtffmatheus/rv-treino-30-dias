# Autorização de publicação do RV 30

Em 07/11/2026, após revisar os erros de login no domínio principal e a versão validada em preview, o responsável autorizou: “autorizo publicar todas atualizaçoes possiveis no dominio, desde que, sejam validadas primeiro”.

Essa autorização substitui a restrição anterior de manter as atualizações apenas em preview. Para as atualizações solicitadas do projeto, validar os fluxos afetados, conferir o commit, os testes e o deploy antes de publicar no domínio `treino.rvfisiologista.com.br`. Depois da publicação, repetir os testes relevantes no domínio e registrar os resultados. Não solicitar novamente a mesma autorização a cada rodada validada.

Os bloqueios comerciais continuam valendo: publicar uma melhoria validada não comprova homologação de pagamentos, cadastro comercial ou do conteúdo ainda pendente.

## Publicação autorizada em 07/11/2026

- Versão promovida: `fb074b508b1987a2ce39729ef2207cf2673f0067`, com código visual validado em `275d56b`.
- GitHub Actions de origem: [42396901668, aprovado](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/42396901668).
- Preview de origem: `dpl_9E7Y9i6pquX2yxgmWR2QYErQ1Aci`, estado READY e commit confirmado.
- Produção: `dpl_ByqAcjxMDibrZuwNQxfkGFWmMHaE`, estado READY, mesmo SHA, domínio principal confirmado nos aliases.
- Backend de validação: as duas contas solicitadas usam o banco isolado já testado. A origem exata do domínio principal foi autorizada no Worker. Vendas permanecem desativadas; não há registro de pagamento fictício.
- Identidade publicada: RV 30, paleta azul, superfícies de vidro com alternativa opaca, login compacto e checkout com contraste corrigido.

Os resultados dos testes no domínio estão registrados em `output/rv30-production-verification.json`, sem senhas, cookies ou segredos. O histórico detalhado da validação anterior está em [revisão premium](REVISAO_PREMIUM_RV30_20261107.md).

Na verificação após a publicação, os formulários de aluno e administrador aceitaram as contas solicitadas no domínio principal, os 29 vídeos responderam a requisições parciais e o progresso foi salvo e restaurado ao estado anterior ao teste. Foram verificadas 32 combinações de página/largura sem imagens quebradas ou rolagem horizontal.

Um ajuste adicional impede que o aviso da conta de aluno desloque o formulário ao abrir a entrada administrativa com uma sessão existente. A mensagem dessa entrada identifica corretamente a conta de validação e oculta a recuperação ainda indisponível. Há um teste específico dessa transição; a suíte passou a 47 testes de navegador. Essa correção segue o mesmo ciclo de preview, CI e publicação validada.
