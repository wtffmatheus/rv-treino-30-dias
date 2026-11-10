# Liberação automática nas próximas compras — RV 30

> Histórico da API Node/Supabase anterior. A plataforma em homologação usa
> Workers/D1/R2 e ainda não tem checkout comercial conectado. O proprietário
> escolheu Mercado Pago em 08/11/2026; consulte [a decisão atual](MERCADO_PAGO_RV30.md)
> e [o plano integral](PLATAFORMA_INTEGRAL_RV30.md). Asaas e URLs assinadas citados
> abaixo não descrevem a entrega da nova API, que autoriza cada GET/HEAD/Range.

O proprietário confirmou que quer preparar as **próximas compras**, sem importar
compradores anteriores. O destino é a área do aluno do RV 30, com liberação por
pagamento aprovado. A área privada de revisão continua separada.

## Fluxo preparado

1. Aluno cria e confirma a conta e entra pelo Supabase Auth.
2. Servidor cria o checkout Asaas de compra única de R$ 399, vinculado à conta.
3. Webhook autenticado consulta a cobrança atual e valida pedido, conta do
   provedor, ambiente, produto e valor. A transação registra a primeira aprovação
   e concede 365 dias de acesso, sem estender o prazo em replays.
4. A conta, o catálogo e a reprodução exigem acesso vigente vinculado a um pedido
   aprovado do próprio aluno. Valor, produto, provedor, ambiente e data precisam
   corresponder; um direito antigo marcado ativo não substitui essa verificação.
5. Para cada vídeo R2 publicado, o servidor confere dia, chave da versão, tamanho,
   tipo e ETag com HEAD autenticado. Reconfere o acesso após essa consulta e emite
   um GET assinado SigV4 por até 120 segundos, limitado ao vencimento do curso.
6. Reembolso ou contestação revogam o acesso. Vencimento impede novas URLs, aulas
   e progresso. O link já emitido pode continuar válido pelo seu curto prazo;
   arquivos já recebidos pelo navegador não podem ser recuperados do dispositivo.

O catálogo enviado ao aluno não inclui chaves R2, tamanhos, ETags ou segredos.
O GET assinado é fornecido apenas ao aluno autorizado. A política de mídia do
site permite o endpoint S3 desta conta; não foi aberto um domínio público do bucket.
O adaptador Supabase Storage anterior permanece disponível para aulas desse tipo.

## Importação dos 29 vínculos

Foi acrescentada a migração proposta
`backend/migrations/20261107_rv30_r2_delivery.sql`, a executar depois da fundação
e da migração de 365 dias, somente após inspeção e backup. Ela acrescenta provedor,
tamanho, ETag e duração. A constraint exige que o número do dia corresponda à
chave R2. Uma tabela privada preserva o registro anterior quando o vínculo muda.
Nenhuma dessas migrações foi aplicada ao Supabase real.

O gerador `scripts/prepare-r2-lesson-import.js` exige manifesto e recibo remoto
verificados. Recusa versões, dias, tamanhos, hashes ou recibos divergentes. Gera
uma transação SQL sem conectá-la ao banco. Preserva títulos, descrições, progresso,
usuários, pagamentos e matrículas. Repetir o mesmo lote não duplica o histórico.

```powershell
node scripts/prepare-r2-lesson-import.js MANIFESTO_PRIVADO RECIBO_PRIVADO output/vinculos.private.sql --publish
```

`--publish` prepara o estado publicado das aulas no SQL; sem esse argumento, o
estado preparado é rascunho. Isso nunca ativa vendas ou concede acesso. O lote
real de 29 dias foi gerado em `output/rv30-media/link-buyers.private.sql`, ignorado
pelo Git. O dia 30 não foi criado, duplicado ou renumerado. O SQL continua **não
executado**; conferir a origem e o conteúdo antes da aplicação em staging.

## Configuração que falta para ativar

- **Supabase:** conexão ativa com o projeto autorizado, backup, aplicação das
  três migrações e do lote privado; testes de e-mail, sessões e contas distintas.
- **R2:** credencial S3 `Object Read only`, restrita exclusivamente ao bucket
  `rv30-videos-private`, configurada no servidor. Usar `R2_ACCOUNT_ID`,
  `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` conforme `.env.example`.
  A conexão Cloudflare atual retorna 403 para administração de API tokens; não
  foi ampliada nem foi criada uma chave com permissões gerais. Não enviar chaves
  na conversa nem colocá-las no frontend ou no Git.
- **Asaas:** o proprietário ainda não tem conta. Criar a conta, conferir a proposta
  sem antecipação e homologar Pix/cartão, confirmação, reembolso e contestação na
  sandbox. Segredos ficam no ambiente protegido; vendas continuam desligadas.
- **Runtime:** hospedar a API real. `dist/` é estático e não executa Node. O handler
  atual exige um processo Node persistente atrás de TLS confiável; antes de usar
  Functions ou múltiplas instâncias, substituir sessões e limites em memória por
  armazenamento compartilhado. Não basta copiar o handler para uma Function.
- **Conteúdo e contratação:** localizar o dia 30, comparar versões com o Drive,
  revisar conteúdo e completar dados do fornecedor/condições antes de vender.

Depois de configurar, homologar compra sandbox → acesso somente ao comprador →
vídeo privado → progresso → expiração/reembolso/contestação → acesso bloqueado.
Só então ativar produto e vendas e publicar a plataforma de compradores. O pedido
atual autoriza preparar essa entrega, sem inventar contas, pagamentos ou evidências.

## Evidências e limites dos testes

- 38 verificações do backend, incluindo compra pendente/reembolsada/contestada,
  outro aluno, outro ambiente, valor divergente, conferência manual, catálogo
  sem chaves e reembolso durante a consulta ao Storage.
- R2: assinatura SigV4 conferida por implementação HMAC independente, TTL,
  métodos somente leitura, HEAD e metadados divergentes, falha de configuração
  e geração privada dos vínculos. Usa credenciais fictícias, sem S3 real.
- 11 contratos PostgreSQL/PGlite, incluindo as três migrações integrais e o lote
  gerado: reexecução, isolamento, histórico e preservação de título e progresso.
- O lote privado real dos 29 dias também foi executado duas vezes em PostgreSQL
  local descartável: 29 vínculos e 672.319.279 bytes, sem criar o dia 30 e sem
  modificar qualquer banco remoto.
- Navegador: fluxo com API simulada valida que a política de mídia permite o
  endpoint R2 desta conta. Não comprova pagamento ou autorização de aluno reais.
  A regressão completa de 46 testes passou.

O teste anterior de reprodução real via R2 pertence à área de revisão; não é
evidência de compra real ou do novo caminho S3 dos alunos. Não houve cobrança,
migração remota, concessão manual de matrícula ou ativação de venda nesta etapa.

Fontes técnicas: [URLs temporárias R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
e [credenciais e permissões R2](https://developers.cloudflare.com/r2/api/tokens/).
