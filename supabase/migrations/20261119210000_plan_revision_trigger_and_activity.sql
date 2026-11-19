-- A plan revision records what brought it about and the decision-log entry that
-- ruled on it, and the activity log gains the events the plan reads.

alter table public.learning_plans
  add column trigger text,
  add column decision_turn_id uuid;

alter table public.activity_log drop constraint activity_log_event_type;

alter table public.activity_log add constraint activity_log_event_type check (event_type in (
  'signed_in',
  'module_opened',
  'mode_switched',
  'layout_switched',
  'code_run',
  'run_finished',
  'pasted',
  'went_idle',
  'returned',
  'submitted',
  'quiz_answered',
  'message_sent',
  'note_created',
  'note_changed',
  'note_linked',
  'note_unlinked',
  'note_deleted',
  'mindmap_moved',
  'profile_changed',
  'approach_written',
  'plan_agreed',
  'idle_check_in'
));
