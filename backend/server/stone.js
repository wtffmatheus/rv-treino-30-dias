'use strict'

// Stone's documented digital gateway: Pagar.me v5, for an enabled contract only.
// This is not the OpenBank OAuth/JWE API and never treats STONE_API_KEY as interchangeable.
const PRICE_CENTS=39900
const PRODUCT='rv30'
const validId=(value,prefix)=>typeof value==='string'&&new RegExp(`^${prefix}_[a-zA-Z0-9]{6,100}$`).test(value)
class StoneError extends Error {
  constructor(code,message,status=422){super(message);this.code=code;this.status=status}
}
const reject=(code,message,status=422)=>{throw new StoneError(code,message,status)}
function checkoutURL(value,linkId){
  let parsed
  try{parsed=new URL(value)}catch{return null}
  return parsed.protocol==='https:'&&parsed.hostname==='payment-link.pagar.me'&&!parsed.port&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&parsed.pathname===`/${linkId}`?parsed.toString():null
}
function configuration(env){
  const environment=env.PAYMENT_ENVIRONMENT==='production'?'production':'test'
  const key=String(env.STONE_PAGARME_SECRET_KEY||'')
  const keyMatches=environment==='test'?/^sk_test_[a-zA-Z0-9_-]{8,}$/.test(key):/^sk_(?!test_)[a-zA-Z0-9_-]{8,}$/.test(key)
  return {environment,configured:env.PAYMENT_PROVIDER==='stone'&&env.STONE_GATEWAY==='stone_pagarme_v5'&&env.STONE_INTEGRATION_VERIFIED==='true'&&keyMatches&&validId(env.STONE_PAGARME_ACCOUNT_ID,'acc')}
}

function validateOrder(remote,local,environment,currentTime=Date.now()){
  const mismatch=()=>reject('PAYMENT_MISMATCH','O pagamento Stone não corresponde ao pedido, à conta, ao produto, ao valor ou ao ambiente esperado.')
  if(!validId(remote?.id,'or')||remote.code!==local.id||local.provider!=='stone'||local.environment!==environment||local.product_id!==PRODUCT||local.amount_cents!==PRICE_CENTS||local.currency!=='BRL'||remote.amount!==PRICE_CENTS||remote.currency!=='BRL'||remote.customer?.code!==local.user_id||local.payment_id&&local.payment_id!==remote.id)mismatch()
  const items=remote.items
  if(!Array.isArray(items)||items.length!==1||items[0].amount!==PRICE_CENTS||items[0].quantity!==1||!['RV 30','rv30'].includes(items[0].description||items[0].name))mismatch()
  const charges=remote.charges
  if(!Array.isArray(charges)||!charges.length)mismatch()
  if(charges.some(charge=>!validId(charge.id,'ch')||charge.amount!==PRICE_CENTS||charge.currency!=='BRL'))mismatch()
  let status
  // An order may stay paid after a chargeback: inspect charges first.
  if(charges.some(charge=>charge.status==='chargedback'))status='chargeback'
  else if(charges.some(charge=>charge.status==='refunded'||Number(charge.refunded_amount)>0||Number(charge.canceled_amount)>0&&(Number(charge.paid_amount)>0||Number.isFinite(Date.parse(charge.paid_at))))||remote.status==='canceled'&&local.status==='approved')status='refunded'
  else if(remote.status==='paid'){
    if(charges.filter(charge=>charge.status==='paid').length!==1||charges.find(charge=>charge.status==='paid').paid_amount!==PRICE_CENTS)mismatch()
    status='approved'
  }else if(remote.status==='canceled')status='canceled'
  else if(remote.status==='failed'||charges.every(charge=>charge.status==='failed'))status='declined'
  else if(['pending','processing'].includes(remote.status))status='pending'
  else mismatch()
  const updatedTimes=[remote.updated_at,...charges.map(charge=>charge.updated_at)].map(value=>Date.parse(value)).filter(Number.isFinite)
  if(!updatedTimes.length||Math.max(...updatedTimes)>currentTime+300000)mismatch()
  const paidDates=charges.filter(charge=>Number(charge.paid_amount)>0).map(charge=>Date.parse(charge.paid_at)).filter(Number.isFinite)
  const approvedAt=paidDates.length?new Date(Math.min(...paidDates)).toISOString():null
  if(status==='approved'&&(!approvedAt||Date.parse(approvedAt)>currentTime+300000))mismatch()
  return {status,paymentId:remote.id,updatedAt:new Date(Math.max(...updatedTimes)).toISOString(),approvedAt}
}

function createStoneClient({env=process.env,fetchImpl=globalThis.fetch,now=Date.now}={}){
  const config=configuration(env)
  /** @param {string} path @param {{method?:string,body?:unknown,links?:boolean}} [options] */
  async function request(path,{method='GET',body,links=false}={}){
    if(!config.configured)reject('STONE_NOT_CONFIGURED','A integração Stone ainda não foi habilitada e validada.',503)
    // Link sandbox has an explicit SDX host in the current paymentlinks docs.
    // Core GET routes use the v5 endpoint with a matching sk_test / production key.
    const base=links&&config.environment==='test'?'https://sdx-api.pagar.me/core/v5':'https://api.pagar.me/core/v5'
    let response,data
    try{
      response=await fetchImpl(`${base}${path}`,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Basic ${Buffer.from(`${env.STONE_PAGARME_SECRET_KEY}:`).toString('base64')}`,'Content-Type':'application/json',Accept:'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
      data=await response.json()
    }catch{reject('STONE_UNAVAILABLE','Não foi possível consultar a Stone. Tente novamente mais tarde.',503)}
    if(!response.ok)reject('STONE_UNAVAILABLE','A Stone não confirmou esta operação. Tente novamente mais tarde.',503)
    return data
  }
  async function order(id){
    if(!validId(id,'or'))reject('INVALID_PAYMENT','Identificador de pagamento inválido.')
    const result=await request(`/orders/${encodeURIComponent(id)}`)
    if(result?.id!==id)reject('PAYMENT_MISMATCH','Identificador de pagamento Stone divergente.')
    return result
  }
  async function notification(hook){
    if(!validId(hook?.id,'hook')||hook.account?.id!==env.STONE_PAGARME_ACCOUNT_ID)reject('INVALID_NOTIFICATION','Notificação inválida.',401)
    // The notification is an untrusted lookup hint, not payment evidence. V5's
    // documented GET /orders (or GET /charges) with this merchant's secret key
    // supplies the current authoritative state. Never trust body status/amount.
    if(!['order.paid','order.payment_failed','order.created','order.create','order.updated','order.canceled','charge.paid','charge.payment_failed','charge.pending','charge.updated','charge.refunded','charge.chargedback','chargeback.received'].includes(hook.event))return {ignored:true}
    let orderId=validId(hook.data?.id,'or')?hook.data.id:hook.data?.order?.id
    if(!validId(orderId,'or')){
      const chargeId=validId(hook.data?.id,'ch')?hook.data.id:hook.data?.charge?.id||hook.data?.charge_id
      if(!validId(chargeId,'ch'))reject('PAYMENT_REVIEW_REQUIRED','Não foi possível associar a notificação Stone a um pedido. Conciliação necessária.')
      const charge=await request(`/charges/${encodeURIComponent(chargeId)}`)
      if(charge.id!==chargeId||!validId(charge.order?.id,'or'))reject('PAYMENT_REVIEW_REQUIRED','Não foi possível associar a cobrança Stone a um pedido.')
      orderId=charge.order.id
    }
    return {ignored:false,hookId:hook.id,event:hook.event,remote:await order(orderId)}
  }
  async function createCheckout(local,profile,origin){
    if(local.provider!=='stone'||local.product_id!==PRODUCT||local.amount_cents!==PRICE_CENTS||local.currency!=='BRL'||local.environment!==config.environment)reject('PAYMENT_MISMATCH','Condições do pedido Stone inválidas.')
    const result=await request('/paymentlinks',{method:'POST',links:true,body:{
      type:'order',name:`RV 30 ${local.id}`,order_code:local.id,max_sessions:1,max_paid_sessions:1,
      payment_settings:{accepted_payment_methods:['credit_card'],credit_card_settings:{operation_type:'auth_and_capture',installments:[{number:1,total:PRICE_CENTS}]}},
      customer_settings:{customer:{name:String(profile.name||'Aluno').slice(0,64),email:local.buyer_email,code:local.user_id}},
      cart_settings:{items:[{name:'RV 30',amount:PRICE_CENTS,default_quantity:1}]},
      flow_settings:{success_url:`${origin}/pagamento/sucesso?pedido=${local.id}`}
    }})
    const url=validId(result?.id,'pl')&&checkoutURL(result.url,result.id)
    if(!url)reject('STONE_CHECKOUT_INVALID','A Stone não retornou um link de pagamento válido. Conciliação necessária.',503)
    return {id:result.id,url}
  }
  return {configured:config.configured,environment:config.environment,createCheckout,order,notification,validate:(remote,local)=>validateOrder(remote,local,config.environment,now())}
}
module.exports={StoneError,configuration,checkoutURL,validateOrder,createStoneClient}
