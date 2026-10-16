# Admin e videos RV

## Acesso para testar

Execute `npm.cmd run dev` na raiz e abra http://127.0.0.1:8081/admin/entrar.
Usuario de demonstracao: `admin@rvfisiologia.test`. Senha de teste: `rv30admin`.
Nao use essa senha em nenhum sistema real. O admin de producao ainda precisa ser
convidado por Supabase Auth em um projeto independente do RV App, com papel admin
atribuido exclusivamente no servidor. Nao ha senha administrativa real criada.

No admin, use **Central de suporte** para mensagens privadas e **Revisao de videos**
para preparar o conteudo. Comentarios por aula continuam na ficha de cada aluno.
Para testar o aluno, faca a compra simulada pelo checkout ou adicione uma conta
de teste no admin. Abra o aluno e o admin em abas do mesmo navegador e origem.

## Pastas criadas no Google Drive

- [RV Cursos](https://drive.google.com/drive/folders/1Qtno0jnCkSI-NfEMIeF6NFjtwsB0Wpot)
- [Projeto 30 dias](https://drive.google.com/drive/folders/1JGofv9264ZGTAgRwnbWdG4bqkBVO5hq3)
- [01 - Videos para revisao](https://drive.google.com/drive/folders/1_YLgasIsG2iYR-3HiUNzTXxY0J6rjV__)
- [02 - Aprovados](https://drive.google.com/drive/folders/1FD_yO8kKJn_1W0JnBiscgG1Own3LC1Nq)
- [Referencias Instagram e marca](https://drive.google.com/drive/folders/1DJUXoJIeTT4Kjj4FyvlNXWzcqlvTHpbY)

Pasta raiz verificada pelo conector: `shared=false`, apenas permissao de proprietario.
Nao foi ativado compartilhamento publico. Subpastas criadas sem novas permissoes.
Os arquivos existentes no computador nao foram enviados automaticamente.

## Fluxo dos 30 videos MOV (pasta atual do usuario)

A ordem declarada pelo proprietario e **1.mov, 2.mov, 3.mov ... 30.mov**.
O nome do arquivo define diretamente o numero do dia:
- 1.mov = dia 01
- 2.mov = dia 02
- ...
- 30.mov = dia 30

A introducao **nao foi informada nem vinculada**. Caso exista posteriormente,
use 0.mov ou video aula 00.mp4. A introducao e opcional no processo de revisao.

1. Mantenha os 30 originais na pasta privada **01 - Videos para revisao**.
2. No admin local, abra **Revisao de videos** e selecione RV 30.
3. Baixe `/assets/data/rv30-videos-template.json` (30 itens MOV sem URLs).
4. Preencha para cada entrada `driveUrl` usando o link real do arquivo
   (e nunca o link da pasta). Os IDs e versoes devem ser consultados no Drive
   autenticado; **nao foram obtidos nesta alteracao**.
5. Importe o JSON preenchido (ou use o seletor para arquivos locais).
   A selecao local le somente nomes; **nao faz upload para o Drive**.
6. Abra **Revisar no Drive**, confira cada arquivo e marque o aceite da aula.
7. Apos revisar os 30 dias, confirme a autorizacao e clique **Aprovar lote**.
8. **Exportar manifesto** gera um documento editorial de revisao.
   **Nao publica nem disponibiliza os videos aos alunos.**

Se existir uma introducao 0.mov, ela tambem deve receber link real e aprovacao.
Qualquer reimportacao invalida a aprovacao da aula modificada.


Se os videos estiverem somente no Drive, forneca o link da pasta nesta conversa
para preparar um manifesto com os IDs e revisoes reais. Isso e uma operacao
solicitada por voce, nao uma sincronizacao automatica nem um monitor em segundo plano.

Formato de manifesto (exemplo de rascunho, sem arquivo real vinculado):

```json
{
  "schemaVersion": 1,
  "courseId": "rv30",
  "items": [
    { "name": "1.mov", "driveUrl": "", "revision": "" },
    { "name": "2.mov", "driveUrl": "", "revision": "" }
  ]
}
```

Aceita mp4, mov, webm e m4v. Nomes sem dia, dias repetidos, fora do intervalo e links
fora do dominio exato `drive.google.com` sao recusados. Importar nunca aprova.
Um manifesto aprovado e uma instrucao editorial, NAO uma credencial ou prova de
autorizacao no backend: o servidor deve validar o admin e a revisao novamente.

## Para publicar aulas de verdade

Ainda faltam: autenticacao real do admin; integracao server-side com Drive;
registro de revisoes/aceite no banco; transferencia para streaming privado;
validacao de arquivo por MIME e checksum; processamento e consulta de prontidao;
URL assinada condicionada ao entitlement; publicacao transacional das aulas.

Pipeline previsto: Drive privado -> versao/checksum -> revisao e aceite no servidor
-> streaming privado pronto -> publicar aulas -> aluno autorizado recebe playback temporario.
Arquivo atualizado invalida o aceite da versao anterior. Nao reutilizar uma
aprovacao por nome de arquivo, nem aceitar `approved: true` vindo de JSON do cliente.

Mover um arquivo para **02 - Aprovados** serve apenas a organizacao editorial;
nao libera acesso e nao dispara deploy. O Drive nao e o player das aulas pagas.
Os MP4 copiados do RV App ficam fora do build e nao foram associados ao RV 30.

## Pendente: vincular arquivos reais e entrega segura

O Google Drive nao foi acessivel por conector nesta sessao. A pasta continua
privada, e o arquivo de manifesto utiliza strings vazias de proposito para
nao inventar IDs. Para associar os 30 videos reais, conectar a conta Google
Drive ao ChatGPT e autorizar acesso a pasta ja informada, ou fornecer
manifesto contendo os 30 URLs/IDs reais.

O formato .mov e permitido **na entrada/editoria**, mas nao e garantia de
reproducao em Chrome, Firefox, Android ou Safari. Para venda real, transcodificar
em servico privado (por exemplo MP4/H.264 + HLS com perfis adaptativos), criar
controle de matricula e servir URL de reproducao temporaria apos verificar
permissoes no backend. URLs compartilhadas/publicas do Drive nao oferecem
seguranca suficiente a aulas pagas e nao devem ser expostas em assets do site.
