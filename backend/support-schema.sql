-- Proposta incremental para um Supabase EXCLUSIVO dos cursos.
-- Depende de supabase-schema.sql. Nao aplicada nem validada em Postgres nesta entrega.
begin;

create table public.rv_support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text references public.rv_courses(id),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'answered', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rv_support_owner on public.rv_support_threads(user_id, updated_at desc);

create table public.rv_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.rv_support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_role text not null check (sender_role in ('student', 'admin')),
  client_message_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(sender_id, client_message_id)
);
create index rv_support_history on public.rv_support_messages(thread_id, created_at, id);
create index rv_support_rate on public.rv_support_messages(sender_id, created_at desc);

create table public.rv_support_receipts (
  thread_id uuid not null references public.rv_support_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_through timestamptz not null default now(),
  primary key(thread_id, user_id)
);

alter table public.rv_support_threads enable row level security;
alter table public.rv_support_messages enable row level security;
alter table public.rv_support_receipts enable row level security;
revoke all on public.rv_support_threads, public.rv_support_messages, public.rv_support_receipts from public, anon, authenticated;
grant select on public.rv_support_threads, public.rv_support_messages, public.rv_support_receipts to authenticated;
grant all on public.rv_support_threads, public.rv_support_messages, public.rv_support_receipts to service_role;

create policy rv_support_read_threads on public.rv_support_threads for select to authenticated
using ((public.rv_course_is_admin() or user_id = (select auth.uid())) and exists (
  select 1 from public.rv_course_profiles p where p.user_id = (select auth.uid()) and p.status = 'active'
));
create policy rv_support_read_messages on public.rv_support_messages for select to authenticated
using (exists (select 1 from public.rv_support_threads t where t.id = thread_id));
create policy rv_support_read_receipts on public.rv_support_receipts for select to authenticated
using (user_id = (select auth.uid()) and exists (select 1 from public.rv_support_threads t where t.id = thread_id));

-- As escritas passam por RPC: identidade, papel, datas e estado nao vem do cliente.
create function public.rv_support_send(
  p_thread_id uuid, p_body text, p_client_message_id uuid,
  p_subject text default null, p_course_id text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_admin boolean;
  v_thread public.rv_support_threads;
  v_existing public.rv_support_messages;
begin
  if v_user is null then raise exception 'auth_required'; end if;
  -- Serializa o envio por usuario para idempotencia e limite de frequencia.
  perform 1 from public.rv_course_profiles where user_id = v_user and status = 'active' for update;
  if not found then raise exception 'account_inactive'; end if;
  v_admin := public.rv_course_is_admin();
  if p_client_message_id is null or char_length(btrim(p_body)) not between 1 and 2000 or p_body is null then
    raise exception 'invalid_message';
  end if;
  select * into v_existing from public.rv_support_messages where sender_id = v_user and client_message_id = p_client_message_id;
  if found then
    if v_existing.body <> btrim(p_body) or (p_thread_id is not null and v_existing.thread_id <> p_thread_id) then
      raise exception 'idempotency_conflict';
    end if;
    return v_existing.thread_id;
  end if;
  if (select count(*) from public.rv_support_messages where sender_id = v_user and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited';
  end if;
  if p_thread_id is null then
    if v_admin then raise exception 'student_thread_required'; end if;
    if p_course_id is not null and not public.rv_course_has_access(p_course_id) then raise exception 'course_access_denied'; end if;
    insert into public.rv_support_threads(user_id, course_id, subject)
      values(v_user, p_course_id, btrim(p_subject)) returning * into v_thread;
  else
    select * into v_thread from public.rv_support_threads where id = p_thread_id for update;
    if not found or (not v_admin and v_thread.user_id <> v_user) then raise exception 'thread_access_denied'; end if;
  end if;
  insert into public.rv_support_messages(thread_id, sender_id, sender_role, client_message_id, body)
    values(v_thread.id, v_user, case when v_admin then 'admin' else 'student' end, p_client_message_id, btrim(p_body));
  update public.rv_support_threads set status = case when v_admin then 'answered' else 'open' end, updated_at = now() where id = v_thread.id;
  return v_thread.id;
end;
$$;

create function public.rv_support_mark_read(p_thread_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.rv_course_profiles where user_id = auth.uid() and status = 'active') then raise exception 'auth_required'; end if;
  if not exists (select 1 from public.rv_support_threads where id = p_thread_id and (user_id = auth.uid() or public.rv_course_is_admin())) then raise exception 'thread_access_denied'; end if;
  insert into public.rv_support_receipts(thread_id, user_id) values(p_thread_id, auth.uid())
    on conflict(thread_id, user_id) do update set read_through = now();
end;
$$;

create function public.rv_support_resolve(p_thread_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.rv_course_is_admin() then raise exception 'admin_required'; end if;
  update public.rv_support_threads set status = 'resolved', updated_at = now() where id = p_thread_id;
end;
$$;
revoke all on function public.rv_support_send(uuid,text,uuid,text,text), public.rv_support_mark_read(uuid), public.rv_support_resolve(uuid) from public, anon;
grant execute on function public.rv_support_send(uuid,text,uuid,text,text), public.rv_support_mark_read(uuid), public.rv_support_resolve(uuid) to authenticated;
commit;
