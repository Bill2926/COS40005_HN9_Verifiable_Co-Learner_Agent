-- Activity log, profile pictures, the student's mindmap, and quotes on messages.
-- The activity log is append-only: the server may insert and read, and nobody
-- may update or delete. Mindmap rows are readable by the owning student and
-- written only by the server. Quotes are part of the conversation record.

alter table public.students add column picture_path text;

alter table public.messages add column quote jsonb;

alter table public.messages drop constraint if exists messages_quote_shape;
alter table public.messages add constraint messages_quote_shape check (
  quote is null
  or (
    jsonb_typeof(quote) = 'object'
    and quote ->> 'source' in ('agent', 'materials')
    and length(coalesce(quote ->> 'text', '')) > 0
    and length(coalesce(quote ->> 'moduleId', '')) > 0
  )
);

alter table public.courses add column draft jsonb;

create table public.activity_log (
  id bigint generated always as identity primary key,
  student_id uuid not null,
  course_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_event_type check (event_type in (
    'signed_in',
    'module_opened',
    'mode_switched',
    'layout_switched',
    'code_run',
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
  )),
  constraint activity_log_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint activity_log_no_code check (not (payload ? 'code' or payload ? 'draft' or payload ? 'keystrokes'))
);

alter table public.activity_log enable row level security;
revoke all on table public.activity_log from public, anon, authenticated, service_role;
grant insert, select on table public.activity_log to service_role;
revoke all on sequence public.activity_log_id_seq from public, anon, authenticated;
grant usage, select on sequence public.activity_log_id_seq to service_role;

create table public.mindmap_positions (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null,
  module_id text not null,
  x double precision not null,
  y double precision not null,
  primary key (student_id, course_id, module_id)
);

create table public.mindmap_notes (
  id uuid primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null,
  text text not null,
  colour text not null,
  image_path text,
  x double precision not null,
  y double precision not null,
  constraint mindmap_notes_colour check (colour in ('ink', 'brand', 'sky', 'emerald', 'amber', 'rose', 'purple'))
);

create table public.mindmap_links (
  id uuid primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null,
  from_note_id uuid not null references public.mindmap_notes (id) on delete cascade,
  target_kind text not null,
  target_id text not null,
  constraint mindmap_links_target check (target_kind in ('module', 'note')),
  unique (student_id, course_id, from_note_id, target_kind, target_id)
);

alter table public.mindmap_positions enable row level security;
alter table public.mindmap_notes enable row level security;
alter table public.mindmap_links enable row level security;

revoke all on table public.mindmap_positions, public.mindmap_notes, public.mindmap_links from public, anon, authenticated;
grant select on table public.mindmap_positions, public.mindmap_notes, public.mindmap_links to authenticated;
grant all on table public.mindmap_positions, public.mindmap_notes, public.mindmap_links to service_role;

-- Supabase provides auth.uid(). The migration test has no Auth schema functions,
-- so a missing uid() is a stub that matches nobody.
do $$
begin
  if not exists (
    select 1
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'auth' and proc.proname = 'uid'
  ) then
    create function auth.uid() returns uuid language sql stable as $fn$ select null::uuid $fn$;
  end if;
end;
$$;

create policy mindmap_positions_own on public.mindmap_positions
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy mindmap_notes_own on public.mindmap_notes
  for select to authenticated
  using (student_id = (select auth.uid()));

create policy mindmap_links_own on public.mindmap_links
  for select to authenticated
  using (student_id = (select auth.uid()));

-- The seeded Python course keeps its old materials. Module 1 also gains a diagram
-- and a video so the demo shows those blocks. Other modules stay in the old
-- shape; the server converts them when it reads the spec.
update public.courses
set spec = jsonb_set(
  jsonb_set(spec, '{specVersion}', '2'::jsonb),
  '{modules,0,content,materials}',
  $materials$[
    {"type":"text","markdown":"## A first program\n\nA program is a list of steps the computer follows. print() shows text, and a comment, a line that starts with #, is a note for a person. Python skips comments."},
    {"type":"code","code":"# Show a greeting\nprint(\"Hello, world\")"},
    {"type":"text","markdown":"**Key point.** The text you want to show sits inside quotes. A comment starts with # and is not run.\n\nThese materials belong to this module alone."},
    {"type":"diagram","mermaid":"flowchart LR\n  program[A program] --> shown[\"print()\"]"},
    {"type":"video","url":"https://www.youtube.com/watch?v=kqtD5dpn9C8","title":"A first Python program"}
  ]$materials$::jsonb
)
where id = 'intro_python'
  and jsonb_typeof(spec #> '{modules,0,content,materials}') = 'object';

-- Profile pictures and note images. Present only on Supabase, which has Storage.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('student-files', 'student-files', false)
    on conflict (id) do nothing;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    execute 'drop policy if exists student_files_select_own on storage.objects';
    execute 'drop policy if exists student_files_insert_own on storage.objects';
    execute 'drop policy if exists student_files_update_own on storage.objects';
    execute 'drop policy if exists student_files_delete_own on storage.objects';
    execute $policy$
      create policy student_files_select_own on storage.objects
      for select to authenticated
      using (
        bucket_id = 'student-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    $policy$;
    execute $policy$
      create policy student_files_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'student-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    $policy$;
    execute $policy$
      create policy student_files_update_own on storage.objects
      for update to authenticated
      using (
        bucket_id = 'student-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    $policy$;
    execute $policy$
      create policy student_files_delete_own on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'student-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
    $policy$;
  end if;
end;
$$;
