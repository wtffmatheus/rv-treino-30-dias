'use strict'
// Real PostgreSQL SQL/PLpgSQL/RLS engine in memory. Supabase-managed auth/storage
// schemas below are minimal test fixtures, not a connection to a customer base.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {PGlite}=require('@electric-sql/pglite')
const {accessExpiresAt,entitlementState}=require('../backend/access-terms')
const USER='11111111-1111-4111-8111-111111111111'
const OTHER='22222222-2222-4222-8222-222222222222'
const ORDER='33333333-3333-4333-8333-333333333333'
const SECOND='44444444-4444-4444-8444-444444444444'
let passed=0
async function run(){
  const pg=new PGlite()
  const q=(sql,args=[])=>pg.query(sql,args)
  const one=async(sql,args=[]) => (await q(sql,args)).rows[0]
  const check=async(name,fn)=>{await fn();passed++;console.log('OK SQL '+name)}
  const foundation=fs.readFileSync(path.join(__dirname,'../backend/migrations/20261025_rv30_secure_foundation.sql'),'utf8')
  const commercial=fs.readFileSync(path.join(__dirname,'../backend/migrations/20261107_rv30_access365.sql'),'utf8')
  const apply=(id,status,event,updated,approved,policy='revoke')=>q('select public.rv30_apply_payment($1,$2,$3,$4,$5,$6,$7) as result',[id,'or_'+id.replaceAll('-',''),status,updated,event,policy,approved])
  const denied=async(sql,args=[])=>assert.rejects(()=>q(sql,args),error=>error.code==='42501')
  try{
    await pg.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,storage to anon,authenticated,service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id));
      alter table storage.buckets enable row level security;
      alter table storage.objects enable row level security;
      create policy old_permissive_buckets on storage.buckets for all to anon,authenticated using(true) with check(true);
      create policy old_permissive_objects on storage.objects for all to anon,authenticated using(true) with check(true);
      grant all on storage.buckets,storage.objects to anon,authenticated,service_role;
    `)
    await check('both complete migrations execute and can be reapplied',async()=>{
      await pg.exec(foundation);await pg.exec(commercial)
      await pg.exec(foundation);await pg.exec(commercial)
      assert.equal((await one('select count(*)::int as n from rv30_products')).n,1)
      assert.equal((await one("select to_regprocedure('public.rv30_apply_payment(uuid,text,text,timestamptz,text,text)') as old")).old,null)
      const p=await one('select price_cents,provider,access_days,status,commercial_approved from rv30_products')
      assert.deepEqual(p,{price_cents:39900,provider:'asaas',access_days:365,status:'draft',commercial_approved:true})
    })
    await q('insert into auth.users values ($1),($2)',[USER,OTHER])
    await q("insert into rv30_profiles(user_id,name) values($1,'Fixture A'),($2,'Fixture B')",[USER,OTHER])
    await q("insert into rv30_orders(id,user_id,buyer_email,product_id,amount_cents,currency,environment,idempotency_key) values($1,$2,'fixture@example.test','rv30',39900,'BRL','test','fixture-first')",[ORDER,USER])
    const times=await one("select now()-interval '60 minutes' as first,now()-interval '30 minutes' as second,now() as updated")
    const first=times.first,second=times.second,updated=times.updated
    await check('checkout creation claim is one time, even on retry',async()=>{
      assert.equal((await one('select rv30_claim_checkout($1,$2,$3) as claimed',[ORDER,OTHER,'test'])).claimed,false)
      assert.equal((await one('select rv30_claim_checkout($1,$2,$3) as claimed',[ORDER,USER,'production'])).claimed,false)
      assert.equal((await one('select rv30_claim_checkout($1,$2,$3) as claimed',[ORDER,USER,'test'])).claimed,true)
      assert.equal((await one('select rv30_claim_checkout($1,$2,$3) as claimed',[ORDER,USER,'test'])).claimed,false)
    })
    await check('approved payment grants exactly 365 days from approval',async()=>{
      await apply(ORDER,'approved','paid-first',updated,first)
      const e=await one('select order_id,status,granted_at,expires_at from rv30_entitlements')
      assert.equal(e.order_id,ORDER);assert.equal(e.status,'active')
      assert.equal(new Date(e.expires_at).getTime()-new Date(e.granted_at).getTime(),365*86400000)
      assert.equal(new Date(e.expires_at).toISOString(),accessExpiresAt(new Date(first).toISOString()))
    })
    const initial=await one('select expires_at from rv30_entitlements')
    await check('duplicate and delayed notifications do not extend access',async()=>{
      assert.equal((await apply(ORDER,'approved','paid-first',updated,first)).rows[0].result.result,'duplicate')
      await apply(ORDER,'approved','paid-again',updated,updated)
      assert.deepEqual(await one('select expires_at from rv30_entitlements'),initial)
      assert.equal((await apply(ORDER,'approved','old-approval',first,first)).rows[0].result.result,'stale')
      assert.equal((await apply(ORDER,'pending','old-pending',first,null)).rows[0].result.result,'regression_ignored')
      assert.deepEqual(await one('select expires_at from rv30_entitlements'),initial)
    })
    await check('RLS isolates accounts and refuses client grants/payment RPCs',async()=>{
      // A permissive policy left by an earlier schema must not broaden access.
      await pg.exec('create policy legacy_broad_profile on rv30_profiles for select to authenticated using(true);create policy legacy_broad_order on rv30_orders for select to authenticated using(true)')
      await pg.exec('set role authenticated')
      await q("select set_config('request.jwt.claim.sub',$1,false)",[USER])
      assert.equal((await q('select * from rv30_profiles')).rows.length,1)
      assert.equal((await q('select * from rv30_profiles where user_id=$1',[OTHER])).rows.length,0)
      assert.equal((await q('select * from rv30_orders')).rows.length,1)
      await denied("update rv30_entitlements set status='active'")
      await denied('select rv30_apply_payment($1,$2,$3,$4,$5,$6,$7)',[ORDER,'or_fixture123','approved',updated,'forged','preserve',first])
      await denied('select rv30_claim_checkout($1,$2,$3)',[ORDER,USER,'test'])
      await pg.exec('reset role')
    })
    await check('private Storage survives preexisting permissive policies',async()=>{
      await pg.exec("insert into storage.buckets(id,name,public) values('public-fixture','fixture',true);insert into storage.objects(bucket_id) values('rv30-videos'),('public-fixture')")
      await pg.exec('set role authenticated')
      assert.equal((await q("select * from storage.objects where bucket_id='rv30-videos'")).rows.length,0)
      assert.equal((await q("select * from storage.buckets where id='rv30-videos'")).rows.length,0)
      assert.equal((await q("select * from storage.objects where bucket_id='public-fixture'")).rows.length,1)
      await denied("insert into storage.objects(bucket_id) values('rv30-videos')")
      assert.equal((await q("update storage.buckets set public=true where id='rv30-videos' returning id")).rows.length,0)
      await pg.exec('reset role')
      assert.equal((await one("select public from storage.buckets where id='rv30-videos'")).public,false)
    })
    await check('a newer paid purchase cannot be replaced by late older approval/refund',async()=>{
      await q("insert into rv30_orders(id,user_id,buyer_email,product_id,amount_cents,currency,environment,idempotency_key) values($1,$2,'fixture@example.test','rv30',39900,'BRL','test','fixture-second')",[SECOND,USER])
      await apply(SECOND,'approved','paid-second',updated,second)
      await apply(ORDER,'approved','late-first',updated,first)
      assert.equal((await one('select order_id from rv30_entitlements')).order_id,SECOND)
      await apply(ORDER,'refunded','refund-first',updated,null,'preserve')
      assert.equal((await one('select status from rv30_entitlements')).status,'active')
    })
    await check('confirmed refund revokes and cannot be undone by a replay',async()=>{
      await apply(SECOND,'refunded','refund-second',updated,null,'preserve')
      assert.equal((await one('select status from rv30_entitlements')).status,'revoked')
      assert.equal((await apply(SECOND,'approved','replay-second',updated,second)).rows[0].result.result,'terminal_ignored')
      assert.equal((await one('select status from rv30_entitlements')).status,'revoked')
      await apply(SECOND,'chargeback','chargeback-second',updated,null)
      assert.equal((await one('select status from rv30_entitlements')).status,'revoked')
    })
    await check('expiry is exact, keeps history and is idempotent',async()=>{
      const old=await one("select now()-interval '8760 hours 1 second' as approved")
      const id='55555555-5555-4555-8555-555555555555'
      await q("insert into rv30_orders(id,user_id,buyer_email,product_id,amount_cents,currency,environment,idempotency_key) values($1,$2,'other@example.test','rv30',39900,'BRL','test','old-approved')",[id,OTHER])
      await apply(id,'approved','old-approved',updated,old.approved)
      assert.equal((await one('select status from rv30_entitlements where user_id=$1',[OTHER])).status,'expired')
      const before=await one('select count(*)::int as n from rv30_orders')
      await q('select rv30_expire_access()');await q('select rv30_expire_access()')
      assert.deepEqual(await one('select count(*)::int as n from rv30_orders'),before)
      const expires='2027-10-27T12:00:00.000Z'
      assert.equal(entitlementState({status:'active',expires_at:expires},Date.parse(expires)-1),'active')
      assert.equal(entitlementState({status:'active',expires_at:expires},Date.parse(expires)),'expired')
    })
    await check('expired Auth session rows cannot authenticate and browser cannot invoke the RPC',async()=>{
      const id='66666666-6666-4666-8666-666666666666'
      await q("insert into auth.sessions values($1,$2,now()-interval '1 second')",[id,USER])
      assert.equal((await one('select rv30_session_active($1,$2) as active',[id,USER])).active,false)
      await q('update auth.sessions set not_after=null where id=$1',[id])
      assert.equal((await one('select rv30_session_active($1,$2) as active',[id,USER])).active,true)
      await pg.exec('set role anon');await denied('select rv30_session_active($1,$2)',[id,USER]);await pg.exec('reset role')
    })
    console.log(`PostgreSQL local: ${passed} contratos passaram. Auth/Storage são fixtures; sem Supabase remoto e sem teste de concorrência entre conexões.`)
  }finally{await pg.close()}
}
run().catch(error=>{console.error(error);process.exitCode=1})
