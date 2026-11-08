(() => {
 'use strict'
 let fieldId=0
 const el=(tag,value,className)=>{const node=document.createElement(tag);if(value!==undefined&&value!==null)node.textContent=String(value);if(className)node.className=className;return node}
 const link=(label,href,className='text-link')=>{const node=el('a',label,className);node.href=href;return node}
 const button=(label,action,className='button button--secondary')=>{const node=el('button',label,className);node.type='button';if(action)node.addEventListener('click',async()=>{try{await action(node)}catch(error){const parent=node.parentElement;if(parent){let message=parent.querySelector('[data-ui-action-error]');if(!message){message=el('p',null,'form-error');message.dataset.uiActionError='true';message.setAttribute('role','alert');parent.append(message)}message.textContent=error.message||'Não foi possível concluir. Tente novamente.'}}});return node}
 const date=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Sem registro'
 const field=(label,name,value='',type='text',options={})=>{
  const wrapper=el('label',null,'platform-field'),caption=el('span',label),input=el(type==='textarea'?'textarea':type==='select'?'select':'input');input.name=name
  input.id='platform-field-'+(++fieldId);caption.id=input.id+'-label';wrapper.htmlFor=input.id;input.setAttribute('aria-labelledby',caption.id)
  if(type==='select')for(const option of options.choices||[]){const item=el('option',option.label);item.value=option.value;input.append(item)}
  else if(type!=='textarea')input.type=type
  if(type==='checkbox')input.checked=value===true;else input.value=String(value??'')
  for(const key of ['required','minLength','maxLength','min','max','step','accept','readOnly','disabled'])if(options[key]!==undefined)input[key]=options[key]
  wrapper.append(caption,input);return{wrapper,input}
 }
 const form=(title,fields,submitLabel,action)=>{
  const node=el('form',null,'platform-form'),heading=el('h3',title),status=el('p',null,'form-error'),submit=el('button',submitLabel,'button button--primary');submit.type='submit';status.setAttribute('role','status');status.setAttribute('aria-live','polite')
  node.append(heading,...fields.map(x=>x.wrapper),submit,status)
  node.addEventListener('submit',async event=>{event.preventDefault();if(!node.reportValidity())return;submit.disabled=true;status.textContent='Salvando…';try{await action(Object.fromEntries(new FormData(node)),status,node)}catch(error){status.textContent=error.message}finally{submit.disabled=false}})
  return node
 }
 const request=async(path,options)=>{const result=await window.RVApi.request(path,options);if(!result.ok)throw Error(result.message||'Não foi possível concluir a operação.');return result}
 const run=async(button,status,action)=>{button.disabled=true;status.textContent='Aguarde…';try{await action();status.textContent='Alteração salva.'}catch(error){status.textContent=error.message}finally{button.disabled=false}}
 const status=()=>{const node=el('p',null,'platform-status');node.setAttribute('role','status');node.setAttribute('aria-live','polite');return node}
 const table=(head,rows)=>{const wrapper=el('div',null,'platform-table-wrap'),node=el('table',null,'platform-table'),thead=el('thead'),tr=el('tr'),tbody=el('tbody');for(const item of head){const th=el('th',item);th.scope='col';tr.append(th)}thead.append(tr);for(const row of rows){const tr=el('tr');for(const [column,value]of row.entries()){const cell=el('td');cell.dataset.label=head[column];cell.append(value instanceof Node?value:el('span',value));tr.append(cell)}tbody.append(tr)}node.append(thead,tbody);wrapper.append(node);return wrapper}
 const card=(title,...children)=>{const node=el('section',null,'platform-card');node.append(el('h2',title),...children);return node}
 window.RVPlatformUI={el,link,button,date,field,form,request,run,status,table,card}
})()
