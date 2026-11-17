-- A reset is an account choice, so another device's old local arrangement
-- cannot bring back positions that the student reset.
create table public.mindmap_arrangement_resets (
  student_id uuid not null references public.students (id) on delete cascade,
  course_id text not null,
  primary key (student_id, course_id)
);

alter table public.mindmap_arrangement_resets enable row level security;
revoke all on table public.mindmap_arrangement_resets from public, anon, authenticated;
grant select, insert, delete on table public.mindmap_arrangement_resets to service_role;

-- A null arrangement resets the positions. A non-empty array imports a legacy
-- arrangement only if the student has neither positions nor a previous reset.
create function public.update_mindmap_arrangement(
  p_student_id uuid,
  p_course_id text,
  p_positions jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_student_id::text || ':' || p_course_id, 0)
  );

  if p_positions is null then
    insert into public.mindmap_arrangement_resets (student_id, course_id)
    values (p_student_id, p_course_id)
    on conflict do nothing;

    delete from public.mindmap_positions
    where student_id = p_student_id and course_id = p_course_id;
    return found;
  end if;

  if exists (
    select 1 from public.mindmap_arrangement_resets
    where student_id = p_student_id and course_id = p_course_id
  ) or exists (
    select 1 from public.mindmap_positions
    where student_id = p_student_id and course_id = p_course_id
  ) then
    return false;
  end if;

  insert into public.mindmap_positions (student_id, course_id, module_id, x, y)
  select p_student_id, p_course_id, pos."moduleId", pos.x, pos.y
  from pg_catalog.jsonb_to_recordset(p_positions) as pos("moduleId" text, x double precision, y double precision)
  on conflict do nothing;
  return found;
end;
$$;

revoke execute on function public.update_mindmap_arrangement(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.update_mindmap_arrangement(uuid, text, jsonb) to service_role;
