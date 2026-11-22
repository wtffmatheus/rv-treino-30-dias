// Transactional e-mail. Real providers only: the Cloudflare Email Service
// binding (env.EMAIL) or Resend (env.RESEND_API_KEY secret). There is no
// simulated delivery: without a provider every caller fails closed.
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
export function emailProvider(env){
 if(typeof env.EMAIL_FROM!=='string'||!/<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>$|^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$/.test(env.EMAIL_FROM.trim()))return null
 if(env.EMAIL&&typeof env.EMAIL.send==='function')return'cloudflare'
 if(typeof env.RESEND_API_KEY==='string'&&env.RESEND_API_KEY.length>=20)return'resend'
 return null
}
export async function sendEmail(env,{to,subject,html,text}){
 const provider=emailProvider(env)
 if(!provider)throw Object.assign(new Error('Envio de e-mail não configurado.'),{code:'EMAIL_NOT_CONFIGURED'})
 if(provider==='cloudflare'){
  const result=await env.EMAIL.send({to,from:env.EMAIL_FROM.trim(),subject,html,text})
  return{provider,messageId:result?.messageId||null}
 }
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM.trim(),to:[to],subject,html,text})})
 if(!response.ok)throw Object.assign(new Error('O provedor de e-mail recusou o envio.'),{code:'EMAIL_PROVIDER_'+response.status})
 const result=await response.json().catch(()=>({}))
 return{provider,messageId:result.id||null}
}
const siteOrigin=env=>String(env.EMAIL_ASSET_ORIGIN||'https://treino.rvfisiologista.com.br').replace(/\/$/,'')
function layout(env,{preheader,title,body}){
 const origin=siteOrigin(env)
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#061a22;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#e6f4f6">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#061a22;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b2a33;border:1px solid #1d4b55;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 32px 18px;background:linear-gradient(135deg,#0d3a44,#0b2a33)"><img src="${origin}/assets/brand/rv30-logo.png" width="64" height="64" alt="RV 30" style="display:block;border:0;border-radius:14px"><p style="margin:16px 0 0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#67d7f6">RV Treino 30 Dias</p></td></tr>
<tr><td style="padding:8px 32px 28px">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #1d4b55;font-size:12px;line-height:1.6;color:#8fb3ba">RV Treino 30 Dias · RV Fisiologia — Rosângela Varas, fisiologista.<br>Mensagem automática do acesso à plataforma <a href="${origin}" style="color:#67d7f6">treino.rvfisiologista.com.br</a>. Não responda a este e-mail.</td></tr>
</table></td></tr></table></body></html>`
}
export function recoveryEmail(env,{name,code}){
 const first=escape(String(name||'').trim().split(/\s+/)[0]||'aluno')
 const digits=code.split('').map(d=>`<td style="width:44px;height:56px;background:#061a22;border:1px solid #2c6a76;border-radius:12px;font-size:28px;font-weight:700;color:#ffffff;text-align:center;font-family:Consolas,Menlo,monospace">${d}</td>`).join('<td style="width:8px"></td>')
 const body=`<h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#ffffff">Seu código de recuperação</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Olá, ${first}. Use o código abaixo para definir uma nova senha no RV Treino 30 Dias.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px"><tr>${digits}</tr></table>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;text-align:center;color:#67d7f6"><strong>O código expira em 10 minutos</strong> e funciona uma única vez.</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#b7d0d5">Se você não solicitou a recuperação, ignore este e-mail. Sua senha atual continua valendo e ninguém terá acesso à sua conta sem este código.</p>`
 return{subject:`${code} é seu código do RV Treino 30 Dias`,html:layout(env,{preheader:`Código ${code} · expira em 10 minutos`,title:'Código de recuperação',body}),text:`RV Treino 30 Dias\n\nSeu código de recuperação: ${code}\nO código expira em 10 minutos e funciona uma única vez.\n\nSe você não solicitou a recuperação, ignore este e-mail. Sua senha atual continua valendo.\n\n${siteOrigin(env)}`}
}
export function invitationEmail(env,{name,link,courses,hours}){
 const first=escape(String(name||'').trim().split(/\s+/)[0]||'aluno')
 const list=courses.length?`<ul style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7">${courses.map(c=>`<li>${escape(c)}</li>`).join('')}</ul>`:''
 const body=`<h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#ffffff">Seu acesso foi liberado</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Olá, ${first}. A equipe RV Fisiologia criou sua conta. Defina sua própria senha para entrar.</p>${list}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="border-radius:12px;background:#67d7f6"><a href="${escape(link)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#061a22;text-decoration:none">Ativar meu acesso</a></td></tr></table>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#b7d0d5">O link vale por ${hours} horas e funciona uma única vez. Ninguém da equipe conhece ou define a sua senha.</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#b7d0d5">Se você não esperava este convite, ignore este e-mail.</p>`
 return{subject:'Ative seu acesso ao RV Treino 30 Dias',html:layout(env,{preheader:'Defina sua senha e comece seus treinos.',title:'Ativação de acesso',body}),text:`RV Treino 30 Dias\n\nOlá! A equipe RV Fisiologia criou sua conta.\n${courses.map(c=>'- '+c).join('\n')}\n\nDefina sua senha (válido por ${hours} horas, uso único):\n${link}\n\nSe você não esperava este convite, ignore este e-mail.`}
}
