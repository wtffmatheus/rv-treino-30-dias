-- REVIEWABLE PROPOSAL ONLY. Not applied automatically by build, upload or server.
-- Run after the foundation migration, backed-up and rehearsed in separate staging.
-- Price/access confirmed by owner; Asaas selected for the requested low-fee priority.
-- Preserve accounts, orders and history. Never guess an old payment approval date.
begin;

alter table public.rv30_products add column if not exists provider text not null default 'asaas' check(provider='asaas');
alter table public.rv30_products add column if not exists access_days smallint not null default 365 check(access_days=365);
update public.rv30_products set title='RV 30',provider='asaas',price_cents=39900,currency='BRL',access_days=365,commercial_approved=true
where id='rv30';
-- Product status and the server sales switch are intentionally not activated.

alter table public.rv30_orders drop constraint if exists rv30_orders_provider_check;
alter table public.rv30_orders add constraint rv30_orders_provider_check check(provider in ('asaas','stone','mercado_pago'));
alter table public.rv30_orders alter column provider set default 'asaas';
alter table public.rv30_orders add column if not exists approved_at timestamptz;
alter table public.rv30_orders add column if not exists checkout_claimed_at timestamptz;
create unique index if not exists rv30_gateway_checkout_unique
  on public.rv30_orders(provider,environment,preference_id) where preference_id is not null;
alter table public.rv30_entitlements add column if not exists expires_at timestamptz check(expires_at is null or expires_at>granted_at);
create index if not exists rv30_active_entitlement_expiry on public.rv30_entitlements(expires_at) where status='active';

-- NULL is deliberately retained where historical approval has not been verified.
-- The new server adapter refuses access when expires_at is NULL.
update public.rv30_orders set manual_review=true where status='approved' and approved_at is null;
update public.rv30_entitlements e set granted_at=o.approved_at,
  expires_at=o.approved_at+interval '8760 hours',
  status=case when e.status='revoked' or o.status in ('refunded','chargeback') then 'revoked'
    when o.approved_at+interval '8760 hours'<=now() then 'expired' else e.status end
from public.rv30_orders o where e.order_id=o.id and e.expires_at is null
  and o.provider='asaas' and o.product_id='rv30' and o.amount_cents=39900 and o.currency='BRL' and o.approved_at is not null;
update public.rv30_entitlements e set status='revoked' from public.rv30_orders o
where e.order_id=o.id and o.status in ('refunded','chargeback') and e.status<>'revoked';

-- Replace the old six-argument function so it cannot remain as a second,
-- indefinite-access overload. Its source remains in the foundation migration.
drop function if exists public.rv30_apply_payment(uuid,text,text,timestamptz,text,text);
create or replace function public.rv30_apply_payment(
  p_order_id uuid,p_payment_id text,p_status text,p_provider_updated_at timestamptz,
  p_event_key text,p_refund_policy text default 'revoke',p_approved_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  o public.rv30_orders;
  approval_at timestamptz;
  expiry_at timestamptz;
  event_result text:='applied';
begin
  if p_status is null or p_status not in ('pending','approved','declined','canceled','refunded','chargeback')
    or p_payment_id is null or char_length(p_payment_id) not between 1 and 200
    or p_event_key is null or char_length(p_event_key) not between 1 and 200 then raise exception 'invalid_payment_state'; end if;
  select * into o from public.rv30_orders where id=p_order_id for update;
  if not found then raise exception 'order_missing'; end if;
  if o.provider<>'asaas' or o.product_id<>'rv30' or o.amount_cents<>39900 or o.currency<>'BRL' then raise exception 'order_terms_mismatch'; end if;
  if exists(select 1 from public.rv30_payment_events where event_key=p_event_key) then return jsonb_build_object('result','duplicate'); end if;
  if o.payment_id is not null and o.payment_id<>p_payment_id and o.status not in ('pending','declined','canceled') then raise exception 'payment_mismatch'; end if;
  if p_provider_updated_at is null or p_provider_updated_at>now()+interval '5 minutes' then raise exception 'invalid_provider_time'; end if;
  if o.provider_updated_at is not null and p_provider_updated_at<o.provider_updated_at then event_result:='stale'; end if;
  if o.status in ('refunded','chargeback') and p_status not in ('refunded','chargeback') then event_result:='terminal_ignored'; end if;
  if o.status='approved' and p_status in ('pending','declined','canceled') then event_result:='regression_ignored'; end if;
  insert into public.rv30_payment_events(event_key,order_id,payment_id,provider_status,provider_updated_at,result)
    values(p_event_key,o.id,p_payment_id,p_status,p_provider_updated_at,event_result);
  if event_result<>'applied' then return jsonb_build_object('result',event_result); end if;

  approval_at:=coalesce(o.approved_at,p_approved_at);
  if p_status='approved' and (approval_at is null or approval_at>now()+interval '5 minutes'
    or approval_at>p_provider_updated_at+interval '5 minutes') then raise exception 'verified_approval_time_required'; end if;
  update public.rv30_orders set status=p_status,payment_id=p_payment_id,provider_updated_at=p_provider_updated_at,
    approved_at=case when p_status='approved' then approval_at else approved_at end,manual_review=false where id=o.id;

  if p_status='approved' then
    expiry_at:=approval_at+interval '8760 hours';
    insert into public.rv30_entitlements as current_access(user_id,product_id,environment,order_id,status,granted_at,expires_at)
      values(o.user_id,o.product_id,o.environment,o.id,case when expiry_at>now() then 'active' else 'expired' end,approval_at,expiry_at)
    on conflict(user_id,product_id,environment) do update set
      order_id=excluded.order_id,
      granted_at=case when current_access.order_id=excluded.order_id and current_access.expires_at is not null then current_access.granted_at else excluded.granted_at end,
      expires_at=case when current_access.order_id=excluded.order_id and current_access.expires_at is not null then current_access.expires_at else excluded.expires_at end,
      status=case when current_access.order_id=excluded.order_id and current_access.status in ('revoked','expired') then current_access.status
        when current_access.order_id=excluded.order_id and current_access.expires_at<=now() then 'expired' else excluded.status end
    where (current_access.order_id=excluded.order_id and current_access.status<>'revoked')
      or (current_access.order_id<>excluded.order_id and (current_access.expires_at is null or excluded.granted_at>current_access.granted_at));
  elsif p_status in ('refunded','chargeback') then
    -- The owner's refund/chargeback rule is fixed. The deprecated policy
    -- argument is retained for wire compatibility and cannot preserve access.
    update public.rv30_entitlements set status='revoked'
      where user_id=o.user_id and product_id=o.product_id and environment=o.environment and order_id=o.id;
  end if;
  return jsonb_build_object('result','applied','approvedAt',approval_at,
    'expiresAt',case when p_status='approved' then expiry_at else null end,'manualReview',false);
end; $$;
revoke all on function public.rv30_apply_payment(uuid,text,text,timestamptz,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.rv30_apply_payment(uuid,text,text,timestamptz,text,text,timestamptz) to service_role;

-- Atomic one-time link-creation claim. No automatic release after an uncertain
-- provider response: an operator must reconcile the existing upstream request.
create or replace function public.rv30_claim_checkout(p_order_id uuid,p_user_id uuid,p_environment text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.rv30_orders set checkout_claimed_at=now()
  where id=p_order_id and user_id=p_user_id and environment=p_environment and provider='asaas'
    and status='pending' and checkout_claimed_at is null and checkout_url is null;
  return found;
end; $$;
revoke all on function public.rv30_claim_checkout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.rv30_claim_checkout(uuid,uuid,text) to service_role;

-- Housekeeping is optional for enforcement: every server read also checks the
-- expiry instant. This preserves history instead of deleting the entitlement.
create or replace function public.rv30_expire_access(p_at timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
  update public.rv30_entitlements set status='expired' where status='active' and expires_at is not null and expires_at<=p_at;
  get diagnostics changed=row_count;
  return changed;
end; $$;
revoke all on function public.rv30_expire_access(timestamptz) from public,anon,authenticated;
grant execute on function public.rv30_expire_access(timestamptz) to service_role;
commit;
