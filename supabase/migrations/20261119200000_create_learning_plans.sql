-- The Teacher's learning plans: one row per revision, append-only. The row
-- with the highest revision for a student and module is the plan in force.
-- Agreeing to a plan is a new revision with agreed_at set, so no row is ever
-- updated.

create table public.learning_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  module_id text not null,
  revision integer not null,
  steps jsonb not null,
  current_step integer not null default 0,
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint learning_plans_revision check (revision >= 1),
  constraint learning_plans_current_step check (current_step >= 0),
  constraint learning_plans_steps_array check (jsonb_typeof(steps) = 'array')
);

create unique index learning_plans_student_module_revision
  on public.learning_plans (student_id, course_id, module_id, revision);

alter table public.learning_plans enable row level security;

revoke all on table public.learning_plans from public, anon, authenticated, service_role;
grant select, insert on table public.learning_plans to service_role;
