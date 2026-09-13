-- RV Cursos / RV 30 — esquema de produção proposto (V6)
-- NÃO executar em produção sem revisão do projeto Supabase, backups e validação das policies.
-- O schema não prende todos os futuros cursos a 30 dias: total_days pertence a rv_courses.

create extension if not exists pgcrypto;

create table if not exists public.rv_courses (
  id text primary key,
  title text not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  price_cents integer check (price_cents is null or price_cents >= 0),
  total_days smallint not null default 30 check (total_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rv_course_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  role text not null default 'student' check (role in ('student','admin')),
  status text not null default 'active' check (status in ('pending','active','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rv_course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.rv_courses(id) on delete cascade,
  day smallint not null check (day >= 0),
  phase text not null,
  title text not null,
  description text not null default '',
  time_label text,
  duration_label text,
  content_type text,
  objective text,
  video_url text,
  instructions jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, day)
);

create table if not exists public.rv_course_purchases (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_order_id text not null,
  course_id text not null references public.rv_courses(id),
  user_id uuid references auth.users(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  status text not null check (status in ('pending','approved','refunded','chargeback','canceled')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id),
  unique (id, course_id)
);

create index if not exists rv_course_purchases_email_idx on public.rv_course_purchases (lower(buyer_email));
create index if not exists rv_course_purchases_user_idx on public.rv_course_purchases (user_id);
create index if not exists rv_course_purchases_course_status_idx on public.rv_course_purchases (course_id, status);

create table if not exists public.rv_course_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.rv_courses(id) on delete cascade,
  purchase_id uuid,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id),
  foreign key (purchase_id, course_id)
    references public.rv_course_purchases(id, course_id)
    on delete restrict
);

create index if not exists rv_course_enrollments_course_status_idx on public.rv_course_enrollments (course_id, status);
create index if not exists rv_course_enrollments_user_status_idx on public.rv_course_enrollments (user_id, status);

create table if not exists public.rv_course_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.rv_courses(id) on delete cascade,
  day smallint not null check (day >= 0),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, day),
  foreign key (course_id, day)
    references public.rv_course_lessons(course_id, day)
    on delete cascade
);

create index if not exists rv_course_progress_course_user_idx on public.rv_course_progress (course_id, user_id);

create table if not exists public.rv_course_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.rv_courses(id) on delete cascade,
  day smallint not null check (day >= 0),
  body text not null check (char_length(body) between 1 and 600),
  status text not null default 'open' check (status in ('open','answered','hidden')),
  admin_reply text,
  replied_by uuid references auth.users(id) on delete set null,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, day)
    references public.rv_course_lessons(course_id, day)
    on delete cascade
);

create index if not exists rv_course_comments_course_day_idx on public.rv_course_comments (course_id, day, created_at desc);
create index if not exists rv_course_comments_status_idx on public.rv_course_comments (status);

create table if not exists public.rv_course_admin_notes (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.rv_courses(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 800),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.rv_course_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, provider_event_id)
);

create table if not exists public.rv_course_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  course_id text references public.rv_courses(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Mantém updated_at coerente sem depender de cada cliente lembrar de atualizá-lo.
create or replace function public.rv_course_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rv_courses_touch_updated_at on public.rv_courses;
create trigger rv_courses_touch_updated_at before update on public.rv_courses for each row execute function public.rv_course_touch_updated_at();
drop trigger if exists rv_profiles_touch_updated_at on public.rv_course_profiles;
create trigger rv_profiles_touch_updated_at before update on public.rv_course_profiles for each row execute function public.rv_course_touch_updated_at();
drop trigger if exists rv_lessons_touch_updated_at on public.rv_course_lessons;
create trigger rv_lessons_touch_updated_at before update on public.rv_course_lessons for each row execute function public.rv_course_touch_updated_at();
drop trigger if exists rv_purchases_touch_updated_at on public.rv_course_purchases;
create trigger rv_purchases_touch_updated_at before update on public.rv_course_purchases for each row execute function public.rv_course_touch_updated_at();
drop trigger if exists rv_enrollments_touch_updated_at on public.rv_course_enrollments;
create trigger rv_enrollments_touch_updated_at before update on public.rv_course_enrollments for each row execute function public.rv_course_touch_updated_at();
drop trigger if exists rv_progress_touch_updated_at on public.rv_course_progress;
create trigger rv_progress_touch_updated_at before update on public.rv_course_progress for each row execute function public.rv_course_touch_updated_at();
drop trigger if exists rv_comments_touch_updated_at on public.rv_course_comments;
create trigger rv_comments_touch_updated_at before update on public.rv_course_comments for each row execute function public.rv_course_touch_updated_at();

-- Garante que uma matrícula vinculada a compra use um pedido aprovado e do mesmo usuário/curso.
create or replace function public.rv_course_validate_enrollment_purchase()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p public.rv_course_purchases;
begin
  if new.purchase_id is null then
    return new;
  end if;

  select * into p
  from public.rv_course_purchases
  where id = new.purchase_id;

  if p.id is null then
    raise exception 'purchase_not_found';
  end if;

  if p.course_id <> new.course_id then
    raise exception 'purchase_course_mismatch';
  end if;

  if p.status <> 'approved' then
    raise exception 'purchase_not_approved';
  end if;

  if p.user_id is null or p.user_id <> new.user_id then
    raise exception 'purchase_user_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists rv_enrollment_validate_purchase on public.rv_course_enrollments;
create trigger rv_enrollment_validate_purchase
before insert or update of purchase_id, user_id, course_id
on public.rv_course_enrollments
for each row execute function public.rv_course_validate_enrollment_purchase();

-- Helpers de autorização. SECURITY DEFINER evita depender de policies recursivas.
create or replace function public.rv_course_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rv_course_profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

create or replace function public.rv_course_has_access(target_course_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rv_course_enrollments e
    join public.rv_course_profiles p on p.user_id = e.user_id
    where e.user_id = auth.uid()
      and e.course_id = target_course_id
      and e.status = 'active'
      and p.status = 'active'
  );
$$;

create or replace function public.rv_course_lesson_is_published(target_course_id text, target_day smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rv_course_lessons l
    where l.course_id = target_course_id
      and l.day = target_day
      and l.is_published = true
  );
$$;

-- Evita deixar helpers SECURITY DEFINER executáveis pelo papel PUBLIC/anon.
revoke all on function public.rv_course_is_admin() from public;
revoke all on function public.rv_course_has_access(text) from public;
revoke all on function public.rv_course_lesson_is_published(text, smallint) from public;
grant execute on function public.rv_course_is_admin() to authenticated;
grant execute on function public.rv_course_has_access(text) to authenticated;
grant execute on function public.rv_course_lesson_is_published(text, smallint) to authenticated;

-- RLS
alter table public.rv_courses enable row level security;
alter table public.rv_course_profiles enable row level security;
alter table public.rv_course_lessons enable row level security;
alter table public.rv_course_purchases enable row level security;
alter table public.rv_course_enrollments enable row level security;
alter table public.rv_course_progress enable row level security;
alter table public.rv_course_comments enable row level security;
alter table public.rv_course_admin_notes enable row level security;
alter table public.rv_course_webhook_events enable row level security;
alter table public.rv_course_audit_log enable row level security;

-- Cursos: leitura autenticada; escrita somente por backend/service role na primeira versão.
create policy "rv_courses_read_authenticated"
on public.rv_courses for select to authenticated
using (status = 'active' or public.rv_course_is_admin());

-- Perfil: aluno lê o próprio; admin lê todos.
-- Alterações de role/status e matrícula devem passar pela camada server-side/service role,
-- evitando que o navegador administrativo ganhe privilégios de escrita mais amplos do que precisa.
create policy "rv_profiles_read_own_or_admin"
on public.rv_course_profiles for select to authenticated
using (user_id = auth.uid() or public.rv_course_is_admin());

-- Aulas: somente aluno com matrícula ativa ou admin.
create policy "rv_lessons_read_enrolled_or_admin"
on public.rv_course_lessons for select to authenticated
using ((is_published and public.rv_course_has_access(course_id)) or public.rv_course_is_admin());

-- Compras: aluno vê as próprias compras vinculadas; admin vê todas.
create policy "rv_purchases_read_own_or_admin"
on public.rv_course_purchases for select to authenticated
using (user_id = auth.uid() or public.rv_course_is_admin());

-- Matrícula: aluno vê a própria; admin vê todas.
create policy "rv_enrollments_read_own_or_admin"
on public.rv_course_enrollments for select to authenticated
using (user_id = auth.uid() or public.rv_course_is_admin());

-- Progresso: aluno matriculado controla o próprio; admin pode administrar.
create policy "rv_progress_read_own_or_admin"
on public.rv_course_progress for select to authenticated
using (user_id = auth.uid() or public.rv_course_is_admin());

create policy "rv_progress_insert_own_or_admin"
on public.rv_course_progress for insert to authenticated
with check (
  (user_id = auth.uid()
    and public.rv_course_has_access(course_id)
    and public.rv_course_lesson_is_published(course_id, day))
  or public.rv_course_is_admin()
);

create policy "rv_progress_update_own_or_admin"
on public.rv_course_progress for update to authenticated
using ((user_id = auth.uid() and public.rv_course_has_access(course_id)) or public.rv_course_is_admin())
with check (
  (user_id = auth.uid()
    and public.rv_course_has_access(course_id)
    and public.rv_course_lesson_is_published(course_id, day))
  or public.rv_course_is_admin()
);

create policy "rv_progress_delete_own_or_admin"
on public.rv_course_progress for delete to authenticated
using ((user_id = auth.uid() and public.rv_course_has_access(course_id)) or public.rv_course_is_admin());

-- Comentários: aluno vê os próprios e envia quando matriculado. Administração trata respostas/moderação.
create policy "rv_comments_read_own_or_admin"
on public.rv_course_comments for select to authenticated
using (
  (user_id = auth.uid() and status <> 'hidden' and public.rv_course_has_access(course_id))
  or public.rv_course_is_admin()
);

create policy "rv_comments_insert_own"
on public.rv_course_comments for insert to authenticated
with check (
  user_id = auth.uid()
  and public.rv_course_has_access(course_id)
  and public.rv_course_lesson_is_published(course_id, day)
);

create policy "rv_comments_admin_update"
on public.rv_course_comments for update to authenticated
using (public.rv_course_is_admin())
with check (public.rv_course_is_admin());

-- Notas e auditoria: somente administração.
create policy "rv_admin_notes_admin_all"
on public.rv_course_admin_notes for all to authenticated
using (public.rv_course_is_admin())
with check (public.rv_course_is_admin());

create policy "rv_audit_admin_read"
on public.rv_course_audit_log for select to authenticated
using (public.rv_course_is_admin());

create policy "rv_webhook_admin_read"
on public.rv_course_webhook_events for select to authenticated
using (public.rv_course_is_admin());

-- Seed mínimo do curso. Ajustar preço/status antes da produção se necessário.
insert into public.rv_courses (id, title, status, price_cents, total_days)
values ('rv30', 'RV 30', 'draft', 39900, 30)
on conflict (id) do update set title = excluded.title;
