-- Additive multi-course catalog and e-mail recovery. Nothing here alters or
-- drops existing tables: rv30 keeps its enrollments, lesson_records and
-- qa_progress rows; other courses use the course_* tables below.
create table if not exists courses(
 id text primary key check(length(id) between 2 and 40 and id not glob '*[^a-z0-9-]*'),
 title text not null,description text not null default '',cover_media_id text references media_records(id),
 state text not null check(state in('draft','published','unpublished','archived')),
 legacy integer not null default 0 check(legacy in(0,1)),position integer not null default 100,
 revision integer not null default 1,created_at integer not null,updated_at integer not null
);
insert or ignore into courses(id,title,description,state,legacy,position,created_at,updated_at)
 values('rv30','RV Treino 30 Dias','Programa guiado de 30 dias de treinos com Rosângela Varas.','published',1,1,0,0);
create table if not exists course_enrollments(
 user_id text not null references qa_users(id),course_id text not null references courses(id),
 source text not null check(source in('owner_validation','administrative','payment')),
 starts_at integer not null,expires_at integer not null check(expires_at>starts_at),
 revoked integer not null default 0 check(revoked in(0,1)),granted_by text references qa_users(id),updated_at integer not null,
 primary key(user_id,course_id)
);
create index if not exists course_enrollment_course on course_enrollments(course_id);
create table if not exists course_lessons(
 id text primary key,course_id text not null references courses(id),position integer not null check(position between 1 and 500),
 title text not null,description text not null default '',media_id text references media_records(id),cover_id text references media_records(id),
 published integer not null default 0 check(published in(0,1)),updated_at integer not null,unique(course_id,position)
);
create table if not exists course_progress(
 user_id text not null references qa_users(id),lesson_id text not null references course_lessons(id),
 course_id text not null references courses(id),completed_at integer not null,primary key(user_id,lesson_id)
);
create index if not exists course_progress_course on course_progress(user_id,course_id);
create table if not exists recovery_codes(
 id text primary key,user_id text not null references qa_users(id),code_hash text not null,
 created_at integer not null,expires_at integer not null,attempts integer not null default 0 check(attempts between 0 and 5),consumed_at integer
);
create index if not exists recovery_code_user on recovery_codes(user_id,created_at);
