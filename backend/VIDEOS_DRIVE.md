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

## Fluxo atual, sem programar

1. Envie os videos para **01 - Videos para revisao**, pelo proprio Drive.
2. Nomeie `video aula 00.mp4` para introducao e `video aula 01.mp4` ate `video aula 30.mp4`.
3. No admin, abra **Revisao de videos** e selecione o curso.
4. Use **Importar nomes de arquivos** para selecionar as copias locais dos videos.
   O navegador le somente metadados; esse comando NAO faz upload dos videos.
5. Vincule o link privado de cada arquivo. Tambem e possivel importar um manifesto
   JSON com os links em lote, sem preencher as aulas uma a uma.
6. Abra **Revisar no Drive**, confira o arquivo e marque o aceite da aula.
7. Depois da revisao de todos os 31 arquivos, confirme a autorizacao e **Aprovar lote**.
8. **Exportar manifesto** gera a lista ordenada, com status e aprovacao. Nenhuma aula
   e publicada por esse comando. Alterar link/reimportar arquivo exige novo aceite.

Se os videos estiverem somente no Drive, forneca o link da pasta nesta conversa
para preparar um manifesto com os IDs e revisoes reais. Isso e uma operacao
solicitada por voce, nao uma sincronizacao automatica nem um monitor em segundo plano.

Formato de manifesto (exemplo de rascunho, sem arquivo real vinculado):

```json
{
  "schemaVersion": 1,
  "courseId": "rv30",
  "items": [
    { "name": "video aula 00.mp4", "driveUrl": "", "revision": "" },
    { "name": "video aula 01.mp4", "driveUrl": "", "revision": "" }
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
