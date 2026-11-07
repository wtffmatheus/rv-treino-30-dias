import {WorkerEntrypoint} from 'cloudflare:workers'
import {createQaHandler,setTestPassword} from './core.mjs'
export class QaAdmin extends WorkerEntrypoint{
 async setPassword(password){return setTestPassword(this.env,password)}
 async status(){const row=await this.env.QA_DB.prepare('select password_hash is not null as ready from qa_users where email=?').bind(this.env.QA_EMAIL.toLowerCase()).first();return{exists:!!row,passwordReady:row?.ready===1}}
}
export default createQaHandler()
