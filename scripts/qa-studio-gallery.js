'use strict'
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../output/codex-redesign-completo')
const state = JSON.parse(fs.readFileSync(path.join(root, 'qa/validacao.json'), 'utf8'))
const groups = {
  'Acesso e páginas públicas': {
    landing: 'Apresentação do RV30', 'login-aluno': 'Entrada do aluno', 'login-equipe': 'Entrada da equipe',
    'ativacao-privada': 'Ativação por convite', 'recuperacao-privada': 'Recuperação por convite',
    'cadastro-publico': 'Cadastro por e-mail · configuração alternativa', 'recuperacao-email': 'Recuperação por e-mail · configuração alternativa',
    termos: 'Termos', privacidade: 'Privacidade', '404': 'Página não encontrada'
  },
  'Aluno e treinamento': {
    'dashboard-aluno': 'Próximo treino e progresso', jornada: 'Plano de 30 dias', historico: 'Histórico e conquistas',
    player: 'Player da aula', calculadora: 'Calculadora cardíaca', 'aula-pendente': 'Dia 30 pendente',
    'suporte-aluno': 'Atendimento do aluno', 'conversa-aluno': 'Conversa com a equipe', 'acesso-revogado': 'Matrícula revogada'
  },
  'Administração': {
    'admin-visao-geral': 'Visão geral', 'admin-alunos': 'Alunos e filtros', 'admin-perfil': 'Ficha do aluno',
    'admin-curso': 'Curso e aulas', 'admin-previa': 'Prévia da aula', 'admin-biblioteca': 'Biblioteca',
    'admin-revisao-midia': 'Conferência de mídia', 'admin-envio': 'Envio de arquivo', 'admin-atendimento': 'Atendimento',
    'admin-conversa': 'Conversa administrativa', 'admin-pedidos': 'Pedidos', 'admin-auditoria': 'Auditoria'
  },
  'Inscrição e demonstração local': {
    'checkout-fechado': 'Checkout com vendas fechadas', 'checkout-formulario': 'Formulário de compra de teste',
    'criar-acesso': 'Criar acesso após compra de teste', 'cursos-demo': 'Cursos da conta de demonstração',
    'suporte-demo-aluno': 'Suporte da conta de demonstração', 'admin-demonstracao': 'Painel de demonstração',
    'revisao-de-videos': 'Revisor de vídeos', 'suporte-demo-equipe': 'Suporte da equipe de demonstração'
  }
}
const archive = {landing:'landing', 'login-aluno':'login', 'checkout-formulario':'checkout', 'dashboard-aluno':'aluno-dashboard', player:'player', 'admin-visao-geral':'admin-dashboard'}
const recordings = {'acessos-e-publico':'Acessos e páginas públicas','aluno-player-e-suporte':'Aluno, aulas e suporte',administracao:'Console administrativo','checkout-e-rotas-locais':'Checkout e demonstração','percurso':'Percurso guiado pelas telas'}
const captured = new Set(state.shots.map(shot => shot.id))
const screens = Object.entries(groups).map(([title, items]) => [title, Object.entries(items).filter(([id]) => captured.has(id))])
const listed = new Set(screens.flatMap(([,items]) => items.map(([id]) => id)))
for (const id of captured) if (!listed.has(id)) throw Error('Captura sem título: '+id)
const options = screens.map(([title, items]) => '<optgroup label="'+title+'">'+items.map(([id,label]) => '<option value="'+id+'">'+label+'</option>').join('')+'</optgroup>').join('')
const videos = Object.entries(recordings).filter(([id]) => fs.existsSync(path.join(root,'videos',id+'.webm'))).map(([id,label]) => '<figure><figcaption>'+label+'</figcaption><video controls playsinline preload="metadata" src="../videos/'+id+'.webm"></video></figure>').join('')
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RV30 · Comparação de telas</title>
<style>*{box-sizing:border-box}body{background:#071621;color:#f3f8fc;font:16px/1.5 system-ui;margin:0}main{width:min(1320px,94%);margin:2rem auto 5rem}h1{font-size:clamp(2rem,5vw,4rem);letter-spacing:-.06em;line-height:1.05;margin:.5em 0}h2{margin-top:2rem}label,figcaption{display:block;font-weight:650;margin:0 0 .6rem}a{color:#9fe6fa}a:focus-visible,select:focus-visible{outline:3px solid #67d7f6;outline-offset:4px}select{font:inherit;max-width:100%;border:1px solid #547186;background:#152b3d;color:inherit;border-radius:.5rem;padding:.7rem}section{margin:2rem 0}figure{margin:0;min-width:0}img,video{display:block;width:100%;height:auto;border:1px solid #385468}figure a{display:inline-block;margin:.65rem .8rem .65rem 0}.shots{display:grid;grid-template-columns:minmax(0,3fr) minmax(180px,1fr);gap:1rem}.videos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem}small{color:#a9bbce}@media(max-width:680px){.shots,.videos{grid-template-columns:1fr}.shots figure:last-child{max-width:390px}}</style>
<main><header><small>RV Fisiologia · Validação local</small><h1>RV30 em tela</h1><p>${captured.size} telas e estados registrados no Chromium. As áreas privadas usam contas e mídia de teste.</p></header>
<label for="screen">Tela ou estado</label><select id="screen">${options}</select><section class="shots" aria-label="Comparação de larguras"></section>
<h2>Interações gravadas</h2><div class="videos">${videos}</div><p><a href="../qa/validacao.json">Abrir medições por tela e largura</a></p></main>
<script>
const archive=${JSON.stringify(archive)},select=document.querySelector('select'),shots=document.querySelector('.shots');
function render(){const id=select.value;shots.replaceChildren();for(const [key,title] of [['desktop','Desktop · 1440 × 900'],['mobile','Celular · 390 × 844']]){
const box=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=title;img.alt=select.selectedOptions[0].text+' — '+title;img.src='../screenshots/'+key+'/'+id+'.png';box.append(caption,img);
const links=[['Imagem original',img.src],['Página inteira','../qa/'+id+'-'+key+'-inteira.png']];if(archive[id])links.push(['Captura anterior','../../rv30-redesign-final/screenshots/'+key+'/'+archive[id]+'-full.png']);for(const [text,url] of links){const a=document.createElement('a');a.textContent=text;a.href=url;box.append(a)}shots.append(box)}}
const requested=location.hash.slice(1);if([...select.options].some(o=>o.value===requested))select.value=requested;
select.addEventListener('change',()=>{history.replaceState(null,'','#'+select.value);render()});render();
</script></html>`
fs.mkdirSync(path.join(root, 'comparativos'), {recursive:true})
fs.writeFileSync(path.join(root, 'comparativos/index.html'), html)

