import {fail} from './auth.mjs'
import {accountKind} from './admin-common.mjs'
export async function metrics(env,url,now){
 const days=Number(url.searchParams.get('days')||30);if(![7,30,90,365].includes(days))fail(400,'PERIOD_INVALID','Escolha um período de 7, 30, 90 ou 365 dias.')
 const db=env.QA_DB,kind=accountKind(env),since=now-days*86400000,scope="select u.id from qa_users u join identity_metadata m on m.user_id=u.id join user_roles r on r.user_id=u.id and r.role='student' where m.kind=?"
 const first=(sql,args=[kind])=>db.prepare(sql).bind(...args).first(),all=(sql,args=[kind])=>db.prepare(sql).bind(...args).all()
 const [users,enrollments,progress,activity,starts,lessons,support,orders,series,newUsers,active]=await Promise.all([
  first(`select count(*) as total,sum(status='blocked') as blocked from qa_users where id in(${scope})`),
  first(`select coalesce(sum(e.revoked=0 and e.starts_at<=? and e.expires_at>? and u.status='active'),0) as active,coalesce(sum(e.expires_at<=?),0) as expired,coalesce(sum(e.revoked=1),0) as revoked from enrollments e join qa_users u on u.id=e.user_id where e.user_id in(${scope})`,[now,now,now,kind]),
  first(`select count(*) as total,coalesce(sum(completed_at>=?),0) as period from qa_progress where user_id in(${scope})`,[since,kind]),
  first(`select coalesce(sum(seconds),0) as seconds from activity_daily where date_utc>=? and user_id in(${scope})`,[new Date(since).toISOString().slice(0,10),kind]),
  first(`select count(*) as total from lesson_visits where first_opened_at>=? and user_id in(${scope})`,[since,kind]),
  all(`select v.day,count(*) as started,sum(case when p.day is not null then 1 else 0 end) as completed from lesson_visits v left join qa_progress p on p.user_id=v.user_id and p.day=v.day where v.user_id in(${scope}) and v.first_opened_at>=? group by v.day order by started desc,v.day`,[kind,since]),
  first(`select count(*) as pending from support_threads where status!='resolved' and user_id in(${scope})`),
  all(`select status,count(*) as total,coalesce(sum(case when status='paid' then amount_cents else 0 end),0) as confirmed_cents from platform_orders where user_id in(${scope}) and created_at>=? group by status`,[kind,since]),
  all(`select date_utc,sum(seconds) as seconds from activity_daily where user_id in(${scope}) and date_utc>=? group by date_utc order by date_utc`,[kind,new Date(since).toISOString().slice(0,10)]),
  first(`select count(*) as total from qa_users where id in(${scope}) and created_at>=?`,[kind,since]),
  first(`select count(distinct user_id) as total from identity_events where user_id in(${scope}) and action='login' and at>=?`,[kind,since])
 ])
 const total=users.total,completedPeople=await first(`select count(*) as total from (select user_id from qa_progress where user_id in(${scope}) group by user_id having count(*)=30)`)
 return{ok:true,days,generatedAt:new Date(now).toISOString(),kind,totals:{students:total,blocked:users.blocked||0,activeEnrollments:enrollments.active,expiredEnrollments:enrollments.expired,revokedEnrollments:enrollments.revoked,newStudents:newUsers.total,activeStudents:active.total,lessonsStarted:starts.total,lessonsCompleted:progress.period,averageProgress:total?Math.round(progress.total/(total*30)*100):0,completionRate:total?Math.round(completedPeople.total/total*100):0,averageActivitySeconds:total?Math.round(activity.seconds/total):0,pendingSupport:support.pending},lessons:lessons.results.map(x=>({...x,notCompleted:x.started-x.completed})),activity:series.results,orders:orders.results,paymentsAvailable:false,definitions:{activity:'Reprodução visível validada pelo servidor; não comprova exercício ou atenção.',notCompleted:'Aula iniciada sem conclusão marcada. Não é prova de abandono.',period:'Inícios, conclusões, atividade, novos cadastros e logins usam o período. Matrículas e progresso médio mostram o estado atual.'}}
}
export async function auditLog(env,url){
 const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>10000)fail(400,'PAGE_INVALID','Confira a página.')
 const rows=await env.QA_DB.prepare('select a.id,a.entity,a.subject_id,a.action,a.detail,a.at,u.name as actor from audit_events a join qa_users u on u.id=a.actor_id join identity_metadata m on m.user_id=a.actor_id where m.kind=? order by a.at desc,a.id limit 50 offset ?').bind(accountKind(env),(page-1)*50).all()
 return{ok:true,events:rows.results.map(x=>({...x,detail:JSON.parse(x.detail)})),page,pageSize:50}
}
export async function studentReport(env){
 const rows=await env.QA_DB.prepare(`select u.name,u.email,u.status,e.source,e.starts_at,e.expires_at,e.revoked,(select count(*) from qa_progress p where p.user_id=u.id) as completed from qa_users u join identity_metadata m on m.user_id=u.id join user_roles r on r.user_id=u.id and r.role='student' left join enrollments e on e.user_id=u.id where m.kind=? order by u.created_at desc limit 5000`).bind(accountKind(env)).all()
 const cell=value=>'"'+String(value??'').replace(/^(?:\s*[=+@\-]|[\t\r])/u,"'$&").replaceAll('"','""')+'"'
 return '\uFEFF'+[['Nome','E-mail','Conta','Origem','Início UTC','Expiração UTC','Revogado','Aulas concluídas'],...rows.results.map(x=>[x.name,x.email,x.status,x.source,x.starts_at?new Date(x.starts_at).toISOString():'',x.expires_at?new Date(x.expires_at).toISOString():'',x.revoked,x.completed])].map(row=>row.map(cell).join(';')).join('\r\n')
}
