# RV Projeto 30 — V6 / Pente-fino + Painel Admin

Versão de teste/staging do portal comercial do **RV 30**, com a jornada de venda, área do aluno e painel administrativo específico do curso.

## Atualizacao de 10/09/2026

Suporte aluno/admin e revisao de videos adicionados. Esta entrega continua sendo
uma **demonstracao local**, nao uma plataforma pronta para vendas reais.
As secoes V6 abaixo sao historicas; persistencia significa armazenamento no navegador.
Demo e simulacao agora ficam desativadas fora de localhost/loopback, inclusive em pages.dev.

```powershell
npm.cmd ci
npm.cmd run dev
```

Abra http://127.0.0.1:8081. Admin: http://127.0.0.1:8081/admin/entrar.
Credenciais exclusivamente de teste: `admin@rvfisiologia.test` / `rv30admin`.
Use sempre o mesmo endereco e navegador para compartilhar os dados de demonstracao.

- [Relatorio desta etapa](RELATORIO_SUPORTE_VIDEOS.md)
- [Guia do admin e videos](backend/VIDEOS_DRIVE.md)
- [Levantamento editorial e Instagram](AUDITORIA_INSTAGRAM.md)
- [Contrato do suporte para producao](backend/SUPPORT_API.md)

Validacao: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run build`.
E2E: `npx.cmd playwright install chromium` e `npm.cmd run test:e2e`.
Cloudflare Pages deve receber somente `dist/`, nunca a raiz ou `public/` do RV App.

> O dashboard consolidado dos 3 projetos **não foi implementado nesta versão**, conforme solicitado. A camada de dados foi preparada para múltiplos cursos/projetos sem prender toda a arquitetura a 30 dias.

## O que está pronto na V6

### Comercial
- Landing responsiva com identidade RV.
- Seções de qualificação, fases, experiência da plataforma, resultados/casos reais, profissional, preço, catálogo futuro e FAQ.
- Checkout próprio preparado para provider abstrato (`stone_link` no MVP e automação futura por gateway com API/webhook).
- Modo de teste claramente identificado.
- Captura de UTMs.
- Hooks de `PageView`, `ViewContent`, `InitiateCheckout` e `Purchase`.
- Privacidade, Termos, 404, sitemap, robots e configuração Vercel.

### Jornada do aluno
- Compra simulada → confirmação → criação de senha → login → Meus cursos → RV 30.
- Introdução + Dias 1–30.
- Progresso persistente.
- “Continuar de onde parei”.
- Comentários/dúvidas por conteúdo.
- Suporte a vídeo YouTube, Vimeo ou arquivo direto.
- Sessão de teste com expiração.
- Leitura do aluno respeita status e acesso ao curso.

### Painel administrativo do RV 30
Acesso de teste:

```text
admin-login.html
admin@rvfisiologia.test
rv30admin
```

O painel permite:
- ver todos os alunos;
- buscar por nome, e-mail ou telefone;
- filtrar por status, progresso e engajamento;
- ordenar por último acesso, nome, progresso, dúvidas ou data de cadastro;
- identificar alunos sem acesso recente;
- abrir o cadastro completo;
- editar nome e telefone;
- bloquear/desbloquear conta;
- liberar/remover acesso ao RV 30;
- visualizar e ajustar o progresso dia a dia;
- reiniciar progresso com dupla confirmação;
- visualizar dúvidas;
- responder individualmente;
- marcar dúvidas como tratadas;
- registrar observações internas;
- consultar pedidos do aluno;
- criar aluno manualmente;
- visualizar compras aprovadas sem conta;
- criar/vincular acesso a partir de uma compra aprovada no modo de teste;
- exportar alunos em CSV;
- consultar atividade/auditoria recente.

## Segurança corrigida no pente-fino V6

Uma falha importante de protótipo foi identificada na V5: métodos administrativos poderiam ser chamados diretamente pelo console sem uma sessão administrativa válida.

Na V6:
- leituras administrativas exigem sessão admin;
- mutações administrativas exigem sessão admin;
- `db()` completo não fica acessível sem admin;
- snapshot administrativo remove senhas;
- perfil entregue ao aluno não carrega notas internas, comentários brutos ou progresso bruto;
- `userById()` ficou reservado ao admin;
- revogação/bloqueio impedem leituras de progresso e comentários do aluno;
- telefone e e-mail recebem validações adicionais;
- pedido de teste recebe validação de comprador/valor;
- comentários ocultos deixam de aparecer para o aluno;
- sessão admin expirada redireciona para novo login.

## Preparação para múltiplos projetos

A V6 introduz `totalDays` por curso na configuração e `total_days` no schema proposto do Supabase.

Isso permite futuramente ter, por exemplo:

```text
RV 30
Projeto 2
Projeto 3
```

com durações diferentes, sem transformar agora o painel do RV 30 em um dashboard consolidado.

## Backend de produção proposto

A pasta `backend/` contém:
- `supabase-schema.sql`
- `API_CONTRACT.md`
- `PAYMENT_PROVIDERS_PLAN.md`
- `KIWIFY_WEBHOOK_PLANO.md` (referência legada, não é mais o caminho principal)
- `PRODUCAO_CHECKLIST.md`

O schema proposto inclui:
- perfis;
- cursos;
- aulas;
- compras;
- matrículas;
- progresso;
- comentários;
- observações administrativas;
- eventos de auditoria;
- RLS;
- helpers de autorização;
- consistência compra → matrícula;
- vínculo de progresso/comentário com uma aula existente;
- suporte a duração variável por curso.

## Como testar

Rode um servidor local:

```bash
python -m http.server 8080
```

Abra:

```text
http://localhost:8080/
```

Para o admin:

```text
http://localhost:8080/admin-login.html
```

Para testar diretamente a área do curso sem passar pelo checkout:

```text
http://localhost:8080/area.html?demo=1
```

## Testes automatizados

```bash
python tests/smoke_test.py
python tests/deep_audit.py
python tests/css_integrity_audit.py
node tests/admin_security_test.js
node tests/data_flow_test.js
python tests/supabase_schema_audit.py
python tests/content_audit.py
python tests/contrast_audit.py
```

## Bloqueios antes de receber clientes reais

A V6 está adequada para **teste/staging**, não para dados/pagamentos reais.

Ainda precisa:
1. URL real do Stone Link ou credenciais do gateway escolhido.
2. Backend/Auth reais.
3. Webhook validado server-side para automação de pagamento, preferencialmente Mercado Pago se Stone Link não atender.
4. Migração das funcionalidades hoje demonstradas com `localStorage` para banco.
5. Conteúdos/vídeos finais revisados pela Rosangela.
6. Política comercial e textos jurídicos definitivos.
7. IDs e consentimento para Analytics/Meta, se forem usados.
8. Teste manual real em Chrome, Safari/iPhone e Android.
9. Localização das imagens externas no próprio projeto/CDN, se desejado.
