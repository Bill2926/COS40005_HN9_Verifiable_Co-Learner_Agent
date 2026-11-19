-- A submission kept after the sandbox checks it: the code, each test's result,
-- and the outcome. Only the server reads or writes it. A refused submission keeps the
-- message and no pass. Rows are append-only.

create table public.submissions (
  id uuid primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  module_id text not null,
  exercise_id text not null,
  code text not null,
  results jsonb not null,
  outcome text not null,
  message text,
  created_at timestamptz not null default now(),
  constraint submissions_results_array check (jsonb_typeof(results) = 'array'),
  constraint submissions_outcome check (outcome in ('passed', 'failed', 'refused')),
  constraint submissions_message check (
    (outcome = 'refused' and message is not null and length(message) > 0)
    or (outcome <> 'refused' and message is null)
  )
);

create index submissions_student_course_created
  on public.submissions (student_id, course_id, created_at, id);

alter table public.submissions enable row level security;

revoke all on table public.submissions from public, anon, authenticated, service_role;
grant select, insert on table public.submissions to service_role;
