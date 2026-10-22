# RV 30 — Guia operacional até o lançamento para vendas reais
**Revisado em 22/10/2026** · Base de código: `qa/rv30-release-hardening-20261016` + fotos reais.

## O que está pronto para revisão
- Visual RV Fisiologia (branco, grafite e turquesa), landing, checkout e área do aluno em desktop/mobile.
- Fotos do proprietário otimizadas em WebP: três imagens diferentes, total de ~296 KiB. A quarta foto da remessa era idêntica à primeira; não foi adicionada duplicada.
- Nova distribuição: retrato de clínica e marca no hero; blazer profissional em "Quem conduz"; foto em ambiente de fisiologia no resumo do checkout.
- Avaliação de FC por Karvonen na área do aluno, com convite opcional no primeiro acesso e exemplos do livro usados nos testes. Não se trata de monitoramento cardíaco ao vivo.
- Proteção de "não vender" em domínio público enquanto falta backend de pagamentos e matrículas.

## CHECKLIST DE GO/NO-GO (cada fase só fecha com evidência)

### 1. Entregar as 30 aulas no Drive
- [ ] Adicionar **30.MOV** à pasta de revisão já conectada. Em 22/10, estavam presentes somente 1.MOV–29.MOV.
- [ ] Conferir duração, áudio, conteúdo, ordem, título e autorização profissional de **cada vídeo**.
- [ ] Confirmar se há vídeo de introdução separado (não inventar um arquivo).
**Critério:** 30/30 arquivos originais validados, sem vazios, trocados ou duplicados.

### 2. Escolher e conectar os serviços de produção
- [ ] Definir um provedor de autenticação/BD (ex.: Supabase) e um de streaming privado (ex.: Cloudflare Stream, Mux, serviço próprio com HLS).
- [ ] Escolher o provedor de pagamento (**Stone** ou **Mercado Pago**; não trocar sem decisão da RV).
- [ ] Configurar projetos e ambientes TESTE/STAGING e PRODUÇÃO. Tokens e chaves devem ficar no provedor como secrets, **nunca no GitHub nem nesta conversa**.
**Critério:** endpoint real de homologação e armazenamento definidos; projeto acessível ao implementador com permissões mínimas.

### 3. Autenticação e acesso por matrícula
- [ ] Implementar registro/login, confirmação de email se necessário e recuperação de senha reais.
- [ ] Persistir matrículas, curso, conclusão, comentários e suporte em banco com políticas de acesso (RLS) por usuário e papéis de administrador revisados.
- [ ] Proteger a avaliação cardíaca como dado de saúde com consentimento explícito, minimização e exclusão. Consultar responsável por LGPD antes de tratar dados reais.
- [ ] Remover a dependência de `auth-demo.js` em produção.
**Critério:** usuário A nunca vê registros de B, administrador exige papel, logout revoga sessão, reset funciona.

### 4. Pagamento real com conciliação
- [ ] Integrar checkout seguro ao gateway escolhido; exibir valor total, dados do fornecedor, termos e política.
- [ ] Receber confirmação autenticada no **servidor** (webhook/API do gateway), com proteção contra eventos duplicados e pagamento fraudulento.
- [ ] Criar matrícula **somente após aprovação** e revogar/bloquear quando houver estorno/reembolso.
- [ ] Testar pagamento aprovado, recusado, pendente, repetido e reembolso.
**Critério:** transação de homologação gera exatamente uma matrícula válida; visitar URL `/pagamento/sucesso` não concede curso.

### 5. Publicar os 30 vídeos com segurança
- [ ] Ingerir os arquivos pelo servidor usando conta autorizada do Drive; guardar IDs/URLs originais fora do frontend.
- [ ] Validar/convertê-los para formatos reproduzíveis nos celulares (MOV/HEVC pode falhar fora do ecossistema Apple; considerar H.264/AAC, HLS adaptativo).
- [ ] Emitir URLs temporárias para **alunos com matrícula ativa**, com autorização conferida pelo backend a cada pedido.
- [ ] Testar playback de todos os 30 dias em Android/Chrome, iPhone/Safari e desktop; testar URL expirada e acesso sem matrícula.
**Critério:** 30/30 vídeos reproduzidos; visitante e comprador com acesso revogado não conseguem reproduzir.

### 6. Fidelidade visual e revisão profissional
- [ ] Conferir capturas de desktop e mobile com o moodboard aprovado, incluindo as fotos reais e o contraste.
- [ ] Confirmar autorização de uso das fotos e dos depoimentos/casos reais; evitar alegações garantidas de emagrecimento.
- [ ] Revisar instruções, segurança da frequência cardíaca, Termos, Privacidade, Política comercial, canais de suporte e informações do fornecedor com a responsável.
- [ ] Executar testes de acessibilidade de teclado, foco, contraste, leitura e responsividade em 320–1920 px.
**Critério:** avaliação visual aprovada, conteúdo de saúde validado e nenhuma quebra importante em mobile.

### 7. Publicar com rollback
- [ ] Integrar os PRs de desenvolvimento em ordem, resolver conflitos de CI e executar novamente toda a suíte.
- [ ] Rodar `npm ci && npm test && npm run check && npm run build && npm run test:e2e` e executar a auditoria de lançamento.
- [ ] Fazer backup, aplicar deploy de staging e testar o domínio real, certificados HTTPS, links e mensagens de erro.
- [ ] Fazer compra real controlada e verificar desde o comprovante até a reprodução e revogação de acesso.
- [ ] Somente depois habilitar `salesEnabled` e `productionAccessVerified` **com backend realmente validado** e publicar com plano de rollback.
**Critério:** nenhuma pendência crítica e evidências dos testes de ponta a ponta.

## Situação do projeto nesta revisão
**NO-GO: NÃO PUBLICAR PARA VENDAS.**
O último inventário do Drive apresenta 29/30 vídeos; não foi configurado gateway real, backend de autenticação/entitlements nem streaming privado. Teste de demonstração aprovado ≠ compra real comprovada.

## Ordem de dependências
`30.MOV` + **definição do gateway** + acesso a Supabase/backend/streaming → autenticação/matrícula → checkout/webhooks → playback privado → QA mobile → staging → GO comercial.

**Segurança:** jamais publicar manifestos privados do Google Drive ou credenciais em repositório público, CI, logs ou JS do navegador.
