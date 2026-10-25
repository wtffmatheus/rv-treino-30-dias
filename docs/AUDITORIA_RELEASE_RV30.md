# Auditoria de lançamento atual — 25/10/2026

Execute `npm.cmd run audit:launch`. O resultado atual é **NO_GO** e o comando retorna um código diferente de zero de propósito. Isso não é falha de build: sinaliza que as vendas reais continuam bloqueadas.

A auditoria diferencia três tipos de evidência:

- **Código preparado:** API de autenticação e autorização, adaptador de sessão no frontend, checkout/webhook, emissão de URL temporária e migração aditiva. Esses itens podem passar na inspeção estática.
- **Verificação real pendente:** implantação que execute a API, provedor de identidade, banco/RLS, pagamento em homologação e reprodução de arquivos privados. Código existente e testes com respostas simuladas não aprovam essas verificações.
- **Inventário local atual:** zero arquivos reais vinculados, dias 1 a 30 pendentes e nenhum acesso autenticado ao Drive confirmado nesta sessão. O arquivo `assets/data/rv30-video-status.json` registra o escopo e a data dessa constatação.

Documentos históricos mencionam 29 arquivos e a ausência de `30.MOV`. Essa informação não foi revalidada nesta entrega. A auditoria atual não a usa para afirmar que há 29 arquivos disponíveis nem para afirmar que o dia 30 esteja ausente do Drive hoje.

O script preserva os campos `verdict`, `findings` e `checkedFiles` e os códigos anteriores consumidos pelos testes. Acrescenta `inventory` e `verification` para tornar explícita a diferença entre registro do repositório e integração real.

A presença de `auth-demo.js` no bundle não reprova, por si, a arquitetura: o adaptador servidor substitui o store local no modo configurado, inclusive em localhost. A autorização real continua pendente de verificação com o provedor e as políticas do ambiente. O build `dist/` contém somente arquivos estáticos e não executa a API.

Não há caminho automático para obter **GO** alterando uma flag local. Após preparar homologação, registrar evidências reais e revisar cada bloqueio, atualizar a auditoria de forma revisável. Não aplicar migrações nem ativar cobranças como efeito colateral desse comando.

Validação: `node tests/release_audit_test.js` e `node tests/launch_safety_test.js` passaram após a atualização do script. Os testes confirmam que a preparação do código não é apresentada como integração real e que o inventário histórico não substitui o atual.
