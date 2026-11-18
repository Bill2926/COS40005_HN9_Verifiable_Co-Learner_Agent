-- The campus a student studies at. It is empty until the student chooses it,
-- once, at sign-in; afterwards only the product owner changes it, and each
-- change is recorded. Staff have no campus.
alter table public.students
  add column campus text
  check (campus in ('Hanoi', 'Da Nang', 'Ho Chi Minh City', 'Can Tho'));

create table public.campus_changes (
  id bigint generated always as identity primary key,
  student_id uuid not null,
  old_campus text,
  new_campus text not null,
  actor_email text not null,
  changed_at timestamptz not null default now()
);

alter table public.campus_changes enable row level security;
revoke all on table public.campus_changes from public, anon, authenticated;
grant all on table public.campus_changes to service_role;
revoke all on sequence public.campus_changes_id_seq from public, anon, authenticated;
grant usage, select on sequence public.campus_changes_id_seq to service_role;

-- The student's first and only choice. It writes nothing once a campus is set.
create function private.choose_student_campus(target uuid, new_campus text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_campus text;
begin
  if new_campus is null or new_campus not in ('Hanoi', 'Da Nang', 'Ho Chi Minh City', 'Can Tho') then
    return 'invalid';
  end if;
  select campus into current_campus
  from public.students
  where id = target
  for update;
  if not found then
    return 'not-found';
  end if;
  if current_campus is not null then
    return 'already-chosen';
  end if;
  update public.students set campus = new_campus where id = target;
  return 'chosen';
end;
$$;

revoke all on function private.choose_student_campus(uuid, text) from public, anon, authenticated;

create function public.choose_student_campus(target uuid, new_campus text)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.choose_student_campus(target, new_campus);
$$;

revoke all on function public.choose_student_campus(uuid, text) from public, anon, authenticated;
grant execute on function public.choose_student_campus(uuid, text) to service_role;

-- The product owner's correction, recorded with who and when.
create function private.set_student_campus(actor_email text, target uuid, new_campus text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_campus text;
begin
  if new_campus is null or new_campus not in ('Hanoi', 'Da Nang', 'Ho Chi Minh City', 'Can Tho') then
    return 'invalid';
  end if;
  select campus into old_campus
  from public.students
  where id = target
  for update;
  if not found then
    return 'not-found';
  end if;
  if old_campus is not distinct from new_campus then
    return 'unchanged';
  end if;
  update public.students set campus = new_campus where id = target;
  insert into public.campus_changes (student_id, old_campus, new_campus, actor_email)
  values (target, old_campus, new_campus, actor_email);
  return 'changed';
end;
$$;

revoke all on function private.set_student_campus(text, uuid, text) from public, anon, authenticated;

create function public.set_student_campus(actor_email text, target uuid, new_campus text)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.set_student_campus(actor_email, target, new_campus);
$$;

revoke all on function public.set_student_campus(text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_student_campus(text, uuid, text) to service_role;

-- A student who signs in by email code has no display name to give, so the
-- part of the email before the @ is used until they change it.
create or replace function private.create_student_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.students (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Student'
    )
  );
  return new;
end;
$$;

create or replace view public.student_directory
with (security_invoker = false)
as
select
  profile.id,
  profile.display_name,
  profile.student_number,
  account.email,
  profile.campus
from public.students as profile
join auth.users as account on account.id = profile.id
where profile.student_number is not null;
