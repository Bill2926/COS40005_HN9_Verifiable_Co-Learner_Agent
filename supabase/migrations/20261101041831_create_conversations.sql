create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  topic_id text not null,
  unique (student_id, topic_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sequence integer not null,
  author text not null,
  approved_move text,
  text text not null,
  exercise_id text not null,
  unique (conversation_id, sequence),
  constraint messages_author check (author in ('student', 'teacher', 'deskmate', 'event')),
  constraint messages_approved_move check (
    (author in ('teacher', 'deskmate') and approved_move is not null)
    or (author in ('student', 'event') and approved_move is null)
  )
);

create table public.resume_points (
  student_id uuid primary key references public.students (id) on delete cascade,
  topic_id text not null,
  exercise_id text not null
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.resume_points enable row level security;

grant select, insert, update, delete on table public.conversations to anon, authenticated;
grant select, insert, update, delete on table public.messages to anon, authenticated;
grant select, insert, update, delete on table public.resume_points to anon, authenticated;

grant all on table public.conversations to service_role;
grant all on table public.messages to service_role;
grant all on table public.resume_points to service_role;

revoke truncate, trigger, references on table public.conversations from anon, authenticated;
revoke truncate, trigger, references on table public.messages from anon, authenticated;
revoke truncate, trigger, references on table public.resume_points from anon, authenticated;

create or replace function private.assign_message_sequence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.conversations
  where id = new.conversation_id
  for update;

  select coalesce(max(public.messages.sequence), 0) + 1
  into new.sequence
  from public.messages
  where public.messages.conversation_id = new.conversation_id;

  return new;
end;
$$;

revoke all on function private.assign_message_sequence() from public, anon, authenticated;

create trigger assign_message_sequence
  before insert on public.messages
  for each row
  execute function private.assign_message_sequence();
