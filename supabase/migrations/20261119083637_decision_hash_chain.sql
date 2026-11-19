-- Each decision stores a hash of its content and the hash of the decision before
-- it. The database sets both on insert, so a caller cannot choose them. The
-- first decision's previous hash is the starting point 'genesis', and decisions
-- already stored are hashed from that same point. md5 is in core Postgres, so a
-- replay of these migrations hashes the same way as the shared project. The
-- chain makes a one-row edit visible. Rewriting every later hash can still leave
-- it looking intact.
--
-- verify_decision_chain() is the one command: it returns the id of the first
-- broken row, or null when every row still matches.

alter table public.decisions
  add column if not exists content_hash text,
  add column if not exists previous_hash text,
  add column if not exists code_version text,
  add column if not exists course_history_id bigint references public.course_history (id);

create index if not exists decisions_course_history_id
  on public.decisions (course_history_id);

-- Listed columns only. A column added later stays out of the hash until this
-- function names it, so existing hashes do not change underneath the chain.
create or replace function private.decision_content_hash(decision public.decisions)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.md5(pg_catalog.jsonb_build_object(
    'addressed_agent', decision.addressed_agent,
    'agent', decision.agent,
    'code_version', decision.code_version,
    'course_history_id', decision.course_history_id,
    'course_id', decision.course_id,
    'id', decision.id,
    'masteries', decision.masteries,
    'mastery_threshold', decision.mastery_threshold,
    'outcome', decision.outcome,
    'proposed_move', decision.proposed_move,
    'proposed_scope', decision.proposed_scope,
    'reason_code', decision.reason_code,
    -- UTC, so the same instant hashes the same way in every session time zone.
    'recorded_at', pg_catalog.to_char(decision.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    'rule_checks', decision.rule_checks,
    'rule_id', decision.rule_id,
    'ruled_move', decision.ruled_move,
    'ruled_scope', decision.ruled_scope,
    'student_id', decision.student_id,
    'tool_trace', decision.tool_trace,
    'turn_id', decision.turn_id,
    'unlocked_module_ids', decision.unlocked_module_ids,
    'verdict', decision.verdict,
    'verify_shield_on', decision.verify_shield_on
  )::text);
$$;

revoke all on function private.decision_content_hash(public.decisions) from public, anon, authenticated;
grant execute on function private.decision_content_hash(public.decisions) to service_role;

-- Decisions already stored join the chain. The course history entry in force
-- for one of them is the latest entry for its course at the time it was recorded.
do $$
declare
  decision public.decisions;
  prior text := 'genesis';
begin
  for decision in
    select existing.*
    from public.decisions as existing
    order by existing.id
  loop
    select history.id into decision.course_history_id
    from public.course_history as history
    where history.course_id = decision.course_id
      and history.recorded_at <= decision.recorded_at
    order by history.recorded_at desc, history.id desc
    limit 1;

    decision.previous_hash := prior;
    decision.content_hash := private.decision_content_hash(decision);

    update public.decisions as stored
    set course_history_id = decision.course_history_id,
        previous_hash = decision.previous_hash,
        content_hash = decision.content_hash
    where stored.id = decision.id;

    prior := decision.content_hash;
  end loop;
end;
$$;

alter table public.decisions alter column content_hash set not null;
alter table public.decisions alter column previous_hash set not null;

alter table public.decisions drop constraint if exists decisions_content_hash_md5;
alter table public.decisions
  add constraint decisions_content_hash_md5 check (content_hash ~ '^[0-9a-f]{32}$');

alter table public.decisions drop constraint if exists decisions_previous_hash_link;
alter table public.decisions
  add constraint decisions_previous_hash_link check (
    previous_hash = 'genesis' or previous_hash ~ '^[0-9a-f]{32}$'
  );

-- Inserts take one lock so two decisions at the same moment cannot both chain
-- from the same predecessor. The course history entry in force is the latest
-- one for the decision's course, whatever the caller sent.
create or replace function private.stamp_decision_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior text;
begin
  perform pg_catalog.pg_advisory_xact_lock(872341);

  select history.id into new.course_history_id
  from public.course_history as history
  where history.course_id = new.course_id
  order by history.recorded_at desc, history.id desc
  limit 1;

  select existing.content_hash into prior
  from public.decisions as existing
  order by existing.id desc
  limit 1;

  new.previous_hash := coalesce(prior, 'genesis');
  new.content_hash := private.decision_content_hash(new);
  return new;
end;
$$;

revoke all on function private.stamp_decision_chain() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.stamp_decision_chain() to service_role;

drop trigger if exists stamp_decision_chain on public.decisions;
create trigger stamp_decision_chain
  before insert on public.decisions
  for each row
  execute function private.stamp_decision_chain();

create or replace function public.verify_decision_chain()
returns bigint
language plpgsql
volatile
set search_path = ''
as $$
declare
  decision public.decisions;
  expected text := 'genesis';
begin
  perform pg_catalog.pg_advisory_xact_lock(872341);
  for decision in
    select existing.*
    from public.decisions as existing
    order by existing.id
  loop
    if decision.previous_hash is distinct from expected
       or decision.content_hash is distinct from private.decision_content_hash(decision)
    then
      return decision.id;
    end if;
    expected := decision.content_hash;
  end loop;
  return null;
end;
$$;

revoke all on function public.verify_decision_chain() from public, anon, authenticated;
grant execute on function public.verify_decision_chain() to service_role;
