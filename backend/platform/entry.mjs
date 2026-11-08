import {WorkerEntrypoint} from 'cloudflare:workers'
import handler from './worker.mjs'
import {setOwnerValidationPassword} from './owner-control.mjs'
export class PlatformOwnerControl extends WorkerEntrypoint{
 async setValidationPassword(ownerEmail,role,password){return setOwnerValidationPassword(this.env,ownerEmail,role,password)}
}
export default handler
