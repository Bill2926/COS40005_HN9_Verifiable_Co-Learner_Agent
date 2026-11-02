alter table public.messages drop constraint messages_approved_move;

alter table public.messages add constraint messages_approved_move check (
  (author in ('student', 'event') and approved_move is null)
  or author in ('teacher', 'deskmate')
);
