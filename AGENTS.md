# RV30 — desenvolvimento e publicação

Estas regras se aplicam a todas as alterações neste repositório. As instruções
atuais do proprietário prevalecem. Execute uma etapa de cada vez e avance
automaticamente após aprovação técnica comprovada.

## Ciclo obrigatório

Alterar → abrir no navegador Chrome/Chromium → inspecionar o resultado
renderizado → corrigir → testar → commit/push na branch de desenvolvimento →
GitHub Actions aprovado → preview READY → abrir preview → validar novamente →
registrar evidências → próxima etapa. Build aprovado sozinho não aprova uma etapa.

- Identifique branch, SHA, versão publicada e infraestrutura real antes de editar.
- Revise diffs, português, segurança, regressões e recursos estáticos.
- Execute `npm test`, lint, typecheck, build e verificações Workers aplicáveis.
- Preserve os testes e seus critérios. Diferencie fixtures, testes locais e
  testes dos serviços reais. Não invente resultados nem apresente simulação como
  homologação.
- Use `BASE_URL` para direcionar Playwright a um preview sem iniciar servidor
  local. Use `QA_STORAGE_STATE` apenas com arquivo protegido e ignorado pelo Git.
  Testes que dependem de demonstração local não são testes de serviços remotos.
- Use somente contas e registros próprios de validação nas operações de escrita.
  Segredos, senhas, cookies, tokens e estados autenticados ficam fora do Git,
  screenshots e artefatos públicos. Nunca imprimir respostas de autenticação.

## Revisão visual e funcional

- Abrir landing, login, dashboard do aluno, aulas/player, calculadora, suporte,
  administração, alunos e cursos/mídias conforme estiverem implementados.
- Capturar em `output/qa-previews/`: 390×844, 768×1024, 1366×768, 1440×900 e
  1920×1080. Conferir também 320, 375, 430 e 1024 px. Abrir e examinar cada imagem;
  gerar uma captura não comprova qualidade. Sanitizar dados pessoais antes de
  qualquer upload de evidências.
- Conferir CSS computado, foco/hover, teclado, toque, console, rede, imagens,
  overflow, densidade desktop, largura de sidebar e ausência de scrolls internos
  desnecessários. Corrigir a causa compartilhada; evitar novas camadas de exceção.
- Identidade: azul-petróleo com subtom esverdeado, turquesa da logo original e
  Clear Glass sutil. Tokens compartilhados em `assets/css/tokens.css`.
- Exercitar login válido/inválido, autorização, logout, navegação, reprodução,
  persistência do progresso e operações administrativas efetivamente disponíveis.
- Vídeos privados exigem autorização em cada solicitação, inclusive Range.
  Testar reprodução, áudio, busca e retomada dos dias 1/15/25/29. Dia 30 ausente
  deve continuar pendente. Não publicar o bucket para contornar problemas.

## Publicação

- Não publicar diretamente a partir de push em `main`. Usar previews e conferir
  SHA exato, Actions, READY, logs, recursos e comportamento no navegador.
- A versão integral só pode alcançar `treino.rvfisiologista.com.br` após todos
  os gates críticos do plano em `docs/PLATAFORMA_INTEGRAL_RV30.md` aprovados.
- Preparar deployment de produção sem associá-lo ao domínio; testar esse
  deployment antes da promoção. Confirmar backup, migrações aditivas e rollback.
  Repetir testes críticos no domínio depois de promover.
- Não abrir vendas antes de gateway, webhook, identidade, matrícula e entrega
  automática reais homologados. Nenhuma ação financeira real ou migração
  destrutiva sem salvaguardas e autorização específica.
- Registrar por etapa arquivos, comandos/resultados, capturas examinadas,
  commit/push, Actions, ID/URL de preview e lacunas. Distinguir IMPLEMENTADA,
  TESTADA LOCALMENTE, VALIDADA EM STAGING, VALIDADA EM PRODUÇÃO, PENDENTE e REPROVADA.
- Continuar sem novas confirmações no escopo autorizado. Uma dependência externa
  impeditiva deve ser descrita precisamente; não aprovar um gate ausente.
