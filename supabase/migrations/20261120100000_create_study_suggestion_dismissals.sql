-- The study suggestions a student has dismissed. The suggestion itself is
-- chosen from the activity log by fixed rules and never stored; only the
-- closing of an episode is. One row per student, course and step: `step` is the
-- step's identity (the situation, module, exercise and error type it names) and
-- `anchor` is the id of the activity_log row the episode was anchored on when it
-- was dismissed. A dismissal is not evidence and changes no mastery.

create table public.study_suggestion_dismissals (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  step text not null,
  anchor bigint not null,
  dismissed_at timestamptz not null default now(),
  primary key (student_id, course_id, step),
  constraint study_suggestion_dismissals_step check (length(step) between 1 and 300)
);

alter table public.study_suggestion_dismissals enable row level security;

revoke all on table public.study_suggestion_dismissals from public, anon, authenticated, service_role;
grant select, insert, update on table public.study_suggestion_dismissals to service_role;
