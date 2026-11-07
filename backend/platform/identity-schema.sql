-- Additive migration in the isolated platform database. qa_users remains the
-- physical identity table to preserve existing progress/activity foreign keys.
create table if not exists identity_metadata(
 user_id text primary key references qa_users(id),
 kind text not null check(kind in('validation','commercial')),
 verified_at integer,verification_method text check(verification_method in('owner_provisioned','invitation','email'))
);
create table if not exists user_roles(
 user_id text not null references qa_users(id),role text not null check(role in('admin','student')),
 assigned_at integer not null,assigned_by text references qa_users(id),primary key(user_id,role)
);
create table if not exists enrollments(
 user_id text not null references qa_users(id),course_id text not null check(course_id='rv30'),
 source text not null check(source in('owner_validation','administrative','payment')),
 starts_at integer not null,expires_at integer not null check(expires_at>starts_at),
 revoked integer not null default 0 check(revoked in(0,1)),updated_at integer not null,
 primary key(user_id,course_id)
);
create table if not exists auth_sessions(
 token_hash text primary key,user_id text not null references qa_users(id),
 credential_version integer not null,created_at integer not null,last_seen_at integer not null,expires_at integer not null
);
create index if not exists auth_session_user on auth_sessions(user_id);
create index if not exists auth_session_expiry on auth_sessions(expires_at);
create table if not exists identity_tokens(
 token_hash text primary key,user_id text not null references qa_users(id),
 purpose text not null check(purpose in('invitation','recovery')),
 credential_version integer not null,created_at integer not null,expires_at integer not null,
 created_by text not null references qa_users(id),used_at integer,claim_id text
);
create index if not exists identity_token_user on identity_tokens(user_id);
create table if not exists auth_limits(
 key text not null,window integer not null,hits integer not null,expires_at integer not null,primary key(key,window)
);
create index if not exists auth_limit_expiry on auth_limits(expires_at);
create table if not exists identity_events(
 id text primary key,user_id text references qa_users(id),actor_id text references qa_users(id),
 action text not null,at integer not null
);
create index if not exists identity_event_user on identity_events(user_id,at);
