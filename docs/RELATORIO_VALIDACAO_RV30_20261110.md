# RV30 — relatório de validação em 10/11/2026

Este é um relatório de progresso verificável. A plataforma integral permanece
PENDENTE para produção; as etapas 1–7 foram validadas em staging e a etapa 8
não pode ser aprovada sem as dependências comerciais e editoriais.

## 1. Problemas encontrados

Login podia ser enviado antes da inicialização; títulos e campos administrativos
herdavam estilos inadequados; a lista remota de aulas exibia semanas da demonstração.
Upload concorrente podia exceder limites ou rejeitar conclusão ainda em andamento.
Documentos e checkout misturavam escolhas antigas de provedor. Corrigidos e testados.
Permanecem as pendências da seção 19.

## 2. Arquitetura utilizada

Frontend estático Vercel; API Workers; D1 para identidade, papéis, matrícula,
progresso, administração e auditoria; R2 privado para arquivos. Staging isolado da
API e banco que atendem o domínio. Build estático não executa a API Node legada.
Estado: VALIDADA EM STAGING.

## 3. Melhorias visuais

Tokens compartilhados em azul-petróleo esverdeado, turquesa da marca e vidro
discreto. Logo institucional separada do pacote RV 30; fotos fornecidas preservadas.
Navegação compacta, tabelas mobile e escala do suporte corrigidas.
Estado: VALIDADA EM STAGING.

## 4. Funcionalidades desenvolvidas

| Função | Estado |
| --- | --- |
| Login, sessão protegida, logout e papéis | VALIDADA EM STAGING |
| Convite privado e recuperação manual de uso único | VALIDADA EM STAGING |
| Matrícula administrativa, bloqueio e revogação | VALIDADA EM STAGING |
| Dashboard, progresso e retomada | VALIDADA EM STAGING |
| Perfis, filtros, notas e CSV | VALIDADA EM STAGING |
| Curso, aulas, rascunhos, publicação e versões | VALIDADA EM STAGING |
| Upload privado multipart e revisão de mídia | VALIDADA EM STAGING |
| Suporte privado e auditoria | VALIDADA EM STAGING |
| Métricas calculadas do banco | VALIDADA EM STAGING |
| Checkout e webhook Mercado Pago | PENDENTE |
| Cadastro/recuperação e entrega automática por e-mail | PENDENTE |
| Aprovação editorial e mídia do dia 30 | PENDENTE |

## 5. Estado da área do aluno

Conta, datas da matrícula, dashboard, aula, reprodução, busca, retomada, histórico
e suporte usam registros persistidos. Revogação impede novas solicitações de mídia.
Atividade mede reprodução visível informada, com limites do servidor; não comprova
atenção ou exercício. Calculadora tem testes locais e interface disponível; não
representa homologação clínica. Estado: VALIDADA EM STAGING para os fluxos disponíveis.

## 6. Estado do painel administrativo

Gestão persistente de alunos, contato, períodos administrativos, notas, convite,
papéis, conteúdo, mídia, suporte e relatórios. Alterações relevantes auditadas.
Matrícula de pagamento não pode ser renovada manualmente. Financeiro mostra sua
indisponibilidade; não cria receita ou confirmação falsa. VALIDADA EM STAGING;
operação financeira PENDENTE.

## 7. Situação individual das 30 aulas

Inventário conectado por HEAD autenticado em 10/11. Disponibilidade técnica não
aprova orientações, objetivo, materiais ou duração de treino. As durações abaixo
são dos arquivos; vários têm poucos segundos. Inventário do Google Drive não foi
revalidado.

| Dia | Mídia privada | Duração do arquivo | Revisão editorial |
| --- | --- | --- | --- |
| 01 | VALIDADA EM STAGING — HEAD 200 | 120.510 s | PENDENTE |
| 02 | VALIDADA EM STAGING — HEAD 200 | 16.206 s | PENDENTE |
| 03 | VALIDADA EM STAGING — HEAD 200 | 22.667 s | PENDENTE |
| 04 | VALIDADA EM STAGING — HEAD 200 | 14.267 s | PENDENTE |
| 05 | VALIDADA EM STAGING — HEAD 200 | 21.667 s | PENDENTE |
| 06 | VALIDADA EM STAGING — HEAD 200 | 18.482 s | PENDENTE |
| 07 | VALIDADA EM STAGING — HEAD 200 | 25.533 s | PENDENTE |
| 08 | VALIDADA EM STAGING — HEAD 200 | 32.669 s | PENDENTE |
| 09 | VALIDADA EM STAGING — HEAD 200 | 25.800 s | PENDENTE |
| 10 | VALIDADA EM STAGING — HEAD 200 | 21.367 s | PENDENTE |
| 11 | VALIDADA EM STAGING — HEAD 200 | 24.433 s | PENDENTE |
| 12 | VALIDADA EM STAGING — HEAD 200 | 16.200 s | PENDENTE |
| 13 | VALIDADA EM STAGING — HEAD 200 | 17.767 s | PENDENTE |
| 14 | VALIDADA EM STAGING — HEAD 200 | 19.200 s | PENDENTE |
| 15 | VALIDADA EM STAGING — HEAD 200 | 13.933 s | PENDENTE |
| 16 | VALIDADA EM STAGING — HEAD 200 | 27.677 s | PENDENTE |
| 17 | VALIDADA EM STAGING — HEAD 200 | 23.700 s | PENDENTE |
| 18 | VALIDADA EM STAGING — HEAD 200 | 20.467 s | PENDENTE |
| 19 | VALIDADA EM STAGING — HEAD 200 | 11.100 s | PENDENTE |
| 20 | VALIDADA EM STAGING — HEAD 200 | 20.533 s | PENDENTE |
| 21 | VALIDADA EM STAGING — HEAD 200 | 13.433 s | PENDENTE |
| 22 | VALIDADA EM STAGING — HEAD 200 | 19.533 s | PENDENTE |
| 23 | VALIDADA EM STAGING — HEAD 200 | 16.200 s | PENDENTE |
| 24 | VALIDADA EM STAGING — HEAD 200 | 12.100 s | PENDENTE |
| 25 | VALIDADA EM STAGING — HEAD 200 | 13.600 s | PENDENTE |
| 26 | VALIDADA EM STAGING — HEAD 200 | 15.633 s | PENDENTE |
| 27 | VALIDADA EM STAGING — HEAD 200 | 14.441 s | PENDENTE |
| 28 | VALIDADA EM STAGING — HEAD 200 | 17.933 s | PENDENTE |
| 29 | VALIDADA EM STAGING — HEAD 200 | 12.267 s | PENDENTE |
| 30 | PENDENTE — HEAD 404 | Ausente | PENDENTE |

Fonte local sanitizada: `output/platform-stage8-inventory.json`.

## 8. Resultado dos testes de vídeo

Dias 1/15/25/29 novamente testados no Chromium em 10/11: áudio não silencioso,
busca e retomada, 208/266/260/238 frames e 78 respostas Range observadas, sem
exceções JavaScript. Dia 30 não cria player. Upload real de 35.797.622 bytes em sete
partes também reproduziu; arquivo permanece em revisão. Não foi testado um upload
real de 2 GiB. VALIDADA EM STAGING.
Fontes: `output/platform-stage8-{videos,connected}.json`.

## 9. Resultado dos testes de autenticação

Login válido e inválido, cookie forjado, papel administrativo sem matrícula,
isolamento, bloqueio, remoção de papel e logout testados nos serviços conectados.
Troca de senha pelo proprietário em Cloudflare Access permanece PENDENTE, assim
como recuperação automática por e-mail. Não há senha pública padrão.

## 10. Resultado dos testes administrativos

Jornada real com criação de perfil, convite, contato, prazo, nota, atendimento,
upload, versão/publicação/restauração, preservação de progresso, bloqueio,
revogação e CSV: VALIDADA EM STAGING. Testes usam somente contas próprias.
Fixture de segurança terminou bloqueada, sem administrador e sem sessões.
Fontes: `output/platform-stage6-preview-journey.json` e
`output/platform-stage8-connected.json`.

## 11. Resultado dos testes de segurança

23 cenários negativos remotos aprovados em 10/11; autorização por GET/HEAD/Range,
RBAC, conversa de outro aluno, CSRF, limites de upload e invalidação de sessão.
Bucket privado confirmado, sem domínio público/customizado. Dependências de
produção sem vulnerabilidades relatadas na consulta de 08/11. Isso não constitui
pentest completo. VALIDADA EM STAGING para os cenários registrados.

Backup restaurado em banco isolado: 844 instruções, 29 contagens coincidentes,
zero violações de chaves estrangeiras. D1 não permitiu `integrity_check`; não foi
testado o aplicativo contra o banco restaurado. Produção não alterada.
Fontes: `output/platform-stage8-{negative,restore}.json`.

## 12. Revisão ortográfica

Textos de UI revisados; auditoria administrativa traduzida; referências públicas
a Asaas substituídas pela decisão Mercado Pago, explicitamente em preparação.
Documentos antigos recebem indicação de histórico. VALIDADA EM STAGING para os
textos da aplicação; material editorial do curso PENDENTE.

## 13. Resultados de responsividade

390×844, 768×1024, 1366×768, 1440×900 e 1920×1080 examinados. Larguras adicionais
320/375/430/1024 sem overflow nos percursos. Conferidos teclado, foco e rótulos;
não se declara certificação WCAG integral. VALIDADA EM STAGING.

## 14. Screenshots reais antes/depois

Arquivos locais, ignorados pelo Git e examinados individualmente:

- Antes: `output/playwright/integral-stage1-landing-desktop.png`.
- Depois: `output/qa-previews/integral-stage6-preview-landing-{mobile,tablet,notebook,desktop,fullhd}.png`.
- Administração: `output/qa-previews/integral-stage6-preview-*`.
- Checkout/aula/suporte revisados: `output/qa-previews/integral-stage7-preview-*`.
- Reprodução em 10/11: `output/qa-previews/integral-stage8-preview-video-{1,15,25,29}.png`.

Capturas autenticadas têm nomes mascarados; estados autenticados, SQL e CSV não
são artefatos públicos. VALIDADA EM STAGING.

## 15. Branch e commit

Branch: `rv30-plataforma-integral-20261107`.
Código funcional validado: `bca2a044ba067286e7c0783cdd97082d6b3fd8ad`.
O commit posterior deste relatório altera somente documentação; o SHA de HEAD
deve ser conferido no Git/Actions antes de qualquer release.

## 16. GitHub Actions

Código funcional: [Actions 42513180898](https://github.com/wtffmatheus/rv-treino-30-dias/actions/runs/42513180898),
aprovado, mesmo SHA. Inclui testes, 66 E2E, lint, typecheck, build, verificações
Workers e auditorias Python. Duas verificações conectadas de preview repetidas e
aprovadas em 10/11, sem interceptações. Não equivalem a pagamento homologado.

## 17. ID e URL do deploy

`dpl_3TmZYeGUiTLFtQKmhfYZ8zTKsJX5`, READY, commit funcional exato:
https://rv-treino-30-dias-37y1i5zwy-matheus-silvas-projects-feb13148.vercel.app
Prévia protegida; nenhum segredo de acesso está neste relatório.

## 18. Status do domínio principal

https://treino.rvfisiologista.com.br permanece no deployment
`dpl_4iei9qAakJwvSk83Hy9orDcTCPYR`, SHA
`a9a8b5482b97c4ddec7c375fba43f4dda52f62c7`, READY, consultado em 10/11.
A nova plataforma não foi promovida. Estado da versão integral em produção:
PENDENTE. Não confundir a publicação antiga com o preview validado.

## 19. Pendências identificadas

Mercado Pago: proprietário informou que ainda precisa criar/configurar a aplicação.
Sem aplicação e credenciais protegidas, não há homologação de checkout, webhook,
conciliação, 365 dias automáticos ou revogação por eventos reais.
[Documentação oficial para a aplicação](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/your-integrations/application-details).
Não enviar credenciais por chat.

Canal de e-mail, identidade e entrega automática ainda precisam ser homologados.
Aprovação profissional dos conteúdos e vídeo 30 seguem pendentes. O proprietário
precisa validar seu acesso privado; a conexão Chrome falhou antes de abrir abas.
O fluxo privado está em https://revisao-treino.rvfisiologista.com.br/plataforma .
Não foram desativadas proteções nem copiados cookies do navegador do usuário.

## 20. Veredito técnico

PENDENTE PARA PUBLICAÇÃO INTEGRAL E VENDAS. Etapas 1–7 validadas em staging;
etapa 8 tem percursos técnicos aprovados, mas o gate completo continua pendente.
Etapas 9/10 não aprovadas. A autorização para publicar é válida, condicionada
aos gates exigidos pelo proprietário. Não promover a plataforma incompleta.
