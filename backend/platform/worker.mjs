import {createQaHandler,authenticateQa,readQaBody} from '../qa/core.mjs'
import {catalog} from '../review/handler.mjs'
import {studentDashboard,openActivity,recordActivity} from './student.mjs'
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}})
export function createPlatformHandler({now=Date.now}={}){
 const base=createQaHandler()
 return{async fetch(request,env){
  try{
   const path=new URL(request.url).pathname
   if(path==='/api/config'){
    const result=await base.fetch(request,env);if(!result.ok)return result
    return response({...await result.json(),platformMode:true,activityRetentionDays:90})
   }
   if(path==='/api/student/dashboard'||path.startsWith('/api/courses/rv30/activity/')){
    if(request.method!=='GET'&&!String(env.PREVIEW_ORIGINS||'').split(',').includes(request.headers.get('origin')))return response({ok:false,code:'ORIGIN_REJECTED',message:'Origem não autorizada.'},403)
    const session=await authenticateQa(request,env),items=catalog({REVIEW_MEDIA_MANIFEST:env.QA_MEDIA_MANIFEST})
    if(!items)return response({ok:false,message:'O catálogo está em preparação.'},503)
    if(path==='/api/student/dashboard'&&request.method==='GET')return response(await studentDashboard(env,session,items,now()))
    if(request.method==='POST'&&path==='/api/courses/rv30/activity/open')return response(await openActivity(env,session,items,await readQaBody(request),now()))
    if(request.method==='POST'&&path==='/api/courses/rv30/activity/event')return response(await recordActivity(env,session,items,await readQaBody(request),now()))
    return response({ok:false,message:'Operação não disponível.'},405)
   }
   if(path==='/api/courses/rv30'&&request.method==='GET'){
    const result=await base.fetch(request,env);if(!result.ok)return result
    const session=await authenticateQa(request,env)
    const visits=await env.QA_DB.prepare('select day,position_seconds from lesson_visits where user_id=?').bind(session.user.id).all()
    return response({...await result.json(),positions:Object.fromEntries(visits.results.map(x=>[x.day,x.position_seconds]))})
   }
   return await base.fetch(request,env)
  }catch(error){return response({ok:false,code:error.code||'SERVICE_UNAVAILABLE',message:error.code?error.message:'Não foi possível concluir a operação. Tente novamente.'},error.status||503)}
 }}
}
export default createPlatformHandler()
