-- RV 30: additive proposal. Never executed by build or dev server.
-- Apply ONLY after reviewed backup + restore drill in a separate staging project.
-- Existing rv_course_* tables, accounts, purchases and content remain untouched.
begin;
create extension if not exists pgcrypto;

-- Auth access JWTs may remain cryptographically valid after signout. This bounded
-- service-only query checks the live Auth session after provider validation.
create or replace function public.rv30_session_active(p_session_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog,auth as $$
  select exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id);
$$;
revoke all on function public.rv30_session_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rv30_session_active(uuid,uuid) to service_role;

create table if not exists public.rv30_products (
  id text primary key check (id = 'rv30'),
  title text not null default 'RV 30',
  total_days smallint not null default 30 check (total_days = 30),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  price_cents integer check (price_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  commercial_approved boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.rv30_products(id) values ('rv30') on conflict do nothing;

create table if not exists public.rv30_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  status text not null default 'active' check (status in ('active','blocked','pending')),
  created_at timestamptz not null default now()
);
-- Administrative authorization has no user-editable role: ADMIN_EMAIL exists only in server environment.
create table if not exists public.rv30_lessons (
  product_id text not null references public.rv30_products(id) on delete restrict,
  day smallint not null check (day between 1 and 30),
  title text not null,
  description text not null default '',
  storage_path text check (storage_path is null or (storage_path !~ '(^/|\.\.|://)' and char_length(storage_path) between 1 and 500)),
  source_filename text,
  is_published boolean not null default false,
  primary key(product_id,day),
  check (not is_published or storage_path is not null)
);
create table if not exists public.rv30_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  buyer_email text not null,
  product_id text not null references public.rv30_products(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency = 'BRL'),
  environment text not null check (environment in ('test','production')),
  provider text not null default 'mercado_pago' check (provider = 'mercado_pago'),
  status text not null default 'pending' check (status in ('pending','approved','declined','canceled','refunded','chargeback')),
  idempotency_key text not null,
  preference_id text,
  payment_id text unique,
  checkout_url text,
  provider_updated_at timestamptz,
  manual_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key,environment),
  unique(id,user_id,product_id,environment)
);
create index if not exists rv30_orders_user_created on public.rv30_orders(user_id,created_at desc);
create table if not exists public.rv30_entitlements (
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id text not null references public.rv30_products(id) on delete restrict,
  environment text not null check (environment in ('test','production')),
  order_id uuid not null,
  status text not null check (status in ('active','revoked','expired')),
  granted_at timestamptz not null default now(),
  primary key(user_id,product_id,environment),
  foreign key(order_id,user_id,product_id,environment) references public.rv30_orders(id,user_id,product_id,environment) on delete restrict
);
create table if not exists public.rv30_progress (
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id text not null,
  environment text not null check (environment in ('test','production')),
  day smallint not null,
  completed_at timestamptz not null default now(),
  primary key(user_id,product_id,environment,day),
  foreign key(user_id,product_id,environment) references public.rv30_entitlements(user_id,product_id,environment) on delete restrict,
  foreign key(product_id,day) references public.rv30_lessons(product_id,day) on delete restrict
);
create table if not exists public.rv30_payment_events (
  event_key text primary key,
  order_id uuid not null references public.rv30_orders(id) on delete restrict,
  payment_id text not null,
  provider_status text not null,
  provider_updated_at timestamptz not null,
  result text not null,
  received_at timestamptz not null default now()
);

-- A single transaction locks the order, records the event and grants exactly one entitlement.
create or replace function public.rv30_apply_payment(
  p_order_id uuid, p_payment_id text, p_status text,
  p_provider_updated_at timestamptz, p_event_key text, p_refund_policy text default 'review'
) returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare o public.rv30_orders; grant_status text; event_result text := 'applied';
begin
  if p_status not in ('pending','approved','declined','canceled','refunded','chargeback')
    or p_refund_policy not in ('review','revoke','preserve') then raise exception 'invalid_payment_state'; end if;
  select * into o from public.rv30_orders where id=p_order_id for update;
  if not found then raise exception 'order_missing'; end if;
  if exists(select 1 from public.rv30_payment_events where event_key=p_event_key) then return jsonb_build_object('result','duplicate'); end if;
  if o.payment_id is not null and o.payment_id<>p_payment_id and o.status not in ('pending','declined','canceled') then raise exception 'payment_mismatch'; end if;
  if p_provider_updated_at is null or p_provider_updated_at>now()+interval '5 minutes' then raise exception 'invalid_provider_time'; end if;
  if o.provider_updated_at is not null and p_provider_updated_at<o.provider_updated_at then event_result:='stale'; end if;
  if o.status in ('refunded','chargeback') and p_status not in ('refunded','chargeback') then event_result:='terminal_ignored'; end if;
  if o.status='approved' and p_status in ('pending','declined','canceled') then event_result:='regression_ignored'; end if;
  insert into public.rv30_payment_events(event_key,order_id,payment_id,provider_status,provider_updated_at,result)
  values(p_event_key,o.id,p_payment_id,p_status,p_provider_updated_at,event_result);
  if event_result<>'applied' then return jsonb_build_object('result',event_result); end if;
  update public.rv30_orders set status=p_status,payment_id=p_payment_id,provider_updated_at=p_provider_updated_at,
    manual_review=(p_status in ('refunded','chargeback') and p_refund_policy='review') where id=o.id;
  if p_status='approved' then
    insert into public.rv30_entitlements(user_id,product_id,environment,order_id,status)
    values(o.user_id,o.product_id,o.environment,o.id,'active')
    on conflict(user_id,product_id,environment) do update set order_id=excluded.order_id,status='active';
  elsif p_status in ('refunded','chargeback') and p_refund_policy='revoke' then
    update public.rv30_entitlements set status='revoked' where user_id=o.user_id and product_id=o.product_id and environment=o.environment and order_id=o.id;
  end if;
  return jsonb_build_object('result','applied','manualReview',p_status in ('refunded','chargeback') and p_refund_policy='review');
end; $$;
revoke all on function public.rv30_apply_payment(uuid,text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.rv30_apply_payment(uuid,text,text,timestamptz,text,text) to service_role;

-- Fail closed outside the server. No browser role can insert purchases, grant access,
-- publish videos, alter authorization or invoke the payment transaction.
alter table public.rv30_products enable row level security;
alter table public.rv30_profiles enable row level security;
alter table public.rv30_lessons enable row level security;
alter table public.rv30_orders enable row level security;
alter table public.rv30_entitlements enable row level security;
alter table public.rv30_progress enable row level security;
alter table public.rv30_payment_events enable row level security;
revoke all on public.rv30_products,public.rv30_profiles,public.rv30_lessons,public.rv30_orders,public.rv30_entitlements,public.rv30_progress,public.rv30_payment_events from anon,authenticated;
grant all on public.rv30_products,public.rv30_profiles,public.rv30_lessons,public.rv30_orders,public.rv30_entitlements,public.rv30_progress,public.rv30_payment_events to service_role;
grant select on public.rv30_profiles,public.rv30_orders,public.rv30_entitlements,public.rv30_progress to authenticated;
drop policy if exists rv30_profile_own on public.rv30_profiles;
create policy rv30_profile_own on public.rv30_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists rv30_order_own on public.rv30_orders;
create policy rv30_order_own on public.rv30_orders for select to authenticated using(user_id=auth.uid());
drop policy if exists rv30_entitlement_own on public.rv30_entitlements;
create policy rv30_entitlement_own on public.rv30_entitlements for select to authenticated using(user_id=auth.uid());
drop policy if exists rv30_progress_own on public.rv30_progress;
create policy rv30_progress_own on public.rv30_progress for select to authenticated using(user_id=auth.uid());

-- Storage private; every playback URL must be signed by the authorized server.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rv30-videos','rv30-videos',false,5368709120,array['video/mp4','video/webm'])
on conflict(id) do update set public=false;
-- Restrictive policies apply in addition to any preexisting permissive policies.
-- Browser roles cannot read/write this bucket or alter its privacy configuration.
-- service_role bypasses RLS; signed URLs are issued only by the authorized server.
drop policy if exists rv30_private_objects_guard on storage.objects;
create policy rv30_private_objects_guard on storage.objects as restrictive for all to anon,authenticated
using(bucket_id <> 'rv30-videos') with check(bucket_id <> 'rv30-videos');
drop policy if exists rv30_private_bucket_guard on storage.buckets;
create policy rv30_private_bucket_guard on storage.buckets as restrictive for all to anon,authenticated
using(id <> 'rv30-videos') with check(id <> 'rv30-videos');
commit;
