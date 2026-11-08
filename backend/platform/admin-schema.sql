-- Additive administration; identity/progress keys remain stable.
create table if not exists profiles(user_id text primary key references qa_users(id),phone text not null default '',updated_at integer not null);
create table if not exists admin_notes(id text primary key,user_id text not null references qa_users(id),actor_id text not null references qa_users(id),body text not null,at integer not null);
create index if not exists note_user on admin_notes(user_id,at);
create table if not exists audit_events(id text primary key,actor_id text not null references qa_users(id),subject_id text,entity text not null,action text not null,detail text not null,at integer not null);
create index if not exists audit_subject on audit_events(subject_id,at);
create index if not exists audit_time on audit_events(at);
create table if not exists course_records(id text primary key check(id='rv30'),draft text not null,published text not null,revision integer not null default 1,last_change text,updated_at integer not null);
create table if not exists lesson_records(day integer primary key check(day between 1 and 30),draft text not null,published text,revision integer not null default 1,last_change text,updated_at integer not null);
create unique index if not exists lesson_published_order on lesson_records(json_extract(published,'$.order')) where published is not null;
create table if not exists content_versions(id text primary key,entity text not null,entity_id text not null,revision integer not null,document text,actor_id text not null references qa_users(id),action text not null,at integer not null,unique(entity,entity_id,revision));
create table if not exists media_records(id text primary key,object_key text not null unique,kind text not null check(kind in('video','image')),label text not null,state text not null check(state in('review','ready','rejected')),bytes integer not null,duration real,width integer,height integer,format text not null,created_by text references qa_users(id),created_at integer not null,reviewed_at integer);
create table if not exists media_uploads(id text primary key,owner_id text not null references qa_users(id),object_key text not null unique,upload_id text not null,kind text not null,label text not null,expected_bytes integer not null,parts text not null default '{}',state text not null check(state in('open','finalizing','completed','aborted','failed')),revision integer not null default 0,created_at integer not null,expires_at integer not null);
create index if not exists upload_owner on media_uploads(owner_id,created_at);
create table if not exists support_threads(id text primary key,user_id text not null references qa_users(id),subject text not null,day integer check(day between 1 and 30),status text not null check(status in('open','answered','resolved')),created_at integer not null,updated_at integer not null,student_read_at integer not null default 0,admin_read_at integer not null default 0);
create index if not exists support_owner on support_threads(user_id,updated_at);
create table if not exists support_messages(id text primary key,thread_id text not null references support_threads(id),sender_id text not null references qa_users(id),sender_role text not null check(sender_role in('admin','student')),body text not null,at integer not null);
create index if not exists support_message_thread on support_messages(thread_id,at);
-- Financial rows can only be populated by a separately homologated provider.
-- There is intentionally no admin endpoint for marking an order paid.
create table if not exists platform_orders(id text primary key,user_id text not null references qa_users(id),provider text not null,provider_reference text not null unique,status text not null check(status in('pending','paid','cancelled','refunded','disputed')),amount_cents integer not null check(amount_cents>=0),currency text not null check(currency='BRL'),created_at integer not null,paid_at integer,updated_at integer not null);
