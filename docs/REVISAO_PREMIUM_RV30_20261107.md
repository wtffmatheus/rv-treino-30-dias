# RV 30 — rodada de preview em 07/11/2026

## Resumo executivo

O pedido desta rodada determina preview antes de produção. A branch `rv30-premium-preview-20261107` parte da versão publicada `3f6acb7`. O domínio principal e os dados de produção não são o ambiente desta validação.

O login foi reorganizado para reduzir o painel de apresentação em telas menores. Na reprodução inicial em 574 × 850, a apresentação ocupava cerca de 407 px e o formulário ultrapassava a primeira tela. A nova composição dá prioridade ao formulário. A captura enviada pelo responsável mostra apenas parte da página; não foi reproduzido um desaparecimento permanente do formulário.

## Alterações implementadas

- Paleta azul contínua nos nove arquivos CSS existentes, com tokens finais em `assets/css/rv30.css`. Fundos principais `#081525`, superfícies `#10243B` / `#172F49`, destaque `#82BFE8`, textos `#F3F7FC` / `#B4C4D5`.
- Superfícies de vidro discretas em cards, cabeçalhos e autenticação. Blur de 10 px apenas nas superfícies selecionadas, fundo opaco alternativo, preferência por transparência reduzida e movimento reduzido respeitadas.
- Todas as páginas HTML carregam a camada final RV 30 uma única vez. Identidade institucional, logo do pacote e fotos fornecidas preservadas. Checkout também usa a paleta azul.
- Formulários com fonte legível, foco visível, alvos de toque e apresentação compacta no celular.
- Worker e D1 novos, exclusivos do preview (`wrangler.preview.jsonc`). As contas de aluno e administrador usam os e-mails reais informados, guardados em configuração protegida. A senha de seis caracteres solicitada é permitida somente para provisionar essas contas isoladas de teste; o contrato padrão de senhas continua exigindo 12 caracteres.
- Administração do aluno de teste por API: consulta de progresso, bloqueio/desbloqueio, liberação/revogação. O papel administrativo vem da configuração do servidor. Nenhuma ação cria pedido, pagamento ou acesso comercial.
- Origens de alteração autorizadas por lista exata. Nenhum domínio `*.vercel.app` é aceito indiscriminadamente. URLs de vídeo relativas mantêm o cookie no mesmo domínio do preview.

## Qualidade visual e revisão editorial

Capturas reais iniciais: `output/playwright/premium-login-before.png`, `premium-login-after-local.png`, `premium-landing-after-local.png`. A primeira é de produção; as demais são locais e têm o aviso de demonstração local. Não usar esse aviso como evidência de uma compra ou sessão do servidor.

As mensagens administrativas de sessão expirada e acesso indisponível tinham acentuação corrompida em `assets/js/admin-login.js` e foram corrigidas. A busca por sequências típicas de codificação corrompida em HTML/JavaScript não encontrou outras ocorrências. Revisão editorial preserva termos, alertas de saúde e condições R$ 399 / 365 dias. Não foram acrescentados depoimentos, resultados, qualificações ou promessas.

## Testes e evidências

- `npm test`: contratos de autenticação, pagamentos isolados, SQL local, mídia, progresso e QA. O teste D1/R2 inclui separação entre administrador e aluno, operações administrativas restritas, recusa de senha curta fora do preview e vendas bloqueadas.
- `npm run lint`, `npm run typecheck`, build estático e empacotamento do Worker.
- Navegador: suíte existente de 46 fluxos; os contratos de cores foram atualizados para a paleta solicitada, mantendo as verificações funcionais e contemplando os dois estados do vidro (opaco e translúcido).
- As primeiras execuções detectaram expectativas antigas de verde/turquesa e contraste insuficiente no destaque do CSS-base. A cor-base foi corrigida e as expectativas visuais foram alinhadas à nova especificação, sem remover testes.
- HTTP real no Worker de preview: login das duas contas, isolamento de papéis, progresso consultado pelo administrador, revogação de vídeo, bloqueio com invalidação de sessão, desbloqueio, streaming parcial real, cobrança recusada e dia 30 pendente.
- Os relatórios e estados de navegador ficam em `output/`, fora do Git e do build. Não publicar cookies, hashes, segredos ou manifestos privados.

## Publicação e veredito

O SHA implantado, ID/URL do preview, resultado final do Actions, verificações HTTP e capturas publicadas serão registrados na evidência final da rodada. Até essa verificação, o estado é **PENDENTE DE VALIDAÇÃO**. Build local não é aprovação da publicação.

## Pendências comerciais

O dia 30 aguarda o vídeo. A ordem e a correspondência editorial dos demais vídeos exigem aprovação profissional. Cadastro e recuperação públicos, atendimento e comentários persistentes, identidade/banco comerciais e Asaas real ainda dependem de homologação. Os testes desta rodada não aprovam vendas. A senha simples escolhida para validação não deve ser levada ao ambiente comercial.
