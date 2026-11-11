-- The decision log is written by the server with the secret key, which bypasses
-- row level security. No policy is created, so a student cannot read or write it.

create table public.decisions (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null,
  student_id uuid not null,
  turn_id uuid not null,
  agent text not null,
  proposed_move text not null,
  proposed_scope text,
  verdict text not null,
  ruled_move text,
  ruled_scope text,
  rule_id text not null,
  reason_code text not null,
  masteries jsonb not null,
  unlocked_module_ids jsonb not null,
  verify_shield_on boolean not null,
  constraint decisions_agent check (agent in ('teacher', 'deskmate')),
  constraint decisions_verdict check (verdict in ('allow', 'block', 'downgrade'))
);

alter table public.decisions enable row level security;

grant select, insert, update, delete on table public.decisions to anon, authenticated;
grant all on table public.decisions to service_role;

revoke truncate, trigger, references on table public.decisions from anon, authenticated;

revoke all on sequence public.decisions_id_seq from anon, authenticated;
grant usage, select on sequence public.decisions_id_seq to service_role;
