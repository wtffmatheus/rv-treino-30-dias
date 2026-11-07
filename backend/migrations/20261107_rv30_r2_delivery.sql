-- Proposed only. Back up and inspect staging before applying after access365.
-- Adds metadata; does not publish lessons, grant purchases or enable sales.
begin;
alter table public.rv30_lessons add column if not exists storage_provider text not null default 'supabase' check(storage_provider in ('supabase','r2'));
alter table public.rv30_lessons add column if not exists storage_bytes bigint check(storage_bytes is null or storage_bytes>0);
alter table public.rv30_lessons add column if not exists storage_etag text check(storage_etag is null or storage_etag ~ '^[a-f0-9]{32}$');
alter table public.rv30_lessons add column if not exists duration_seconds numeric check(duration_seconds is null or duration_seconds>0);
alter table public.rv30_lessons drop constraint if exists rv30_r2_lesson_version;
alter table public.rv30_lessons add constraint rv30_r2_lesson_version check(storage_provider<>'r2' or (
  storage_path is not null and storage_bytes is not null and storage_etag is not null and duration_seconds is not null and
  storage_path ~ ('^rv30/dia-'||lpad(day::text,2,'0')||'/[a-f0-9]{64}\.mp4$')
));
-- Retain immutable history before replacing any existing lesson's media link.
create table if not exists public.rv30_lesson_media_history(
  id uuid primary key default gen_random_uuid(),
  product_id text not null,day smallint not null,previous_row jsonb not null,
  recorded_at timestamptz not null default now(),
  foreign key(product_id,day) references public.rv30_lessons(product_id,day) on delete restrict
);
alter table public.rv30_lesson_media_history enable row level security;
revoke all on public.rv30_lesson_media_history from public,anon,authenticated;
grant select,insert on public.rv30_lesson_media_history to service_role;
commit;
