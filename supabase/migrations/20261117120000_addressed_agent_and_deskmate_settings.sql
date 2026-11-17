-- A student message keeps the agent it was addressed to with an `@` tag, and
-- each decision keeps the addressed agent of its turn. Existing rows keep null,
-- which reads as "no agent addressed".
alter table public.messages
  add column if not exists addressed_agent text;

alter table public.messages
  drop constraint if exists messages_addressed_agent_known;

alter table public.messages
  add constraint messages_addressed_agent_known
  check (addressed_agent is null or addressed_agent in ('teacher', 'deskmate'));

alter table public.decisions
  add column if not exists addressed_agent text;

alter table public.decisions
  drop constraint if exists decisions_addressed_agent_known;

alter table public.decisions
  add constraint decisions_addressed_agent_known
  check (addressed_agent is null or addressed_agent in ('teacher', 'deskmate'));

-- The student's deskmate switch, the same in every course. No row means on.
-- Only the server reads and writes it, for the session student.
create table if not exists public.deskmate_settings (
  student_id uuid primary key references public.students (id) on delete cascade,
  enabled boolean not null default true
);

alter table public.deskmate_settings enable row level security;

revoke all on table public.deskmate_settings from anon, authenticated;
grant all on table public.deskmate_settings to service_role;
