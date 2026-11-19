-- The staff access log: every time a lecturer or an administrator opens a
-- student's records, who they are, which student, what they opened and when.
-- The server writes it with the secret key before it hands any record over, and
-- only the server reads it, for the administrator's page (ADR 0009). Rows are
-- append-only. There is no foreign key to the student, so deleting a student's
-- records completely leaves the record of who looked at them.

create table public.staff_access_log (
  id bigint generated always as identity primary key,
  actor_email text not null,
  actor_role text not null,
  student_id uuid not null,
  course_id text,
  opened text not null,
  created_at timestamptz not null default now(),
  constraint staff_access_log_actor_role check (actor_role in ('administrator', 'lecturer')),
  constraint staff_access_log_opened check (opened in ('student_review')),
  constraint staff_access_log_actor_email check (length(actor_email) > 0)
);

create index staff_access_log_created on public.staff_access_log (created_at desc, id desc);

alter table public.staff_access_log enable row level security;

revoke all on table public.staff_access_log from public, anon, authenticated, service_role;
grant select, insert on table public.staff_access_log to service_role;
revoke all on sequence public.staff_access_log_id_seq from public, anon, authenticated;
grant usage, select on sequence public.staff_access_log_id_seq to service_role;
