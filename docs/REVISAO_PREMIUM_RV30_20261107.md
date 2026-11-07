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

## Qualidade visual

Capturas reais iniciais: `output/playwright/premium-login-before.png`, `premium-login-after-local.png`, `premium-landing-after-local.png`. A primeira é de produção; as demais são locais e têm o aviso de demonstração local. Não usar esse aviso como evidência de uma compra ou sessão do servidor.

As capturas do preview revelaram texto escuro herdado da antiga versão clara do checkout. As declarações antigas foram corrigidas nos próprios estilos e o teste visual agora exige contraste mínimo de 4,5:1 nos textos do resumo, título e avisos afetados. A captura final `output/playwright/premium-checkout-final-preview.png` comprova o resultado publicado. O login publicado está em `output/playwright/premium-login-preview-mobile.png`; o painel está em `output/playwright/premium-admin-final-preview-mobile.png`.

## Revisão ortográfica

As mensagens administrativas de sessão expirada e acesso indisponível tinham acentuação corrompida em `assets/js/admin-login.js` e foram corrigidas. A busca por sequências típicas de codificação corrompida em HTML/JavaScript não encontrou outras ocorrências. Revisão editorial preserva termos, alertas de saúde e condições R$ 399 / 365 dias. Não foram acrescentados depoimentos, resultados, qualificações ou promessas. O aviso administrativo foi separado do aviso de aluno para não atribuir matrícula ou progresso ao administrador.

## Testes e evidências

- `npm test`: contratos de autenticação, pagamentos isolados, SQL local, mídia, progresso e QA. O teste D1/R2 inclui separação entre administrador e aluno, operações administrativas restritas, recusa de senha curta fora do preview e vendas bloqueadas.
- `npm run lint`, `npm run typecheck`, build estático e empacotamento do Worker.
- Navegador: suíte existente de 46 fluxos; os contratos de cores foram atualizados para a paleta solicitada, mantendo as verificações funcionais e contemplando os dois estados do vidro (opaco e translúcido).
- As primeiras execuções detectaram expectativas antigas de verde/turquesa e contraste insuficiente no destaque do CSS-base. A cor-base foi corrigida e as expectativas visuais foram alinhadas à nova especificação, sem remover testes.
- HTTP real no Worker de preview: login das duas contas, isolamento de papéis, progresso consultado pelo administrador, revogação de vídeo, bloqueio com invalidação de sessão, desbloqueio, streaming parcial real, cobrança recusada e dia 30 pendente.
- Os relatórios e estados de navegador ficam em `output/`, fora do Git e do build. Não publicar cookies, hashes, segredos ou manifestos privados.

## Validação da publicação

- Branch: `rv30-premium-preview-20261107`.
- Código validado: `275d56bb12e1f5a4fa4b88cd05f5ccfe37f37200` (atualizações posteriores deste relatório não alteram esse snapshot).
- GitHub Actions: [execução 42396495073, sucesso](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/42396495073).
- Deploy: `dpl_2t7dC5GyyzgEAArBmk5jAgajh9mn`, estado `READY`, commit conferido nos metadados e no log de build.
- [Preview validado](https://rv-treino-30-dias-7czpfado3-matheus-silvas-projects-feb13148.vercel.app/).
- HTTP real pelo frontend Vercel: configuração 200 com `qaOnly=true` e vendas desativadas; login de aluno e administrador 200; aluno no admin 403; vídeo sem sessão 401; revogação 403; sessão bloqueada 401; range de vídeo real 206; dia 30 404; criação de pedido 503.
- Navegador publicado: login pelo formulário, redirecionamento ao curso, reprodução e avanço para 30 segundos, conclusão mantida após recarregar, progresso consultado no painel, revogação/liberação pelo botão administrativo.
- Responsividade publicada: 32 combinações das quatro páginas públicas nas larguras 320, 375, 390, 430, 768, 1024, 1440 e 1920; outras 24 combinações autenticadas (cursos, aula e suporte). Nenhuma rolagem horizontal; imagens públicas carregadas após ativação das imagens com carregamento tardio.
- Suite local final: 46/46 testes de navegador aprovados, além dos contratos e verificações estáticas. Nenhuma execução falha foi removida do histórico. A primeira execução do Actions falhou pelo checkout claro e foi corrigida nos commits seguintes.
- Sem exceção global de segurança: o preview conserva a proteção Vercel. A automação usou acesso temporário restrito ao deploy; a autenticação do aplicativo permaneceu obrigatória. A resposta 401 de `/api/account` para visitantes é esperada.
- Logs de build revisados: sem falha de compilação. Restam avisos da ferramenta de build sobre a configuração `cache-dir` do ambiente e aprovação futura de scripts de instalação do esbuild/workerd; não houve alteração de permissões para ocultá-los. Não impediram a geração nem os testes do Worker no Actions.
- Uma tentativa logo após atualizar a lista de origens do preview recebeu 403; após propagação, a mesma verificação passou sem ampliar a lista para curingas.

As duas contas entram diretamente com a senha de teste solicitada, sem depender de uma caixa postal ou confirmação de e-mail. O ambiente contém somente os registros de validação. O principal `treino.rvfisiologista.com.br` não recebeu esta rodada.

## Pendências comerciais

O dia 30 aguarda o vídeo. A ordem e a correspondência editorial dos demais vídeos exigem aprovação profissional. Cadastro e recuperação públicos, atendimento e comentários persistentes, identidade/banco comerciais e Asaas real ainda dependem de homologação. Os testes desta rodada não aprovam vendas. A senha simples escolhida para validação não deve ser levada ao ambiente comercial.

## Veredito

**APROVADO PARA PREVIEW** no snapshot e URL acima. A identidade azul e os acessos de validação foram verificados. O lançamento comercial continua bloqueado pelas pendências descritas; não há autorização presumida para promover esta rodada ao domínio principal.
