# RV 30 — Relatório de QA e bloqueios comerciais (16/10/2026)

**Decisão: NO-GO / não publicar / não abrir vendas.** Os testes automatizados de staging são importantes, mas não representam aprovação de compra real nem de reprodução protegida.

## Revisão dos requisitos negociados

| Item | Estado auditado | Prova e pendência |
|---|---|---|
| Identidade RV: branco/grafite/turquesa | Implementada em branch | Capturas Chrome desktop 1440 e mobile 390; foto real de treinamento, diferença residual para a prévia editorial aprovada |
| Landing, checkout e área do aluno | Implementados em branch | Playwright valida navegação, campos e layout em 11 larguras; requer aprovação visual final e iOS/Android reais |
| Avaliação cardíaca no primeiro acesso | Aprovada em teste local | Karvonen: repouso 86/máx 187 sedentário = 137–157; repouso 62/máx 194 treinado = 141–168; pode pular e apagar; sem dados sensíveis reais em produção |
| Proteção e privacidade da FC | Apenas demonstração | Gravação local consentida; falta storage de produção com RLS e transparência LGPD |
| 30 videoaulas Drive | **Bloqueado** | Inventário autenticado encontrou somente `1.MOV` a `29.MOV`, sem `30.MOV` |
| Reprodução das aulas | **Bloqueado** | Todos os `videoUrl` ainda vazios, nenhum player autenticado com URLs curtas e CDN privada; 2 e 8 examinados HEVC/AAC exigem revisão de compatibilidade |
| Checkout comercial | **Bloqueado** | URL real ausente; falta pagamento com confirmação de backend, webhooks autenticados, idempotência, reembolso e matrícula |
| Login e painel reais | **Bloqueado** | `auth-demo.js` é somente protótipo local; falta provedor Auth/RLS/RBAC e backend de suporte/progresso |
| Compra, liberação, expiração/reembolso | **Não testável** | Não há integração com adquirente nem matrícula server-side de produção |
| Conteúdo de saúde e termos comerciais | Revisão humana pendente | Aprovação profissional/jurídica, consentimento, textos e identificação do fornecedor |
| Deploy com rollback | Não realizado | `main` preservada; aplicar somente depois de todos os testes de aceitação |

## Mudanças de proteção nesta revisão
- `assets/js/config.js`: acrescentados flags `salesEnabled: false` e `productionAccessVerified: false` enquanto não existir homologação de acesso.
- `assets/js/checkout.js`: possuir um link externo sozinho já **não é suficiente** para liberar inscrições.
- `assets/js/projeto.js`: botões comerciais no domínio público exibem "Inscrições em preparação" e não iniciam checkout quando ainda não há backend comercial validado. Localhost mantém o modo de teste.
- `assets/js/area.js`: dispensar avaliação cardíaca salva somente o indicador de boas-vindas por conta, sem coletar FC, e evita repetir a tela a cada visita.
- `scripts/release-audit.js` e `tests/launch_safety_test.js`: bloqueiam aprovação enganosa de produção.
- `tests/deep_audit.py`: atualizado para exigir os novos pré-requisitos de checkout e não confundir o bloqueio fortalecido com regressão.

## Verificações automatizadas
Workflow CI de QA: testes Node, validações estáticas, build, Playwright Chromium, auditorias Python e capturas de tela da landing/checkout/aluno em 1440px e 390px.

A aprovação dos testes significa: **o protótipo cumpre o contrato testado e não vende no domínio público sem backend**.
Não significa que 30 vídeos reproduzem ou que compras reais são entregues.

Rodar a auditoria de produção separadamente com `npm run audit:launch`. Seu estado esperado é `NO_GO` enquanto houver pendências de backend, mídia ou aprovação humana. Não contornar os gates mudando flags no JavaScript: o backend deve verificar matrícula e compra em todas as requisições.

## Para chegar ao GO
1. Colocar e validar `30.MOV` no mesmo Drive; conferir todos os 30 vídeos, áudio e nomes.
2. Conectar o projeto Supabase ou backend escolhido: aplicar esquema revisado em staging; implementar Auth com RLS, progresso, comentários, admin RBAC e proteção de dados pessoais.
3. Definir **o gateway** (Stone Link com conferência manual verificável ou Mercado Pago/Stripe via webhook assinado); oferecer configuração/credenciais **somente pelos secrets do provedor**, nunca por chat nem GitHub.
4. Implementar ingestão server-side do Drive e streaming privado responsivo (ex.: HLS/H.264), autorizado por matrícula e URLs temporárias.
5. Completar testes reais de compra, pagamento aprovado, falha, duplicidade de webhook, reembolso, revogação, logout, troca de senha e outra conta tentando acessar vídeo.
6. Testar todos os vídeos em Chrome/Android e Safari/iPhone, lentidão e acessibilidade; validar conteúdo/termos com responsável.
7. Aprovar screenshots finais, fazer backup e rollback, integrar os PRs em ordem, publicar em staging e repetir os testes no domínio antes de abrir vendas.

**Regra:** não chamar "100% concluído" enquanto qualquer etapa acima estiver pendente. Nunca subir IDs privados do Drive, tokens ou URLs de checkout internas para a árvore pública.
