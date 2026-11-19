-- Demo students An and Bình, the administrator and the lecturer. Keep emails, passwords,
-- and display names aligned with web/server/auth/demo-accounts.ts.

create or replace function private.seed_demo_student(
  student_id uuid,
  student_email text,
  student_password text,
  student_display_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    reauthentication_token,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    student_id,
    'authenticated',
    'authenticated',
    student_email,
    extensions.crypt(student_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', student_display_name),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  ) values (
    student_id,
    jsonb_build_object('sub', student_id::text, 'email', student_email),
    'email',
    student_id::text,
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    identity_data = excluded.identity_data,
    updated_at = now();

  insert into public.students (id, display_name)
  values (student_id, student_display_name)
  on conflict (id) do update set
    display_name = excluded.display_name;
end;
$$;

select private.seed_demo_student(
  'a11a11a1-1111-4111-8111-111111111111',
  'an@example.com',
  'an-demo-password',
  'An'
);

select private.seed_demo_student(
  'b22b22b2-2222-4222-8222-222222222222',
  'binh@example.com',
  'binh-demo-password',
  'Bình'
);

select private.seed_demo_student(
  'c33c33c3-3333-4333-8333-333333333333',
  'owner@example.com',
  'owner-demo-password',
  'Owner'
);

select private.seed_demo_student(
  'd44d44d4-4444-4444-8444-444444444444',
  'lecturer@example.com',
  'lecturer-demo-password',
  'Lecturer'
);

drop function private.seed_demo_student(uuid, text, text, text);

-- Demo evidence for Bình, in Introduction to Programming with Python (the course the
-- migrations create): one passing submission on every exercise of Modules
-- 1 to 4. Three first-time passes master a module, so that evidence alone
-- masters those four and opens Module 5, which is where she starts. No mastery
-- is stored anywhere; it is estimated from these rows every time the course
-- roadmap is drawn. An has no evidence and starts on Module 1.
delete from public.evidence
where student_id = 'b22b22b2-2222-4222-8222-222222222222';

insert into public.evidence (recorded_at, student_id, course_id, module_id, exercise_id, tests_passed, tests_total)
select
  timestamptz '2026-11-01 09:00:00+00' + (passed.step - 1) * interval '5 minutes',
  'b22b22b2-2222-4222-8222-222222222222'::uuid,
  'intro_python',
  passed.module_id,
  passed.exercise_id,
  3,
  3
from (values
  (1, 'getting_started', 'say_hello'),
  (2, 'getting_started', 'join_words'),
  (3, 'getting_started', 'sign_the_program'),
  (4, 'variables', 'total_cost'),
  (5, 'variables', 'whole_number'),
  (6, 'variables', 'old_enough'),
  (7, 'strings', 'first_character'),
  (8, 'strings', 'shout'),
  (9, 'strings', 'greeting'),
  (10, 'conditionals', 'sign_of'),
  (11, 'conditionals', 'ticket'),
  (12, 'conditionals', 'marked_result')
) as passed (step, module_id, exercise_id);
