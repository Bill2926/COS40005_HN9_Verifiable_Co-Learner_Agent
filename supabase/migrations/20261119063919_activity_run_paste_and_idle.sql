-- The activity log gains the events later work will read: how a run ended,
-- the size of a paste, and going quiet in Practice mode and coming back.
-- A payload still cannot keep code, a draft or keystrokes.

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
  'profile_changed'
));
