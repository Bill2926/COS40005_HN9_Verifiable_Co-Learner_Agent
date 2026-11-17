-- Each decision keeps the ordered rule checks the VerifyShield made, ending with
-- the deciding one. Rows recorded before this change keep null, which the
-- product owner's verdict drawer reads as "not recorded" rather than "none".

alter table public.decisions
  add column if not exists rule_checks jsonb;

alter table public.decisions
  drop constraint if exists decisions_rule_checks_array;

alter table public.decisions
  add constraint decisions_rule_checks_array
  check (rule_checks is null or jsonb_typeof(rule_checks) = 'array');
