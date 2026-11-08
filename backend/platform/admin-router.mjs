import {streamVideo} from '../review/handler.mjs'
import {fail,requireAdmin} from './auth.mjs'
import {adminWrite,audit,accountKind,readPlatformBody} from './admin-common.mjs'
import {students,studentDetail,createStudent,editStudent,studentInvite} from './admin-students.mjs'
import {changeAccess} from './admin-access.mjs'
import {supportList,supportRead,supportReply} from './support.mjs'
import {metrics,auditLog,studentReport} from './metrics.mjs'
import {contentRead,changeContent,versions} from './content.mjs'
import {mediaList,uploadBegin,uploadPart,uploadFinish,uploadCancel,uploadList,mediaReview,privateImage} from './media.mjs'
export async function adminRoute(request,env,session,now,response){
 requireAdmin(session,now);const url=new URL(request.url),path=url.pathname,method=request.method,read=()=>readPlatformBody(request)
 if(path==='/api/admin/metrics'&&method==='GET')return response(await metrics(env,url,now))
 if(path==='/api/admin/students'){
  if(method==='GET')return response(await students(env,url,now))
  if(method==='POST')return response(await createStudent(env,session,await read(),now),201)
 }
 let match=path.match(/^\/api\/admin\/students\/([\w-]+)$/)
 if(match){
  if(method==='GET')return response(await studentDetail(env,match[1]))
  if(method==='PATCH'){
   const input=await read();return response(input.action?await editStudent(env,session,match[1],input,now):await changeAccess(env,session,match[1],input,now))
  }
 }
 if(path==='/api/admin/identity-tokens'&&method==='POST'){const input=await read();return response(await studentInvite(env,session,input.userId,input,now))}
 if(path==='/api/admin/report'&&method==='GET'){
  await adminWrite(env,session,now);const csv=await studentReport(env);await audit(env.QA_DB,session,'report',null,'student_report_exported',{limit:5000},now).run()
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="rv30-alunos.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }
 if(path==='/api/admin/audit'&&method==='GET')return response(await auditLog(env,url))
 if(path==='/api/admin/orders'&&method==='GET'){
  const rows=await env.QA_DB.prepare('select o.id,o.user_id,o.provider,o.status,o.amount_cents,o.currency,o.created_at,o.paid_at,o.updated_at from platform_orders o join identity_metadata m on m.user_id=o.user_id where m.kind=? order by o.created_at desc limit 100').bind(accountKind(env)).all()
  return response({ok:true,orders:rows.results,paymentsAvailable:false,message:'Gateway e webhook não homologados. Não é possível registrar pagamento ou executar reembolso por este painel.'})
 }
 if(path==='/api/admin/support'&&method==='GET')return response(await supportList(env,session,true,url))
 match=path.match(/^\/api\/admin\/support\/([\w-]+)$/)
 if(match){if(method==='GET')return response(await supportRead(env,session,match[1],true,now));if(method==='POST')return response(await supportReply(env,session,match[1],await read(),true,now))}
 if(path==='/api/admin/content'&&method==='GET')return response(await contentRead(env))
 match=path.match(/^\/api\/admin\/content\/(course|lesson)\/(rv30|[1-9]|[12]\d|30)(\/versions)?$/)
 if(match){const id=match[1]==='lesson'?Number(match[2]):match[2];if(match[3]&&method==='GET')return response(await versions(env,match[1],id));if(!match[3]&&method==='PUT')return response(await changeContent(env,session,match[1],id,await read(),now))}
 if(path==='/api/admin/media'&&method==='GET')return response(await mediaList(env))
 if(path==='/api/admin/uploads'){
  if(method==='POST')return response(await uploadBegin(env,session,await read(),now),201)
  if(method==='GET')return response(await uploadList(env,session))
 }
 match=path.match(/^\/api\/admin\/uploads\/([\w-]+)(?:\/parts\/(\d+)|\/(finish|cancel))$/)
 if(match){
  if(match[2]&&method==='PUT')return response(await uploadPart(env,session,match[1],Number(match[2]),request,now))
  if(match[3]&&method==='POST')return response(await(match[3]==='finish'?uploadFinish:uploadCancel)(env,session,match[1],now))
 }
 match=path.match(/^\/api\/admin\/media\/([\w-]+)(\/preview)?$/)
 if(match){
  if(!match[2]&&method==='PATCH')return response(await mediaReview(env,session,match[1],await read(),now))
  if(match[2]&&['GET','HEAD'].includes(method)){
   const row=await env.QA_DB.prepare("select * from media_records where id=? and state in('review','ready')").bind(match[1]).first();if(!row)fail(404,'MEDIA_NOT_FOUND','Mídia não localizada.')
   return row.kind==='video'?streamVideo(request,env.VIDEOS,{key:row.object_key,bytes:row.bytes}):privateImage(request,env,row.id,true)
  }
 }
 fail(404,'API_NOT_FOUND','Operação administrativa não localizada.')
}
