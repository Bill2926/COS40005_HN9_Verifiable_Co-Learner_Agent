alter table public.courses add column owner_email text;

update public.courses
set owner_email = 'lecturer@example.com'
where id = 'intro_python';

create index courses_owner_email on public.courses (owner_email);

create table public.enrollments (
  course_id text not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create table public.course_history (
  id bigint generated always as identity primary key,
  course_id text not null references public.courses (id) on delete cascade,
  action text not null,
  actor_email text not null,
  recorded_at timestamptz not null default now()
);

create index course_history_course_recorded_at
  on public.course_history (course_id, recorded_at desc, id desc);

alter table public.enrollments enable row level security;
alter table public.course_history enable row level security;
revoke all on table public.enrollments, public.course_history from anon, authenticated;
grant all on table public.enrollments, public.course_history to service_role;
revoke all on sequence public.course_history_id_seq from anon, authenticated;
grant usage, select on sequence public.course_history_id_seq to service_role;

-- The demo staff accounts also have student-profile rows for sign-in.
create function private.enroll_new_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.enrollments (course_id, student_id)
  select 'intro_python', new.id
  from auth.users
  where id = new.id
    and lower(coalesce(email, '')) not in ('owner@example.com', 'lecturer@example.com')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.enroll_new_student() from public, anon, authenticated;

create trigger enroll_new_student
after insert on public.students
for each row execute function private.enroll_new_student();

insert into public.enrollments (course_id, student_id)
select 'intro_python', student.id
from public.students as student
join auth.users as account on account.id = student.id
where lower(coalesce(account.email, '')) not in ('owner@example.com', 'lecturer@example.com')
on conflict do nothing;

insert into public.course_history (course_id, action, actor_email, recorded_at)
select id, 'seeded', owner_email, updated_at
from public.courses
where id = 'intro_python';
