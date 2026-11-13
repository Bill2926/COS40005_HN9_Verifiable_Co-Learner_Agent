-- The evidence ledger is append-only. It already has no RLS policy, so a
-- student cannot reach it, but update and delete are revoked from the anon and
-- authenticated roles as well, so the guarantee holds even if a policy is ever
-- added. This matches the quiz-answers ledger, which is revoked at creation.

revoke update, delete on table public.evidence from anon, authenticated;
