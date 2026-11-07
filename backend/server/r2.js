'use strict'
const {AwsClient}=require('aws4fetch')
class MediaError extends Error{
  constructor(code,message,status=503){super(message);this.code=code;this.status=status}
}
function validR2Lesson(lesson){
  return Number.isInteger(lesson?.day)&&lesson.day>=1&&lesson.day<=30&&
    typeof lesson.storage_path==='string'&&new RegExp(`^rv30/dia-${String(lesson.day).padStart(2,'0')}/[a-f0-9]{64}\\.mp4$`).test(lesson.storage_path)&&
    Number.isSafeInteger(lesson.storage_bytes)&&lesson.storage_bytes>0&&/^[a-f0-9]{32}$/.test(lesson.storage_etag||'')
}
/** @param {{env?:Record<string,string|undefined>,fetchImpl?:typeof fetch,now?:()=>number}} [options] */
function createR2MediaClient({env=process.env,fetchImpl=globalThis.fetch,now=Date.now}={}){
  const configured=/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID||'')&&env.R2_BUCKET_NAME==='rv30-videos-private'&&
    /^[a-zA-Z0-9]{16,128}$/.test(env.R2_ACCESS_KEY_ID||'')&&/^[a-zA-Z0-9/+_=.-]{32,256}$/.test(env.R2_SECRET_ACCESS_KEY||'')
  const base=configured?`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/`:''
  const signer=configured?new AwsClient({service:'s3',region:'auto',accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY,retries:0}):null
  async function sign(lesson,expiresIn,method='GET'){
    if(!configured)throw new MediaError('MEDIA_NOT_CONFIGURED','A reprodução privada ainda está em configuração.')
    if(!validR2Lesson(lesson))throw new MediaError('MEDIA_VERSION_INVALID','Este vídeo precisa de conferência antes da reprodução.')
    if(!Number.isInteger(expiresIn)||expiresIn<1||expiresIn>120||!['GET','HEAD'].includes(method))throw new MediaError('MEDIA_EXPIRY_INVALID','O prazo de acesso ao vídeo não é válido.')
    const url=new URL(base+lesson.storage_path)
    url.searchParams.set('X-Amz-Expires',String(expiresIn))
    const datetime=new Date(now()).toISOString().replace(/[:-]|\.\d{3}/g,'')
    return (await signer.sign(url,{method,aws:{signQuery:true,datetime}})).url
  }
  async function verify(lesson){
    try{
      const url=await sign(lesson,30,'HEAD')
      const response=await fetchImpl(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(10000)})
      return response.ok&&response.headers.get('content-type')?.split(';')[0]==='video/mp4'&&
        Number(response.headers.get('content-length'))===lesson.storage_bytes&&response.headers.get('etag')?.replace(/^"|"$/g,'')===lesson.storage_etag
    }catch{return false}
  }
  return{configured,sign,verify}
}
module.exports={createR2MediaClient,validR2Lesson,MediaError}
