# Identidade RV 30 e versão publicada — 07/11/2026

## Constatação no domínio

O domínio `https://treino.rvfisiologista.com.br/` foi consultado diretamente na
Vercel e por HTTP. Ele ainda atende o deployment
`dpl_56oXH8JWKPqzGPKF3ttadfYe47rH`, da branch `main`, commit `056761a`.
O HTML público tem título **RV Fisiologia | Evolua no seu ritmo · Método RV** e
chamada principal **EVOLUA**. Portanto a reclamação corresponde à versão pública.

A branch `rv30-evolucao-20261025` do PR #14 contém a landing **RV 30**. Até esta
auditoria, ela não foi promovida para o domínio principal: o proprietário havia
escolhido aguardar a plataforma completa antes da publicação. Não se trata de
presumir um cache do navegador; a implantação de produção está em outro commit.

## Correção da entrada e conferência

- A página inicial da revisão já usa RV 30 no título, H1, apresentação do pacote,
  inscrição e FAQ, com os retratos fornecidos e a paleta azul/navy.
- A entrada do aluno foi corrigida para **Entrar no RV 30**, com a logo do pacote,
  chamada **Seu próximo dia no RV 30** e descrição específica dos treinos por dia.
  A marca institucional RV Fisiologia continua identificando a empresa.
- Títulos das páginas do catálogo e do acesso profissional identificam RV 30.
- Checkout, área do aluno e resumo do pedido identificam o programa RV 30.
- A referência do CSS RV 30 recebeu nova versão para o navegador buscar o arquivo
  atualizado quando a nova implantação for acessada.
- Não há texto de produto EVOLUA na interface da revisão. Dois arquivos HTML
  ainda usam um CSS de base com esse nome histórico; o nome técnico do arquivo
  não é o título ou a chamada exibidos na página.

Os testes de navegador existentes passaram (46), incluindo identidade, imagens,
responsividade, checkout e controles de acesso. Lint e build aprovados. Isso
valida a branch de revisão, não altera a versão pública por si só.

## Publicação e recuperação

Uma eventual publicação visual deve promover uma prévia revisada deste projeto
Vercel para o domínio, mantendo vendas bloqueadas enquanto o backend não estiver
homologado. Antes da promoção, conferir commit, páginas, preço de R$ 399 e prazo
de 365 dias. Depois, consultar novamente o próprio domínio e verificar título,
H1, login e arquivos. A versão antiga acima permanece a referência de rollback.

O pedido anterior de aguardar a plataforma completa não foi substituído
silenciosamente por uma publicação apenas visual. A decisão de publicar a marca
agora, com vendas ainda indisponíveis, deve ser confirmada pelo proprietário.

As pendências de banco, checkout, runtime da API e dia 30 continuam no
[roteiro de próximas compras](COMPRAS_FUTURAS_RV30_20261107.md). Elas não justificam
descrever uma alteração de branch como se já estivesse no domínio público.
