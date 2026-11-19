-- An administrator can delete one student's records completely, and nobody can
-- edit a single row of a ledger.
--
-- delete_student_records removes the student's account. Most tables follow it
-- through `on delete cascade` (submissions, learning plans and their revisions,
-- evidence, quiz answers, conversations, enrolments and the rest). The tables
-- with no foreign key to the student are cleared here: the activity log, the
-- decision log, the staff access log and the two change logs. The function is
-- the only way those append-only tables lose rows, and it only ever removes
-- every row of one student. Another student's rows are not touched.
--
-- A decision is chained to the one before it, so removing a student's decisions
-- would break the chain at every gap. Each decision that followed a removed one
-- is linked to the decision that remains before it. content_hash is not
-- changed, so a row that was edited still shows up in verify_decision_chain.
-- The student number assignments stay: a retired number is never given out
-- again, and the row holds a number and an id, nothing else.

create function public.delete_student_records(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision record;
  prior_hash text := 'genesis';
  after_removed boolean := false;
begin
  if not exists (select 1 from public.students as student where student.id = target) then
    return 'not-found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(872341);

  for decision in
    select existing.id, existing.student_id, existing.content_hash
    from public.decisions as existing
    order by existing.id
  loop
    if decision.student_id = target then
      after_removed := true;
    else
      if after_removed then
        update public.decisions as stored
        set previous_hash = prior_hash
        where stored.id = decision.id;
        after_removed := false;
      end if;
      prior_hash := decision.content_hash;
    end if;
  end loop;

  delete from public.decisions as removed where removed.student_id = target;
  delete from public.activity_log as removed where removed.student_id = target;
  delete from public.staff_access_log as removed where removed.student_id = target;
  delete from public.campus_changes as removed where removed.student_id = target;
  delete from public.student_number_changes as removed where removed.student_id = target;

  delete from auth.users as removed where removed.id = target;
  return 'deleted';
end;
$$;

revoke all on function public.delete_student_records(uuid) from public, anon, authenticated;
grant execute on function public.delete_student_records(uuid) to service_role;

-- A ledger row is never rewritten. Nothing updates these tables; the server key
-- could, so it loses that too. Delete stays for the demo reset and the e2e
-- cleanup, which clear whole students' rows.
revoke update on table public.evidence, public.quiz_answers, public.decisions from service_role;
