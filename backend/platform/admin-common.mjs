import {fail,requireAdmin,rateLimit} from './auth.mjs'
export const accountKind=env=>env.PLATFORM_ENV==='production'?'commercial':'validation'
export function text(value,label,max=200,required=false){
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))fail(400,'INVALID_FIELD',`Confira ${label}.`)
 const clean=value.trim();if(required&&!clean)fail(400,'INVALID_FIELD',`Preencha ${label}.`);return clean
}
export const audit=(db,session,entity,subject,action,detail,now)=>db.prepare('insert into audit_events(id,actor_id,entity,subject_id,action,detail,at) values(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),session.user.id,entity,subject,action,JSON.stringify(detail),now)
export async function adminWrite(env,session,now){requireAdmin(session,now,true);await rateLimit(env,'admin-write:'+session.user.id,60,now,60000)}
export async function findUser(env,id){
 if(typeof id!=='string'||id.length>100)fail(404,'ACCOUNT_NOT_FOUND','Conta não localizada.')
 const row=await env.QA_DB.prepare('select u.id,u.email,u.name,u.status,u.created_at,m.kind,m.verified_at from qa_users u join identity_metadata m on m.user_id=u.id where u.id=? and m.kind=?').bind(id,accountKind(env)).first()
 if(!row)fail(404,'ACCOUNT_NOT_FOUND','Conta não localizada.');return row
}
export function revision(input){if(!Number.isInteger(input.revision)||input.revision<1)fail(400,'REVISION_REQUIRED','Reabra os dados antes de salvar.');return input.revision}
export async function readPlatformBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON_REQUIRED','Envie o formulário como JSON.')
 const reader=request.body?.getReader(),decoder=new TextDecoder();let size=0,source=''
 if(reader)for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072){await reader.cancel();fail(413,'BODY_TOO_LARGE','O formulário excede 128 KiB. Reduza os textos.')}source+=decoder.decode(value,{stream:true})}
 source+=decoder.decode();let input;try{input=JSON.parse(source)}catch{fail(400,'JSON_INVALID','O formulário contém JSON inválido.')}
 if(!input||Array.isArray(input)||typeof input!=='object')fail(400,'JSON_INVALID','Envie um objeto de formulário válido.');return input
}
