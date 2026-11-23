# RV30 — faixa cardiaca no cadastro e videos no Drive

## Funcao demonstrativa implementada em 15/10/2026
Ao abrir a area do aluno autenticado, o usuario ve um formulario de frequencia cardiaca (FC). Calcula-se a FC de reserva pela formula de Karvonen:
FC treino = (FC maxima - FC de repouso) * intensidade + FC de repouso.

Faixas conforme exemplos enviados do livro "Avaliacao Cardiopulmonar e Treinamento Fisico", 2a edicao, Newton Nunes:
- sedentario: 50 a 70 por cento;
- treinado: 60 a 80 por cento;
- atleta: 65 a 85 por cento.

O formulario recebe idade, FC em repouso, FC maxima observada (opcional), condicionamento e permite comparar uma medicao atual de frequencia cardiaca. Se nao houve teste de esforco, a FC maxima e apenas estimada como 220 - idade; essa estimativa pode apresentar grandes erros individuais.

**Nao existe uma faixa exclusiva de queima de gordura** e esse calculo nao garante emagrecimento. Uma foto, selfie ou camera nao revela a frequencia cardiaca em tempo real; o exercicio depende de medida externa. Pacientes com doencas cardiovasculares ou tratamento que afete a frequencia cardiaca devem seguir prescricao e limites avaliados por profissional, em vez de um calculo automatico. O profissional de saude responsavel precisa revisar o conteudo antes do lancamento.

## Persistencia, privacidade e LGPD
Apenas no localhost e com usuario autenticado de demonstracao:
- calcula mesmo sem salvar;
- salva idade e FC somente se marcar expressamente a opcao de armazenamento local;
- diferencia dados pelo ID de usuario e permite apagar os dados;
- nao grava leituras atuais de FC.
Os dados ficam no navegador e nao sao enviados ao painel administrativo.

Para uso real: nao usar localStorage para dados sensiveis. Criar servico com Supabase Auth, permissao do proprio aluno (RLS), consentimento, politica de retencao e exclusao, criptografia e auditoria adequadas.

## Como preparar os 31 videos
Pasta de revisao existente: https://drive.google.com/drive/folders/1_YLgasIsG2iYR-3HiUNzTXxY0J6rjV__

1. Suba a introducao e as 30 aulas na pasta, nomeadas de video aula 00.mp4 a video aula 30.mp4.
2. Use o arquivo assets/data/rv30-videos-template.json e preencha driveUrl de cada arquivo com o URL de arquivo do Drive (file/d/ID/view).
3. No admin local (/admin/videos), importe o JSON, confira o mapeamento e aprove cada aula apos revisao.
4. Exporte o manifesto revisado. Ele nao publica o video nem libera o acesso para alunos.

## O que ainda falta para reproducao real
Criar backend autenticado; importar videos pela API do Drive sem expor credenciais, verificar propriedade/versao/checksum de cada arquivo e validacao editorial pelo servidor; enviar os videos para armazenamento/streaming privado adequado; autorizar o playback temporario somente quando aluno ativo e matriculado; testar iPhone, Android, banda lenta, expiracao de acesso e reenvio de links. **Nao trocar a permissao dos arquivos para publica como atalho**: Google Drive nao substitui streaming privado com controle de matricula.

## Validacoes
- npm ci && npm test && npm run check && npm run build
- npx playwright install chromium && npm run test:e2e
- python tests/content_audit.py
- Revisao profissional, politica de privacidade e testes com videos reais obrigatorios antes da publicacao.
