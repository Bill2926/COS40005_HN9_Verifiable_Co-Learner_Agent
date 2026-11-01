create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table public.students (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
);

alter table public.students enable row level security;

grant select, insert, update, delete on table public.students to anon, authenticated;
grant all on table public.students to service_role;

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
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Student')
  );
  return new;
end;
$$;

revoke all on function private.create_student_for_new_user() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.create_student_for_new_user() to supabase_auth_admin;

create trigger create_student_for_new_user
  after insert on auth.users
  for each row
  execute function private.create_student_for_new_user();
