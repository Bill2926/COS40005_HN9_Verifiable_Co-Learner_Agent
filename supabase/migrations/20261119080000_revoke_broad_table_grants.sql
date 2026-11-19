-- The older tables were created with select, insert, update and delete granted to
-- anon and authenticated. Row level security hid the rows, but the grants
-- remained, so a policy added later would hand a student the whole table.
-- Only the secret key reaches them. service_role keeps the grants it already has.

revoke all on table
  public.students,
  public.conversations,
  public.messages,
  public.resume_points,
  public.model_settings,
  public.verify_shield_settings,
  public.decisions,
  public.evidence,
  public.quiz_answers
from public, anon, authenticated;
