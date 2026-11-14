create function public.import_course_spec(lecturer_email text, new_spec jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  previous double precision;
  new_threshold double precision;
begin
  if new_spec ->> 'courseId' is distinct from 'intro_python' then
    raise exception 'The course spec must be for the Python course' using errcode = '22023';
  end if;
  new_threshold := (new_spec ->> 'masteryThreshold')::double precision;
  if new_threshold is null or not (new_threshold between 0.5 and 0.99) then
    raise exception 'Mastery threshold must be between 0.5 and 0.99' using errcode = '22023';
  end if;

  select (spec ->> 'masteryThreshold')::double precision into previous
  from public.courses
  where id = 'intro_python' and owner_email = lecturer_email
  for update;
  if not found then
    return false;
  end if;

  update public.courses
  set title = new_spec ->> 'title',
      spec = new_spec,
      updated_at = now(),
      legacy_unlocks_before = coalesce(legacy_unlocks_before, case when previous <> new_threshold then statement_timestamp() end),
      legacy_unlock_threshold = coalesce(legacy_unlock_threshold, case when previous <> new_threshold then previous end)
  where id = 'intro_python' and spec is distinct from new_spec;

  insert into public.course_history (course_id, action, actor_email)
  values ('intro_python', 'course_spec_imported', lecturer_email);
  return true;
end;
$$;

revoke all on function public.import_course_spec(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_course_spec(text, jsonb) to service_role;
