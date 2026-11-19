-- The turn's module and the learning pattern snapshot the Teacher saw, kept on
-- each decision for audit. Both nullable: rows from before they were recorded
-- hold null.
alter table public.decisions
  add column if not exists module_id text,
  add column if not exists learning_pattern jsonb;
