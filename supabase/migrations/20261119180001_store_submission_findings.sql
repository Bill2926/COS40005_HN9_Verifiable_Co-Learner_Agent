-- The misconceptions the submitted code shows, kept with the submission so the
-- Teacher can name them and the VerifyShield can check the claim later. An empty
-- array means the code showed none.
--
-- Idempotent, and versioned after the decision learning-pattern migration. The
-- first copy of this file used 20261119170000, the same version as
-- create_staff_access_log, so schema push tried to apply it again, stopped on
-- the column that was already there, and never reached the decision columns.

alter table public.submissions
  add column if not exists findings jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'submissions_findings_array'
      and conrelid = 'public.submissions'::regclass
  ) then
    alter table public.submissions
      add constraint submissions_findings_array check (jsonb_typeof(findings) = 'array');
  end if;
end
$$;
