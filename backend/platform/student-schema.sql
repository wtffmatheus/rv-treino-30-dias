-- Additive student records in the isolated staging database.
create table if not exists enrollment_details(
 user_id text primary key references qa_users(id),starts_at integer not null,
 source text not null check(source in('owner_validation','administrative','payment'))
);
create table if not exists lesson_visits(
 user_id text not null references qa_users(id),day integer not null check(day between 1 and 30),
 first_opened_at integer not null,last_opened_at integer not null,
 position_seconds real not null default 0 check(position_seconds>=0),
 primary key(user_id,day)
);
create table if not exists activity_sessions(
 user_id text primary key references qa_users(id),id text not null unique,day integer not null,
 sequence integer not null default 0,last_at integer not null,position_seconds real not null,
 visible integer not null,playing integer not null,expires_at integer not null
);
create table if not exists activity_events(
 session_id text not null,sequence integer not null,request_id text not null unique,
 user_id text not null references qa_users(id),day integer not null,event text not null,
 at integer not null,credited_seconds integer not null check(credited_seconds between 0 and 20),
 primary key(session_id,sequence)
);
create index if not exists activity_user_at on activity_events(user_id,at);
create index if not exists activity_expiry on activity_events(at);
create table if not exists activity_limits(
 user_id text not null,scope text not null,window integer not null,hits integer not null,
 primary key(user_id,scope,window)
);
create table if not exists activity_daily(
 user_id text not null references qa_users(id),date_utc text not null,
 seconds integer not null default 0 check(seconds>=0),primary key(user_id,date_utc)
);
