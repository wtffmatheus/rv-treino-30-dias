-- Isolated owner-authorized QA account. No orders, billing or real customer data.
create table if not exists qa_users(
 id text primary key,email text not null unique,name text not null,
 password_salt text,password_hash text,credential_version integer not null default 0,
 status text not null default 'active' check(status in('active','blocked')),
 created_at integer not null
);
create table if not exists qa_grants(
 user_id text primary key references qa_users(id),source text not null check(source='owner_validation'),
 expires_at integer not null,revoked integer not null default 0 check(revoked in(0,1))
);
create table if not exists qa_sessions(
 token_hash text primary key,user_id text not null references qa_users(id),
 credential_version integer not null,expires_at integer not null
);
create index if not exists qa_session_expiry on qa_sessions(expires_at);
create table if not exists qa_progress(
 user_id text not null references qa_users(id),day integer not null check(day between 1 and 30),
 completed_at integer not null,primary key(user_id,day)
);
create table if not exists qa_limits(
 key text not null,window integer not null,hits integer not null,primary key(key,window)
);
