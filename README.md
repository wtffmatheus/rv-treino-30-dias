# RV Treino 30 Dias (RV30)

Plataforma do programa de treinos RV 30, da RV Fisiologia. Site estático na Vercel (`treino.rvfisiologista.com.br`) com API em Cloudflare Workers, identidade e progresso em D1 e vídeos privados em R2. Vendas permanecem desativadas.

**Estado atual, causa da falha de senhas, pendências e comandos: [docs/ESTADO_ATUAL.md](docs/ESTADO_ATUAL.md).**

## Desenvolvimento

Node 22+:

```
npm ci
npm run dev        # http://127.0.0.1:8081
npm test && npm run lint && npm run typecheck && npm run build
```

Regras de trabalho e publicação: [AGENTS.md](AGENTS.md).

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `*.html`, `assets/`, `public/` | Páginas e recursos publicados (`npm run build` gera `dist/`) |
| `backend/platform/` | Worker da plataforma (login, recuperação, cursos, administração) e esquemas SQL |
| `backend/review/`, `backend/qa/` | Revisão privada do responsável e Worker de QA antigo |
| `scripts/` | Build, servidores locais e roteiros de QA visual |
| `tests/` | Testes de integração (`*_test.js`) e Playwright (`e2e/`, `e2e-real/`) |
| `docs/` | Documentação organizada por tema |
| `wrangler*.jsonc`, `vercel.json`, `playwright*.config.js` | Configuração de infraestrutura e testes (precisam ficar na raiz) |
