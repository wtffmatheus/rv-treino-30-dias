# Auditoria V6 — RV Projeto 30

## Status

**Aprovado para testes de interface, fluxo comercial simulado, área do aluno e painel administrativo local.**

**Não aprovado para clientes reais** até concluir checkout real, webhook/backend, autenticação real, conteúdo final e revisão legal/comercial.

## Escopo revisado

- 11 páginas HTML.
- 12 arquivos JavaScript de interface/dados.
- CSS principal completo.
- Introdução + 30 dias de conteúdo estrutural.
- Checkout e jornada de compra.
- Área do aluno.
- Painel administrativo do RV 30.
- Configuração de deploy/headers/CSP.
- Schema Supabase proposto e contrato de backend.
- Testes estáticos, sintáticos, fluxo de dados e schema.

## Correções importantes desta rodada

1. Banco demo deixou de ser “uma conta por navegador” e passou a aceitar múltiplos alunos.
2. Login agora respeita destino seguro (`next`) e evita redirecionamento arbitrário.
3. Uma segunda compra no mesmo e-mail não redefine a senha existente.
4. Checkout em produção sem URL do provider não cai mais no pagamento simulado.
5. Adaptador demo falha fechado quando `testMode` é desligado.
6. Adaptador demo não sobrescreve um futuro adaptador real.
7. Seed administrativo não cria alunos fictícios se já houver compra pendente.
8. Revogação de acesso impede novas conclusões e comentários.
9. Bloqueio de aluno impede login.
10. Dias inválidos de progresso são rejeitados.
11. Reabertura do modal administrativo deixou de chamar `showModal()` em diálogo já aberto.
12. CSV ganhou mitigação contra Formula Injection.
13. Painel ganhou resposta individual às dúvidas, exibida depois para o aluno.
14. Migração de teste da V4 preserva progresso e comentários quando disponíveis.
15. Preço passou a ter fonte central de configuração.
16. CSP de deploy foi elevada a header de resposta, com `frame-ancestors` e `form-action`.
17. Metas duplicadas e estilos inline incompatíveis com a CSP foram eliminados.
18. Seletores CSS repetidos encontrados durante a revisão foram consolidados.
19. OG ganhou PNG local, além do SVG.
20. Schema proposto agora impede aluno de ler aula não publicada e comentário oculto.
21. `updated_at` no schema proposto ganhou triggers automáticos.
22. Checkout de produção voltou a preservar o formulário próprio da RV antes do gateway, conforme o fluxo de plataforma própria.

## Segurança — posição atual

O código demo contém credenciais/senhas de teste em armazenamento local e, portanto, **não é um mecanismo de autenticação de produção**. Isso está explicitamente isolado por `testMode` e pelo fail-closed.

A versão real deve usar autenticação/back-end e nunca confiar em `localStorage`, query string ou clique de botão para liberar acesso.

## Ponto médico/comercial

A página não apresenta a faixa de 6–9 kg como garantia universal. O texto atual informa que resultados individuais variam e que a referência depende de elegibilidade/condições individuais. Antes da campanha real, essa comunicação e todos os conteúdos do protocolo devem ser aprovados pela profissional e revisados conforme as regras aplicáveis à publicidade/consumo.

## Dependências externas ainda presentes

A landing usa três imagens servidas pelo domínio principal `rvfisiologista.com.br` para prova social/foto profissional. Elas estão autorizadas na CSP, mas criam dependência de disponibilidade do domínio principal. A recomendação para produção é copiar os arquivos autorizados para o próprio projeto/subdomínio.

## Conclusão

A V6 está em um ponto bom para teste manual de ponta a ponta e validação do painel administrativo do RV 30. A próxima mudança estrutural deve ser o backend real; continuar acrescentando lógica sensível em `localStorage` não aumenta a segurança do produto.
