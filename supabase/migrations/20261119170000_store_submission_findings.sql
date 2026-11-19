-- The misconceptions the submitted code shows, kept with the submission so the
-- Teacher can name them and the VerifyShield can check the claim later. An empty
-- array means the code showed none.

alter table public.submissions
  add column findings jsonb not null default '[]'::jsonb;

alter table public.submissions
  add constraint submissions_findings_array check (jsonb_typeof(findings) = 'array');
