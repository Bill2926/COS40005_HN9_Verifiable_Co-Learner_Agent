-- Stored mastery (ADR 0008): each student's mastery of each module of a course, kept so that every
-- reader shows one number. Only the server writes it, with the secret key, and only from a recompute
-- over the evidence ledger (ADR 0002). Row level security is enabled and no policy is created, and
-- every privilege is revoked from anon and authenticated, so no student or lecturer role can read
-- or change it. The server deletes a student's rows for a course before inserting the new picture,
-- so a module the course no longer has leaves no row behind.

create table public.module_masteries (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  module_id text not null,
  mastery double precision not null check (mastery between 0 and 1),
  passed_exercise boolean not null default false,
  ever_mastered boolean not null default false,
  primary key (student_id, course_id, module_id)
);

-- A recompute writes one student's whole picture at a time, and a publish reads every enrolled
-- student's rows for one course.
create index module_masteries_course_student
  on public.module_masteries (course_id, student_id);

alter table public.module_masteries enable row level security;
revoke all on public.module_masteries from anon, authenticated;
grant select, insert, update, delete on public.module_masteries to service_role;
