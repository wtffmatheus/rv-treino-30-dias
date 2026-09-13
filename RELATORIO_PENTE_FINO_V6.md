# Relatório de Pente-Fino — RV Projeto 30 V6

## Resumo executivo

A V6 foi revisada em uma nova rodada de pente-fino estrutural, funcional, visual e de segurança do protótipo.

**Status atual:** aprovada para testes/staging da experiência.  
**Status produção:** ainda não aprovada para receber dados e pagamentos reais.

O painel administrativo do RV 30 foi ampliado. O dashboard consolidado de 3 projetos continua propositalmente fora desta versão.

---

## 1. Bug crítico corrigido — autorização administrativa

### Problema encontrado
Na camada de demonstração da V5, a interface de admin tinha login, porém vários métodos da store administrativa ainda poderiam ser chamados diretamente pelo console do navegador sem validar uma sessão admin.

### Correção V6
Todas as leituras e escritas administrativas passaram a exigir sessão válida.

Abrangido:
- listagem de alunos;
- compras pendentes;
- métricas;
- edição de aluno;
- acesso ao curso;
- progresso;
- notas internas;
- comentários/respostas;
- criação de aluno;
- auditoria;
- criação de acesso a partir de pedido;
- snapshot da base.

Também foi criado `admin_security_test.js` para evitar regressão.

---

## 2. Vazamento de contexto interno do aluno reduzido

### Problema
O objeto público de usuário retirava a senha, mas ainda poderia conter estruturas internas como notas administrativas, comentários brutos e progresso.

### Correção
Foi criada uma representação reduzida específica para o aluno.

O aluno não recebe:
- senha;
- notas internas;
- coleção bruta de comentários;
- coleção bruta de progresso.

`userById()` também passou a exigir admin.

---

## 3. Bloqueio/revogação agora afetam leitura

### Problema
Algumas funções de leitura do protótipo podiam retornar progresso/comentários sem reconfirmar status ativo e entitlement.

### Correção
`progress()` e `comments()` agora exigem:
- usuário ativo;
- acesso ao curso.

Comentários ocultos também são filtrados.

---

## 4. Painel administrativo ampliado

Incluído:
- métrica de alunos sem acesso recente;
- filtro por engajamento;
- filtro “nunca entrou”;
- filtro “com dúvidas pendentes”;
- ordenação configurável;
- badge de risco/inatividade;
- criação manual de acesso a partir de uma compra aprovada sem conta;
- modal dedicado para esse fluxo;
- tratamento de sessão expirada;
- atualização periódica da tela;
- refresh via evento de storage;
- auditoria ampliada;
- exportação CSV com coluna de inatividade.

---

## 5. Compra pendente → acesso

Foi adicionada uma simulação administrativa para o caso em que exista uma compra aprovada, mas ainda não exista uma conta vinculada.

O admin pode:
1. abrir a compra;
2. criar/vincular acesso;
3. definir senha temporária de teste;
4. abrir o cadastro criado.

Na produção isso deverá ser automatizado por webhook/backend, e não depender do admin.

---

## 6. Validações de dados

Adicionado/fortalecido:
- e-mail;
- telefone;
- nome;
- valor de pedido;
- senha temporária;
- dia de conteúdo válido;
- tratamento de erro na simulação de pagamento.

---

## 7. Bug CSS real encontrado

### Problema
O CSS mobile do admin utilizava:

```css
var(--max)
```

mas `--max` não existia.

### Efeito possível
Largura mobile podia cair para comportamento inválido/inconsistente.

### Correção
Substituído por:

```css
var(--container)
```

Também foi criado `css_integrity_audit.py` para detectar variáveis CSS não definidas.

---

## 8. Bug visual no aviso de ambiente de teste

### Problema
O header sticky mantinha offset do banner, mas o banner não permanecia sticky.

Depois de rolar a página poderia sobrar uma faixa vazia acima do header.

### Correção
O banner passou a ser sticky no topo, mantendo o offset coerente.

---

## 9. Semântica HTML

Cinco botões da demonstração da landing não possuíam `type` explícito.

Foram corrigidos para `type="button"`.

O smoke test agora falha se surgir novamente botão sem `type`.

A tabela administrativa também recebeu `caption` acessível.

---

## 10. Layout shift / imagens

Foram adicionadas dimensões intrínsecas às imagens principais e logos onde necessário para diminuir deslocamento de layout durante carregamento.

As três imagens de prova/profissional ainda são externas ao projeto e dependem do domínio principal da RV.

---

## 11. Arquitetura pronta para cursos com outras durações

A store/configuração deixou de depender globalmente de “30 dias”.

Foi adicionado:
- `totalDays` na configuração;
- `total_days` no schema Supabase.

RV 30 continua com 30 dias, mas um futuro Projeto 2 ou 3 poderá ter outra duração.

O dashboard unificado não foi implementado agora.

---

## 12. Supabase — endurecimento do schema proposto

Adicionado:
- `total_days` por curso;
- FK de progresso para aula existente;
- FK de comentário para aula existente;
- índices adicionais;
- leitura de metadados de curso ativa/admin;
- validação compra → matrícula;
- exigência de compra aprovada;
- exigência de mesmo usuário;
- exigência de mesmo curso;
- helper para aula publicada;
- aluno só grava progresso/comentário em aula publicada;
- funções `SECURITY DEFINER` tiveram execução removida do papel `PUBLIC`;
- execução concedida ao papel autenticado onde necessário.

As mutações administrativas sensíveis continuam previstas para backend/service role.

---

## 13. Testes automatizados

Suite V6:

```text
smoke_test.py
deep_audit.py
css_integrity_audit.py
admin_security_test.js
data_flow_test.js
supabase_schema_audit.py
content_audit.py
contrast_audit.py
```

Todos passaram na rodada final.

---

## 14. Conteúdo ainda pendente

O catálogo cobre:
- Introdução;
- Dias 1 a 30.

Ainda faltam os conteúdos definitivos aprovados pela Rosangela:
- 31 URLs de vídeo;
- 30 durações finais;
- eventuais horários;
- instruções finais;
- revisão profissional de todas as atividades.

Nenhuma prescrição detalhada foi inventada para preencher essas lacunas.

---

## 15. Bloqueios para produção

Antes de vender para clientes reais:

1. conectar checkout Kiwify real;
2. implementar Auth/backend;
3. validar webhook Kiwify;
4. substituir `localStorage`;
5. configurar e-mails transacionais;
6. finalizar vídeos e conteúdo;
7. finalizar política comercial/reembolso;
8. validar Termos/Privacidade;
9. configurar analytics/consentimento;
10. testar manualmente Chrome, Safari/iPhone e Android;
11. realizar compra real de teste;
12. validar domínio/SSL/deploy;
13. decidir se imagens externas serão internalizadas.

---

## 16. Dashboard dos 3 projetos

Não implementado nesta rodada, conforme solicitado.

A V6 apenas prepara:
- cursos independentes;
- duração por curso;
- compra/matrícula por curso;
- progresso por curso;
- comentários por curso;
- admin atual filtrado no RV 30.

Assim, o dashboard geral poderá ser construído depois como camada superior, sem misturar agora o escopo do RV 30.
