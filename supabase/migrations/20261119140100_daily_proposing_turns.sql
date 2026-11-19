-- One student's proposing turns on one calendar day. The day is chosen by the
-- server (the Hanoi calendar day). The row counts only turns in which an agent
-- would be asked to propose, and it never passes 60: the function below is the
-- only writer, and it refuses the 61st instead of incrementing.
create table public.daily_turn_allowances (
  student_id uuid not null references public.students (id) on delete cascade,
  day date not null,
  taken integer not null,
  primary key (student_id, day),
  constraint daily_turn_allowances_taken_range check (taken >= 1 and taken <= 60)
);

alter table public.daily_turn_allowances enable row level security;

revoke all on table public.daily_turn_allowances from public, anon, authenticated;
grant all on table public.daily_turn_allowances to service_role;

-- Reserves one proposing turn. True when this turn is within the 60; false when
-- the day is already full. The insert-or-increment is one statement, so two
-- requests at the same moment cannot both pass the last turn.
create function public.take_daily_proposing_turn(p_student_id uuid, p_day date)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  taken_count integer;
begin
  insert into public.daily_turn_allowances as allowance (student_id, day, taken)
  values (p_student_id, p_day, 1)
  on conflict (student_id, day)
  do update set taken = allowance.taken + 1
  where allowance.taken < 60
  returning allowance.taken into taken_count;

  return taken_count is not null;
end;
$$;

revoke all on function public.take_daily_proposing_turn(uuid, date) from public, anon, authenticated;
grant execute on function public.take_daily_proposing_turn(uuid, date) to service_role;
