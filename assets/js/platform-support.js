(() => {
 'use strict'
 async function mount(target,{admin=false}={}){
  const{el,button,field,form,request,run,status,date,card}=window.RVPlatformUI,base=admin?'/api/admin/support':'/api/support'
  let current=null,sequence=0
  const filters=el('form',null,'platform-filters'),query=field('Buscar atendimento','q',''),filter=field('Situação','status','all','select',{choices:[{value:'all',label:'Todos'},{value:'open',label:'Aguardando equipe'},{value:'answered',label:'Respondidos'},{value:'resolved',label:'Resolvidos'},{value:'unread',label:'Não lidos'}]}),search=el('button','Buscar','button button--secondary');search.type='submit';filters.append(query.wrapper,filter.wrapper,search)
  const feedback=status(),columns=el('div',null,'platform-support-columns'),list=el('section',null,'platform-thread-list'),detail=el('section',null,'platform-thread-detail');list.setAttribute('aria-label','Atendimentos');detail.setAttribute('aria-label','Conversa selecionada');columns.append(list,detail)
  target.replaceChildren(el('h1',admin?'Central de atendimento':'Suporte RV 30'),el('p',admin?'Responda às solicitações e acompanhe as pendências.':'Envie sua dúvida à equipe. Evite compartilhar documentos, senhas ou informações de saúde desnecessárias.','portal-lead'),filters,feedback,columns)
  async function load(){
   const result=await request(base+'?'+new URLSearchParams({q:query.input.value,status:filter.input.value}));list.replaceChildren()
   if(!result.threads.length)list.append(el('p','Nenhum atendimento neste filtro.','platform-empty'))
   for(const thread of result.threads){const item=button('',()=>open(thread.id),'platform-thread');item.append(el('strong',thread.subject),el('span',`${admin?thread.student_name+' · ':''}${{open:'Aguardando equipe',answered:'Respondida',resolved:'Resolvida'}[thread.status]}`),el('small',`${date(thread.updated_at)}${thread.unread?' · '+thread.unread+' não lida(s)':''}`));item.setAttribute('aria-pressed',String(current===thread.id));list.append(item)}
  }
  async function open(id){
   const generation=++sequence;current=id;detail.replaceChildren(el('p','Carregando conversa…'))
   try{
    const result=await request(base+'/'+id);if(generation!==sequence)return
    detail.replaceChildren(el('h2',result.thread.subject));if(result.thread.day)detail.append(el('p','Dúvida sobre o dia '+result.thread.day))
    const messages=el('ol',null,'platform-messages');for(const message of result.messages){const row=el('li',null,'platform-message '+(message.sender_role==='admin'?'from-team':''));row.append(el('strong',message.sender_role==='admin'?'Equipe RV':'Aluno'),el('p',message.body),el('small',date(message.at)));messages.append(row)}detail.append(messages)
    const reply=form('Enviar resposta',[field('Mensagem','body','','textarea',{required:true,maxLength:4000})],'Enviar',async data=>{await request(base+'/'+id,{method:'POST',body:data});await open(id);await load()});detail.append(reply)
    if(admin){const actions=el('div',null,'platform-actions'),feedback=status();for(const[label,value]of [['Marcar como resolvido','resolved'],['Reabrir atendimento','open']])actions.append(button(label,btn=>run(btn,feedback,async()=>{await request(base+'/'+id,{method:'POST',body:{action:'status',status:value}});await open(id);await load()})));detail.append(actions,feedback)}
    await load()
   }catch(error){if(generation===sequence)detail.replaceChildren(el('p',error.message,'form-error'))}
  }
  filters.addEventListener('submit',async event=>{event.preventDefault();try{await load()}catch(error){feedback.textContent=error.message}})
  if(!admin){
   const create=form('Abrir solicitação',[field('Assunto','subject','','text',{required:true,maxLength:160}),field('Dia da aula (opcional)','day',new URLSearchParams(location.search).get('day')||'','number',{min:1,max:30}),field('Mensagem','body','','textarea',{required:true,maxLength:4000})],'Enviar solicitação',async data=>{const result=await request(base,{method:'POST',body:{...data,day:data.day?Number(data.day):null}});await load();await open(result.id);create.reset()});target.append(card('Fale com a equipe',create))
  }
  try{await load();detail.append(el('p','Selecione uma conversa para consultar o histórico.','platform-empty'))}catch(error){feedback.textContent=error.message}
 }
 async function page(){
  const{el,link,button}=window.RVPlatformUI,account=window.RVApi.account();if(!account){location.replace('/entrar?next=/suporte');return}
  const admin=location.pathname.startsWith('/admin/');if(admin&&!account.roles?.includes('admin')){location.replace('/admin/entrar');return}
  const header=el('header',null,'platform-header'),brand=link('RV Fisiologia','/','platform-brand'),logo=el('img');logo.src='/public/logo-rv.png';logo.alt='';brand.prepend(logo)
  const actions=el('div',null,'platform-actions'),feedback=window.RVPlatformUI.status();actions.append(link(admin?'Administração':'Meus cursos',admin?'/admin':'/meus-cursos','button button--ghost'),button('Sair',async()=>{try{await window.RVApi.logout();location.replace('/entrar')}catch(error){feedback.textContent=error.message}}));header.append(brand,actions);const main=el('main',null,'platform-support-page');main.id='conteudo';document.body.replaceChildren(link('Pular para o conteúdo','#conteudo','skip-link'),header,feedback,main);await mount(main,{admin})
 }
 window.RVPlatformSupport={mount,page}
})()
