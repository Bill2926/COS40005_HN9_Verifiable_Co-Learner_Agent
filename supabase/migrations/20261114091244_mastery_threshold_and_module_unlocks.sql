create table public.module_unlocks (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null references public.courses (id) on delete cascade,
  module_id text not null,
  primary key (student_id, course_id, module_id)
);

alter table public.module_unlocks enable row level security;
revoke all on public.module_unlocks from anon, authenticated;
grant select, insert on public.module_unlocks to service_role;

alter table public.decisions
  add column mastery_threshold double precision not null default 0.9
  check (mastery_threshold > 0 and mastery_threshold <= 1);

alter table public.course_history
  add column previous_threshold double precision,
  add column mastery_threshold double precision;

-- The first threshold change records the cutoff for unlocks earned before
-- the permanent unlock ledger was introduced.
alter table public.courses
  add column legacy_unlocks_before timestamptz,
  add column legacy_unlock_threshold double precision;

create function public.set_course_mastery_threshold(course_key text, lecturer_email text, new_threshold double precision)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  previous double precision;
begin
  if new_threshold is null or not (new_threshold between 0.5 and 0.99) then
    raise exception 'Mastery threshold must be between 0.5 and 0.99' using errcode = '22023';
  end if;

  select (spec ->> 'masteryThreshold')::double precision into previous
  from public.courses
  where id = course_key and owner_email = lecturer_email
  for update;
  if not found then
    return false;
  end if;
  if previous = new_threshold then
    return true;
  end if;

  update public.courses
  set legacy_unlocks_before = coalesce(legacy_unlocks_before, statement_timestamp()),
      legacy_unlock_threshold = coalesce(legacy_unlock_threshold, previous),
      spec = jsonb_set(spec, '{masteryThreshold}', to_jsonb(new_threshold)),
      updated_at = now()
  where id = course_key;

  insert into public.course_history (course_id, action, actor_email, previous_threshold, mastery_threshold)
  values (course_key, 'mastery_threshold_changed', lecturer_email, previous, new_threshold);
  return true;
end;
$$;

revoke all on function public.set_course_mastery_threshold(text, text, double precision)
  from public, anon, authenticated;
grant execute on function public.set_course_mastery_threshold(text, text, double precision)
  to service_role;
