from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / 'backend/supabase-schema.sql').read_text(encoding='utf-8')
errors=[]
notes=[]

tables = [
  'rv_courses','rv_course_profiles','rv_course_lessons','rv_course_purchases',
  'rv_course_enrollments','rv_course_progress','rv_course_comments',
  'rv_course_admin_notes','rv_course_webhook_events','rv_course_audit_log'
]
for table in tables:
    if not re.search(rf'create table if not exists public\.{re.escape(table)}\b', sql, re.I):
        errors.append(f'tabela ausente: {table}')
    if not re.search(rf'alter table public\.{re.escape(table)} enable row level security;', sql, re.I):
        errors.append(f'RLS não habilitado: {table}')

required = {
    'admin helper': 'create or replace function public.rv_course_is_admin()',
    'access helper': 'create or replace function public.rv_course_has_access(target_course_id text)',
    'updated_at trigger helper': 'create or replace function public.rv_course_touch_updated_at()',
    'aulas somente publicadas para aluno': "using ((is_published and public.rv_course_has_access(course_id)) or public.rv_course_is_admin());",
    'comentário oculto não volta ao aluno': "status <> 'hidden' and public.rv_course_has_access(course_id)",
    'webhook idempotente': 'unique (provider, provider_event_id)',
    'pedido idempotente': 'unique (provider, provider_order_id)',
    'progresso único por dia': 'primary key (user_id, course_id, day)',
    'curso/dia único': 'unique (course_id, day)',
    'dias configuráveis por curso': 'total_days smallint not null default 30',
    'progresso aponta para aula real': 'foreign key (course_id, day)',
    'matrícula valida compra': 'create or replace function public.rv_course_validate_enrollment_purchase()',
    'aula publicada helper': 'create or replace function public.rv_course_lesson_is_published(target_course_id text, target_day smallint)',
    'helpers sem PUBLIC': 'revoke all on function public.rv_course_is_admin() from public;'
}
for label, token in required.items():
    if token not in sql: errors.append(f'regra ausente: {label}')

if re.search(r'create policy.*rv_course_webhook_events.*for (insert|update|all)', sql, re.I | re.S):
    errors.append('webhook não deve ganhar policy client-side de escrita nesta versão')

notes.append('Mutações administrativas sensíveis de perfil/matrícula permanecem reservadas à camada server-side/service role.')
print(f'Tabelas verificadas: {len(tables)}')
for note in notes: print('NOTA:', note)
for error in errors: print('ERRO:', error)
if errors: sys.exit(1)
print('OK: supabase_schema_audit.py concluiu sem falhas estruturais previstas.')
