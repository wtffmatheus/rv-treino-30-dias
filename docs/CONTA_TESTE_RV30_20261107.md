# RV 30 — publicação e conta de validação, 07/11/2026

> Registro histórico da versão antiga. A nova plataforma usa as duas contas
> reais indicadas depois pelo proprietário e permanece em staging. A página
> privada `/plataforma` do serviço de revisão permite ao responsável definir
> senhas fortes dessas contas após autenticação Cloudflare Access. Ela não altera
> a versão antiga do domínio principal. Consulte o [estado atual e pendências](PLATAFORMA_INTEGRAL_RV30.md).

O responsável autorizou publicar a alteração visual RV 30 no domínio principal e liberar `aluno@rv.com.br` para validar o site como aluno. A decisão anterior de aguardar a plataforma completa foi substituída para esse escopo. Vendas reais continuam desativadas.

## Como entrar

1. Abra https://revisao-treino.rvfisiologista.com.br/conta-teste e autentique-se com o e-mail administrativo já autorizado no Cloudflare Access. O código de acesso chega ao e-mail do responsável.
2. Defina uma senha de 12 a 128 caracteres para a conta de aluno. A senha fica protegida no servidor; não há senha pública padrão.
3. Abra https://treino.rvfisiologista.com.br/entrar e entre com `aluno@rv.com.br` e a senha definida.
4. Acesse seus cursos, reproduza as aulas e marque o progresso. O progresso é persistido no servidor. Alterar a senha pela página privada encerra todas as sessões anteriores.

## Escopo da liberação

- Conta exclusiva de aluno, identificada como teste, sem privilégios administrativos e sem registrar pedido ou pagamento.
- Liberação de validação por 365 dias, iniciada em 07/11/2026. A data de expiração é verificada pelo servidor em cada acesso.
- Vídeos dos dias 1 a 29 em armazenamento R2 privado, convertidos em MP4 H.264/AAC. O dia 30 aguarda o arquivo original. A correspondência editorial entre cada vídeo e as instruções do treino ainda deve ser aprovada pelo responsável.
- Sessões com cookie HttpOnly/Secure, senha derivada com PBKDF2 e segredo separado, limite de tentativas, proteção de origem nas alterações e autorização antes de cada requisição de vídeo, incluindo ranges.
- Banco D1 isolado para usuário, liberação, sessões e progresso de validação. Não substitui a homologação comercial de autenticação, compras, suporte e pagamentos.
- Comentários, suporte persistente, cadastro público e recuperação pública não estão liberados neste acesso de validação. Não envie dados reais de clientes para esse ambiente.

## Implantação e operação

O frontend Vercel encaminha `/api/*` ao Worker `rv30-qa-access`; esse Worker atende somente a conta de validação configurada. O Worker `rv30-revisao`, protegido pelo Access, altera a senha por Service Binding para a entrada RPC `QaAdmin`. Não existe endpoint HTTP público de criação de conta ou definição de senha.

Configuração reproduzível: `wrangler.qa.jsonc`, `wrangler.review.jsonc` e `backend/qa/schema.sql`. Os segredos `QA_EMAIL`, `QA_PASSWORD_PEPPER`, `QA_MEDIA_MANIFEST`, `ADMIN_EMAIL` e `REVIEW_MEDIA_MANIFEST` ficam no ambiente protegido. Nunca publicar segredos, hashes, cookies ou manifestos privados no Git.

Antes de ativar o backend comercial, substituir conscientemente o encaminhamento da API de validação, configurar o banco/identidade comercial e homologar compras, acesso de 365 dias, expiração e revogação por reembolso/contestação. Não habilitar vendas alterando apenas uma flag.

Verificação: testes locais com D1/R2 confirmam login, cookie, origem, permissão, expiração, revogação, ranges e progresso. Verificação HTTP real confirma os 29 objetos privados, login e progresso com a conta de validação. A credencial temporária de automação é revogada após a verificação; o responsável define a senha final na página privada. Evidências locais ficam em `output/`, fora do Git e do build público.
