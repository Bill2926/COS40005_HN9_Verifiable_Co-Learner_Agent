-- The evidence ledger is written by the server with the secret key, which
-- bypasses row level security. No policy is created, so a student can neither
-- read nor write it. One row per submission, appended and never changed.

create table public.evidence (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  student_id uuid not null references public.students (id) on delete cascade,
  module_id text not null,
  exercise_id text not null,
  attempt integer not null,
  tests_passed integer not null,
  tests_total integer not null,
  all_passed boolean generated always as (tests_passed = tests_total) stored,
  constraint evidence_tests_total check (tests_total > 0),
  constraint evidence_tests_passed check (tests_passed between 0 and tests_total),
  unique (student_id, module_id, exercise_id, attempt)
);

create index evidence_student_recorded_at on public.evidence (student_id, recorded_at, id);

alter table public.evidence enable row level security;

grant select, insert, update, delete on table public.evidence to anon, authenticated;
grant all on table public.evidence to service_role;

revoke truncate, trigger, references on table public.evidence from anon, authenticated;

revoke all on sequence public.evidence_id_seq from anon, authenticated;
grant usage, select on sequence public.evidence_id_seq to service_role;

-- The attempt number is the ledger's to assign, not the caller's. The advisory
-- lock serialises two submissions on the same exercise so both get a number.
create or replace function private.assign_evidence_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    new.student_id::text || '|' || new.module_id || '|' || new.exercise_id, 0));

  select coalesce(max(public.evidence.attempt), 0) + 1
  into new.attempt
  from public.evidence
  where public.evidence.student_id = new.student_id
    and public.evidence.module_id = new.module_id
    and public.evidence.exercise_id = new.exercise_id;

  return new;
end;
$$;

revoke all on function private.assign_evidence_attempt() from public, anon, authenticated;

create trigger assign_evidence_attempt
  before insert on public.evidence
  for each row
  execute function private.assign_evidence_attempt();
