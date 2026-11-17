-- Messages written from now on carry the time they were written. Existing
-- messages keep none: the column is added first, then given its default, so
-- no row is backfilled with a wrong time.
alter table public.messages add column if not exists created_at timestamptz;
alter table public.messages alter column created_at set default now();
