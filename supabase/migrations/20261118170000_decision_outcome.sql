-- A decision ends one of two ways: the VerifyShield ruled on a proposed move ('ruled'), or the
-- Teacher reached its tool step cap before proposing one ('step_cap'), which is not a ruling and so
-- carries no verdict, rule or reason. Step caps logged before this as a 'step_cap' block are moved
-- to their own outcome.

alter table public.decisions
  add column if not exists outcome text not null default 'ruled';

alter table public.decisions alter column verdict drop not null;
alter table public.decisions alter column rule_id drop not null;
alter table public.decisions alter column reason_code drop not null;

update public.decisions
  set outcome = 'step_cap', verdict = null, rule_id = null, reason_code = null, rule_checks = null
  where rule_id = 'step_cap';

alter table public.decisions drop constraint if exists decisions_outcome;
alter table public.decisions
  add constraint decisions_outcome check (
    (outcome = 'ruled' and verdict is not null and rule_id is not null and reason_code is not null)
    or (outcome = 'step_cap' and verdict is null and rule_id is null and reason_code is null)
  );
