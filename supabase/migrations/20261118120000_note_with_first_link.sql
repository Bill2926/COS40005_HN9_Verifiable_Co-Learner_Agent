-- A note is written together with its first link in one transaction, so a
-- note never exists without a link. Returns false, and writes nothing, when the
-- link points at a note the student does not have.
create function public.insert_mindmap_note(
  p_student_id uuid,
  p_course_id text,
  p_note_id uuid,
  p_text text,
  p_colour text,
  p_x double precision,
  p_y double precision,
  p_link_id uuid,
  p_target_kind text,
  p_target_id text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_target_kind = 'note' and not exists (
    select 1 from public.mindmap_notes
    where id::text = p_target_id and student_id = p_student_id and course_id = p_course_id
  ) then
    return false;
  end if;

  insert into public.mindmap_notes (id, student_id, course_id, text, colour, x, y)
  values (p_note_id, p_student_id, p_course_id, p_text, p_colour, p_x, p_y);

  insert into public.mindmap_links (id, student_id, course_id, from_note_id, target_kind, target_id)
  values (p_link_id, p_student_id, p_course_id, p_note_id, p_target_kind, p_target_id);
  return true;
end;
$$;

revoke execute on function public.insert_mindmap_note(uuid, text, uuid, text, text, double precision, double precision, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.insert_mindmap_note(uuid, text, uuid, text, text, double precision, double precision, uuid, text, text) to service_role;
