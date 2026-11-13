-- The quiz-answer ledger is written by the server with the secret key, which
-- bypasses row level security. No policy is created, so a student can neither
-- read nor write it. One row per question, so only the first answer is kept;
-- later choices a student makes to explore are never written.

create table public.quiz_answers (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  module_id text not null,
  question_id text not null,
  choice smallint not null,
  correct boolean not null,
  constraint quiz_answers_choice check (choice between 0 and 3),
  unique (student_id, module_id, question_id)
);

create index quiz_answers_student_module_recorded_at
  on public.quiz_answers (student_id, module_id, recorded_at, id);

alter table public.quiz_answers enable row level security;

-- A student may neither read nor write the ledger: no policy is created, and
-- update and delete are revoked so even a future policy cannot hand them over.
grant select, insert on table public.quiz_answers to anon, authenticated;
grant all on table public.quiz_answers to service_role;

revoke update, delete, truncate, trigger, references on table public.quiz_answers from anon, authenticated;

revoke all on sequence public.quiz_answers_id_seq from anon, authenticated;
grant usage, select on sequence public.quiz_answers_id_seq to service_role;

-- Both ledgers are append-only. A student can change neither, so update and
-- delete leave the evidence ledger too.
revoke update, delete on table public.evidence from anon, authenticated;
