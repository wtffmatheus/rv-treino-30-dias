# Relatório de Testes — RV Projeto 30 V6

## Resultado final

**SUITE APROVADA**

### 1. Smoke test
```text
HTML verificados: 11
JS verificados: 12
OK: smoke test concluído sem erros.
```

### 2. Auditoria profunda
```text
HTML: 11 | JS: 12 | CSS rules: 630
Seletores CSS repetidos em blocos diferentes: 0
OK: deep_audit.py concluído sem erros bloqueantes.
```

### 3. Integridade CSS
```text
Variáveis definidas: 25
Variáveis usadas: 19
!important: 13
OK: nenhuma variável CSS ausente ou declaração inválida.
```

### 4. Segurança administrativa
```text
OK: guards de leitura/escrita administrativos confirmados.
OK: snapshot administrativo não expõe senha.
```

### 5. Fluxo funcional
```text
OK: compra
OK: criação/vínculo de conta
OK: login
OK: progresso
OK: comentários
OK: respostas da equipe
OK: expiração de sessão
OK: migração legada
OK: controles administrativos
OK: fail-closed do modo demo
```

### 6. Supabase
```text
Tabelas verificadas: 10
OK: auditoria estrutural do schema concluída.
```

### 7. Conteúdo
```text
Conteúdos: 31
Dias: 0–30
URLs de vídeo pendentes: 31
Durações finais pendentes: 30
OK: Introdução + Dias 1–30 sem lacunas.
```

### 8. Contraste
```text
--text / --bg: 18.52:1
--soft / --bg: 13.20:1
--muted / --bg: 7.31:1
--muted2 / --bg: 5.10:1
--accent / --bg: 10.90:1
OK: cores textuais-base >= 4.5:1.
```

## Observação sobre teste visual

A validação automatizada entregue nesta versão cobre estrutura, sintaxe, links/recursos locais, CSS, fluxo de dados, autorização administrativa, schema, conteúdo e contraste.

Ainda é necessária uma rodada manual em navegador/dispositivo real antes da produção:
- Chrome desktop;
- Safari/iPhone;
- Chrome/Android;
- tela pequena;
- rede lenta;
- checkout Kiwify real;
- compra real de baixo valor/teste;
- retorno pós-pagamento;
- login/logout/recuperação de senha de produção.
