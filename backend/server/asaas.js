'use strict'
const crypto=require('node:crypto')
const {PRICE_CENTS,CURRENCY,PROVIDER}=require('../access-terms')
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAYMENT_ID=/^pay_[a-zA-Z0-9]{6,100}$/
class AsaasError extends Error{
  constructor(code,message,status=422){super(message);this.code=code;this.status=status}
}
const reject=(code,message,status=422)=>{throw new AsaasError(code,message,status)}
function checkoutURL(value,id,environment){
  if(!UUID.test(id||''))return null
  let url
  try{url=new URL(value)}catch{return null}
  const host=environment==='test'?'sandbox.asaas.com':'asaas.com'
  if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.port||url.hash)return null
  const queryForm=url.pathname==='/checkoutSession/show'&&url.searchParams.size===1&&url.searchParams.get('id')===id
  const pathForm=url.pathname===`/checkoutSession/show/${id}`&&!url.search
  return queryForm||pathForm?url.toString():null
}
function instant(value,offset){
  if(typeof value!=='string')return null
  const parts=value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if(!parts)return null
  const [year,month,day,hour,minute,second]=parts.slice(1).map(Number)
  const calendar=new Date(Date.UTC(year,month-1,day))
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day||hour>23||minute>59||second>59)return null
  const explicit=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  const local=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
  const configuredOffset=/^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/.test(offset||'')
  const date=explicit?Date.parse(value):local&&configuredOffset?Date.parse(value.replace(' ','T')+offset):NaN
  return Number.isFinite(date)?new Date(date).toISOString():null
}
function configuration(env){
  const environment=env.PAYMENT_ENVIRONMENT==='production'?'production':'test'
  return{environment,configured:env.PAYMENT_PROVIDER==='asaas'&&env.ASAAS_INTEGRATION_VERIFIED==='true'&&
    typeof env.ASAAS_API_KEY==='string'&&env.ASAAS_API_KEY.trim().length>=16&&
    typeof env.ASAAS_WEBHOOK_TOKEN==='string'&&env.ASAAS_WEBHOOK_TOKEN.length>=32&&UUID.test(env.ASAAS_ACCOUNT_ID||'')&&
    /^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/.test(env.ASAAS_WEBHOOK_UTC_OFFSET||'')}
}
function authorizeNotification(body,token,env){
  const actual=typeof token==='string'?Buffer.from(token):Buffer.alloc(0)
  const expected=Buffer.from(env.ASAAS_WEBHOOK_TOKEN||'')
  if(expected.length<32||actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))reject('INVALID_NOTIFICATION','Notificação não autorizada.',401)
  if(!body||!/^evt_[a-zA-Z0-9_&-]{6,180}$/.test(body.id||'')||body.account?.id!==env.ASAAS_ACCOUNT_ID)reject('INVALID_NOTIFICATION','Notificação inválida.',401)
  return true
}
/** @param {any} remote @param {any} local @param {{environment?:string,event?:{dateCreated?:string,event?:string},now?:number,offset?:string}} [options] */
function validatePayment(remote,local,{environment,event,now=Date.now(),offset}={}){
  const mismatch=()=>reject('PAYMENT_MISMATCH','O pagamento não corresponde ao pedido, ao produto, ao valor ou ao ambiente esperado.')
  if(!PAYMENT_ID.test(remote?.id||'')||local.provider!==PROVIDER||local.environment!==environment||local.product_id!=='rv30'||local.amount_cents!==PRICE_CENTS||local.currency!==CURRENCY||
    !UUID.test(local.preference_id||'')||remote.checkoutSession!==local.preference_id||
    remote.externalReference&&remote.externalReference!==local.id||!Number.isFinite(remote.value)||Math.abs(remote.value*100-PRICE_CENTS)>0.00001||
    !['PIX','CREDIT_CARD'].includes(remote.billingType)||remote.currency&&remote.currency!==CURRENCY||local.payment_id&&local.payment_id!==remote.id)mismatch()
  let status
  if(['CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(remote.status)||remote.chargeback)status='chargeback'
  else if(['REFUNDED','PARTIALLY_REFUNDED'].includes(remote.status)||Array.isArray(remote.refunds)&&remote.refunds.some(refund=>refund.status==='DONE'&&Number(refund.value)>0))status='refunded'
  else if(remote.deleted===true)status='canceled'
  else if(['CONFIRMED','RECEIVED'].includes(remote.status))status='approved'
  else if(['PENDING','OVERDUE','AWAITING_RISK_ANALYSIS','AUTHORIZED','REFUND_REQUESTED','REFUND_IN_PROGRESS'].includes(remote.status))status='pending'
  else if(remote.status==='REPROVED_BY_RISK_ANALYSIS')status='declined'
  else mismatch()
  let approvedAt=local.approved_at||null
  if(status==='approved'&&!approvedAt){
    const date=instant(event?.dateCreated,offset)
    const approvalEvent=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','CHECKOUT_PAID'].includes(event?.event)
    const providerDay=remote.confirmedDate||remote.paymentDate
    // No new 365-day period from a late settlement event or an invented date.
    if(!approvalEvent||!date||!/^\d{4}-\d{2}-\d{2}$/.test(providerDay||'')||event.dateCreated.slice(0,10)!==providerDay||Date.parse(date)>now+300000)
      reject('APPROVAL_REVIEW_REQUIRED','A data original de aprovação precisa ser conferida antes da liberação.')
    approvedAt=date
  }
  return{status,paymentId:remote.id,approvedAt,updatedAt:new Date(now).toISOString()}
}
function createAsaasClient({env=process.env,fetchImpl=globalThis.fetch,now=Date.now}={}){
  const cfg=configuration(env)
  const base=cfg.environment==='test'?'https://api-sandbox.asaas.com/v3':'https://api.asaas.com/v3'
  /** @param {string} path @param {{method?:string,body?:unknown}} [options] */
  async function request(path,{method='GET',body}={}){
    if(!cfg.configured)reject('PAYMENT_NOT_CONFIGURED','O pagamento ainda está em configuração.',503)
    let response,data
    try{
      response=await fetchImpl(base+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{access_token:env.ASAAS_API_KEY,Accept:'application/json','Content-Type':'application/json','User-Agent':'RV30/1.0'},...(body===undefined?{}:{body:JSON.stringify(body)})})
      data=await response.json()
    }catch{reject('PAYMENT_UNAVAILABLE','Não foi possível consultar o pagamento. Tente novamente mais tarde.',503)}
    if(!response.ok)reject('PAYMENT_UNAVAILABLE','O provedor não confirmou esta operação. Tente novamente mais tarde.',503)
    return data
  }
  async function order(id){
    if(!PAYMENT_ID.test(id||''))reject('INVALID_PAYMENT','Identificador de pagamento inválido.')
    const payment=await request(`/payments/${encodeURIComponent(id)}`)
    if(payment?.id!==id)reject('PAYMENT_MISMATCH','O pagamento consultado não corresponde ao pedido.')
    return payment
  }
  async function notification(body,token){
    authorizeNotification(body,token,env)
    const events=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL','PAYMENT_REPROVED_BY_RISK_ANALYSIS','PAYMENT_DELETED','CHECKOUT_PAID']
    if(!events.includes(body.event))return{ignored:true}
    let remote
    if(PAYMENT_ID.test(body.payment?.id||''))remote=await order(body.payment.id)
    else if(body.event==='CHECKOUT_PAID'&&UUID.test(body.checkout?.id||'')){
      const found=await request(`/payments?${new URLSearchParams({checkoutSession:body.checkout.id,limit:'2'})}`)
      if(!Array.isArray(found?.data)||found.data.length!==1)reject('PAYMENT_REVIEW_REQUIRED','As cobranças deste checkout precisam de conferência.')
      remote=await order(found.data[0].id)
    }else reject('INVALID_NOTIFICATION','Cobrança não identificada na notificação.')
    if(!UUID.test(remote.checkoutSession||''))reject('PAYMENT_MISMATCH','Checkout não reconhecido.')
    return{ignored:false,eventId:body.id,checkoutId:remote.checkoutSession,remote,event:body}
  }
  async function createCheckout(local){
    if(local.provider!==PROVIDER||local.environment!==cfg.environment||local.product_id!=='rv30'||local.amount_cents!==PRICE_CENTS||local.currency!==CURRENCY)reject('PAYMENT_MISMATCH','Condições do pedido inválidas.')
    const origin=new URL(env.PUBLIC_SITE_URL).origin
    const created=await request('/checkouts',{method:'POST',body:{billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:60,externalReference:local.id,
      callback:{successUrl:`${origin}/pagamento/sucesso?pedido=${local.id}`,cancelUrl:`${origin}/checkout/rv30`,expiredUrl:`${origin}/checkout/rv30`},
      items:[{name:'RV 30',description:'Programa de 30 dias com 365 dias de acesso',externalReference:'rv30',quantity:1,value:PRICE_CENTS/100}]}})
    if(!UUID.test(created?.id||''))reject('CHECKOUT_INVALID','O provedor não retornou um checkout válido.',503)
    const host=cfg.environment==='test'?'sandbox.asaas.com':'asaas.com'
    const url=checkoutURL(created.link||`https://${host}/checkoutSession/show?id=${created.id}`,created.id,cfg.environment)
    if(!url)reject('CHECKOUT_INVALID','O provedor não retornou um endereço de pagamento válido.',503)
    return{id:created.id,url}
  }
  return{configured:cfg.configured,environment:cfg.environment,order,notification,createCheckout,
    checkoutURL:(url,id)=>checkoutURL(url,id,cfg.environment),
    validate:(remote,local,event)=>validatePayment(remote,local,{environment:cfg.environment,event,now:now(),offset:env.ASAAS_WEBHOOK_UTC_OFFSET})}
}
module.exports={AsaasError,configuration,authorizeNotification,checkoutURL,instant,validatePayment,createAsaasClient}
