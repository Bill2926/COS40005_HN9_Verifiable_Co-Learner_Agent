-- A student reads their conversation through their own sign-in. Row level security
-- keeps every other student's conversations and messages out of reach, so a query
-- that forgets the student filter, or names another student, comes back empty.
-- Writes stay with the secret key.

grant select on table public.conversations, public.messages to authenticated;

drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
  for select to authenticated
  using (student_id = (select auth.uid()));

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated
  using (exists (
    select 1
    from public.conversations
    where public.conversations.id = public.messages.conversation_id
      and public.conversations.student_id = (select auth.uid())
  ));
