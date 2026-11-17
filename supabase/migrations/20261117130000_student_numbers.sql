alter table public.students add column student_number text;

create sequence private.student_number_seq as bigint start with 1;

-- Every number ever handed out, including the current one. A row is never
-- removed or rewritten, so a retired number cannot be handed out again.
create table private.student_number_assignments (
  student_number text primary key,
  student_id uuid not null,
  assigned_at timestamptz not null default now()
);

create table public.student_number_changes (
  id bigint generated always as identity primary key,
  student_id uuid not null,
  old_number text not null,
  new_number text not null,
  actor_email text not null,
  changed_at timestamptz not null default now()
);

alter table public.student_number_changes enable row level security;
revoke all on table public.student_number_changes from public, anon, authenticated;
grant all on table public.student_number_changes to service_role;
revoke all on sequence public.student_number_changes_id_seq from public, anon, authenticated;
grant usage, select on sequence public.student_number_changes_id_seq to service_role;
revoke all on sequence private.student_number_seq from public, anon, authenticated;
grant usage, select on sequence private.student_number_seq to service_role;

-- Existing students take numbers in sign-up order. Staff have no number.
do $$
declare
  student record;
  suffix bigint;
  candidate text;
begin
  for student in
    select profile.id
    from public.students as profile
    join auth.users as account on account.id = profile.id
    where lower(coalesce(account.email, '')) not in ('owner@example.com', 'lecturer@example.com')
    order by account.created_at, account.id
  loop
    loop
      suffix := nextval('private.student_number_seq');
      candidate := 'SWB' || lpad(suffix::text, greatest(4, length(suffix::text)), '0');
      insert into private.student_number_assignments (student_number, student_id)
      values (candidate, student.id)
      on conflict (student_number) do nothing;
      if found then
        exit;
      end if;
    end loop;
    update public.students set student_number = candidate where id = student.id;
  end loop;
end;
$$;

create unique index students_student_number on public.students (student_number)
  where student_number is not null;

create function private.assign_student_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_email text;
  suffix bigint;
  candidate text;
begin
  if new.student_number is not null then
    return new;
  end if;
  select lower(coalesce(account.email, '')) into account_email
  from auth.users as account
  where account.id = new.id;
  if account_email in ('owner@example.com', 'lecturer@example.com') then
    return new;
  end if;
  loop
    suffix := nextval('private.student_number_seq');
    candidate := 'SWB' || lpad(suffix::text, greatest(4, length(suffix::text)), '0');
    insert into private.student_number_assignments (student_number, student_id)
    values (candidate, new.id)
    on conflict (student_number) do nothing;
    if found then
      new.student_number := candidate;
      return new;
    end if;
  end loop;
end;
$$;

revoke all on function private.assign_student_number() from public, anon, authenticated;

create trigger assign_student_number
before insert on public.students
for each row execute function private.assign_student_number();

create function private.set_student_number(actor_email text, target uuid, new_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_number text;
begin
  select student_number into old_number
  from public.students
  where id = target
  for update;
  if not found then
    return 'not-found';
  end if;
  if new_number is null or new_number !~ '^SWB[0-9]{4,}$' then
    return 'invalid';
  end if;
  if old_number is not distinct from new_number then
    return 'unchanged';
  end if;
  if exists (select 1 from public.students where student_number = new_number and id <> target) then
    return 'duplicate';
  end if;
  if exists (select 1 from private.student_number_assignments where student_number = new_number and student_id <> target) then
    return 'used';
  end if;
  update public.students set student_number = new_number where id = target;
  insert into private.student_number_assignments (student_number, student_id)
  values (new_number, target)
  on conflict (student_number) do nothing;
  insert into public.student_number_changes (student_id, old_number, new_number, actor_email)
  values (target, old_number, new_number, actor_email);
  return 'changed';
end;
$$;

revoke all on function private.set_student_number(text, uuid, text) from public, anon, authenticated;

-- The server calls this through PostgREST with the secret key; no browser role
-- may execute it.
create function public.set_student_number(actor_email text, target uuid, new_number text)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.set_student_number(actor_email, target, new_number);
$$;

revoke all on function public.set_student_number(text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_student_number(text, uuid, text) to service_role;

create view public.student_directory
with (security_invoker = false)
as
select
  profile.id,
  profile.display_name,
  profile.student_number,
  account.email
from public.students as profile
join auth.users as account on account.id = profile.id
where profile.student_number is not null;

revoke all on table public.student_directory from public, anon, authenticated;
grant select on table public.student_directory to service_role;
