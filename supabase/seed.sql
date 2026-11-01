-- Demo students An and Bình. Keep emails, passwords, and display names
-- aligned with web/server/auth/demo-accounts.ts.

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

drop function private.seed_demo_student(uuid, text, text, text);
