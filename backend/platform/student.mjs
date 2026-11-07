const error=(status,code,message)=>{throw Object.assign(new Error(message),{status,code})}
async function limitActivity(db,userId,scope,maximum,now){
 const window=Math.floor(now/60000)
 const row=await db.prepare('insert into activity_limits(user_id,scope,window,hits) values(?,?,?,1) on conflict(user_id,scope,window) do update set hits=hits+1 returning hits').bind(userId,scope,window).first()
 if(row.hits>maximum)error(429,'ACTIVITY_LIMIT','Muitas atualizações. Aguarde um minuto e reabra a aula.')
}
export async function studentDashboard(env,session,items,now=Date.now()) {
 const db=env.QA_DB,user=session.user
 const [details,visits,completed,totals]=await Promise.all([
  db.prepare('select starts_at,source from enrollment_details where user_id=?').bind(user.id).first(),
  db.prepare('select day,first_opened_at,last_opened_at,position_seconds from lesson_visits where user_id=? order by last_opened_at desc').bind(user.id).all(),
  db.prepare('select day,completed_at from qa_progress where user_id=? order by day').bind(user.id).all(),
  db.prepare('select coalesce(sum(seconds),0) as seconds from activity_daily where user_id=?').bind(user.id).first()
 ])
 const done=new Set(completed.results.map(x=>x.day)),available=items.map(x=>x.day).sort((a,b)=>a-b)
 const latest=visits.results[0]||null
 const nextDay=latest&&!done.has(latest.day)&&available.includes(latest.day)?latest.day:available.find(day=>!done.has(day))||available[0]||null
 const position=visits.results.find(x=>x.day===nextDay)?.position_seconds||0
 return {
  ok:true,course:{id:'rv30',title:'RV 30 — Treinos com Rosangela',totalDays:30,availableDays:available},
  enrollment:{status:session.hasAccess?'active':user.grant_expires?user.revoked?'revoked':'expired':'none',startsAt:details?new Date(details.starts_at).toISOString():null,expiresAt:user.grant_expires?new Date(user.grant_expires).toISOString():null,source:details?.source||'owner_validation'},
  progress:{completedDays:done.size,percent:Math.round(done.size/30*100)},
  activity:{validatedSeconds:totals.seconds,lastLessonDay:latest?.day||null,lastActivityAt:latest?new Date(latest.last_opened_at).toISOString():null},
  resume:session.hasAccess&&nextDay?{day:nextDay,positionSeconds:position}:null,
  history:visits.results.map(row=>({day:row.day,firstOpenedAt:new Date(row.first_opened_at).toISOString(),lastOpenedAt:new Date(row.last_opened_at).toISOString(),positionSeconds:row.position_seconds,completed:done.has(row.day)})),
  upcoming:available.filter(day=>!done.has(day)&&day!==nextDay).slice(0,3),
  messages:[...(items.length<30?[{kind:'pending',text:`${items.length} vídeos disponíveis. O dia 30 aguarda o arquivo e a aprovação do conteúdo.`}]:[]),{kind:'privacy',text:'O tempo de atividade considera intervalos de reprodução em uma página visível, limitados pelo servidor. Não comprova atenção ou execução do exercício. Eventos detalhados: até 90 dias; totais diários: até 400 dias.'}],
  generatedAt:new Date(now).toISOString()
 }
}
export async function openActivity(env,session,items,input,now=Date.now()) {
 if(!session.hasAccess)error(403,'ACCESS_REQUIRED','Sua matrícula não permite abrir esta aula.')
 const day=input.day,item=items.find(x=>x.day===day)
 if(!Number.isInteger(day)||!item)error(404,'VIDEO_PENDING','O vídeo deste dia ainda está pendente.')
 const db=env.QA_DB,id=crypto.randomUUID(),user=session.user
 await limitActivity(db,user.id,'open',30,now)
 const previous=await db.prepare('select position_seconds from lesson_visits where user_id=? and day=?').bind(user.id,day).first()
 const position=Math.min(previous?.position_seconds||0,Math.max(0,item.duration-1))
 await db.batch([
  db.prepare('insert into lesson_visits(user_id,day,first_opened_at,last_opened_at,position_seconds) values(?,?,?,?,?) on conflict(user_id,day) do update set last_opened_at=excluded.last_opened_at').bind(user.id,day,now,now,position),
  db.prepare('insert into activity_sessions(user_id,id,day,sequence,last_at,position_seconds,visible,playing,expires_at) values(?,?,?,0,?,?,0,0,?) on conflict(user_id) do update set id=excluded.id,day=excluded.day,sequence=0,last_at=excluded.last_at,position_seconds=excluded.position_seconds,visible=0,playing=0,expires_at=excluded.expires_at').bind(user.id,id,day,now,position,now+1800000),
  db.prepare("insert into activity_events(session_id,sequence,request_id,user_id,day,event,at,credited_seconds) values(?,0,?,?,?,'open',?,0)").bind(id,crypto.randomUUID(),user.id,day,now),
  db.prepare('delete from activity_events where at<?').bind(now-90*86400000),
  db.prepare('delete from activity_limits where window<?').bind(Math.floor(now/60000)-2),
  db.prepare('delete from activity_daily where date_utc<?').bind(new Date(now-400*86400000).toISOString().slice(0,10))
 ])
 return {ok:true,sessionId:id,sequence:0,positionSeconds:position}
}
export async function recordActivity(env,session,items,input,now=Date.now()) {
 if(!session.hasAccess)error(403,'ACCESS_REQUIRED','Seu acesso terminou ou foi revogado.')
 if(!['play','pause','heartbeat','seek','visibility','close'].includes(input.event)||typeof input.sessionId!=='string'||!Number.isInteger(input.sequence)||input.sequence<1||!Number.isFinite(input.positionSeconds)||input.positionSeconds<0||typeof input.visible!=='boolean'||typeof input.playing!=='boolean')error(400,'ACTIVITY_INVALID','Registro de atividade inválido.')
 const db=env.QA_DB,user=session.user
 await limitActivity(db,user.id,'event',120,now)
 const row=await db.prepare('select * from activity_sessions where user_id=? and id=? and expires_at>?').bind(user.id,input.sessionId,now).first()
 if(!row)error(409,'ACTIVITY_SESSION_EXPIRED','Esta sessão de aula terminou. Reabra a aula para registrar a atividade.')
 if(input.sequence<=row.sequence)return{ok:true,duplicate:true,sequence:row.sequence,creditedSeconds:0}
 if(input.sequence!==row.sequence+1)error(409,'ACTIVITY_SEQUENCE','O registro precisa ser sincronizado. Reabra a aula.')
 const item=items.find(x=>x.day===row.day)
 if(!item||input.positionSeconds>item.duration+2)error(400,'ACTIVITY_POSITION','Posição de vídeo inválida.')
 const elapsed=(now-row.last_at)/1000,advance=input.positionSeconds-row.position_seconds
 const active=row.visible===1&&row.playing===1&&input.event!=='seek'&&elapsed>0&&elapsed<=25&&advance>0.05&&advance<=elapsed*2.5+2&&(input.event!=='heartbeat'||input.visible&&input.playing)
 const credited=active?Math.min(20,Math.floor(elapsed)):0,requestId=crypto.randomUUID(),date=new Date(now).toISOString().slice(0,10)
 const results=await db.batch([
  db.prepare('insert into activity_events(session_id,sequence,request_id,user_id,day,event,at,credited_seconds) select ?,?,?,?,?,?,?,? from activity_sessions where user_id=? and id=? and sequence=? on conflict(session_id,sequence) do nothing').bind(row.id,input.sequence,requestId,user.id,row.day,input.event,now,credited,user.id,row.id,row.sequence),
  db.prepare('update activity_sessions set sequence=?,last_at=?,position_seconds=?,visible=?,playing=?,expires_at=? where user_id=? and id=? and sequence=? and exists(select 1 from activity_events where request_id=?)').bind(input.sequence,now,input.positionSeconds,input.visible?1:0,input.playing?1:0,input.event==='close'?now:now+1800000,user.id,row.id,row.sequence,requestId),
  db.prepare('update lesson_visits set position_seconds=?,last_opened_at=? where user_id=? and day=? and exists(select 1 from activity_events where request_id=?)').bind(input.positionSeconds,now,user.id,row.day,requestId),
  db.prepare('insert into activity_daily(user_id,date_utc,seconds) select ?,?,credited_seconds from activity_events where request_id=? on conflict(user_id,date_utc) do update set seconds=seconds+excluded.seconds').bind(user.id,date,requestId)
 ])
 return{ok:true,sequence:input.sequence,creditedSeconds:results[0].meta.changes?credited:0,...(results[0].meta.changes?{}:{duplicate:true})}
}
