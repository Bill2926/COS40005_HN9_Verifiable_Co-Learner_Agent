import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'
const submission = 'c33c33c3-3333-4333-8333-333333333333'

it('keeps a submission for the server alone, and refuses a change', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create role supabase_auth_admin;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz not null default now());
      create function auth.jwt() returns jsonb language sql stable
        as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table storage.objects (id serial primary key, bucket_id text, name text);
      create function storage.foldername(name text) returns text[] language sql
        as $$ select string_to_array(name, '/') $$;
    `)
    for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql'))) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`
      insert into auth.users (id, email) values
        ('${an}', 'an@example.com'),
        ('${binh}', 'binh@example.com');
    `)
    await db.exec('set role service_role')

    await db.exec(`
      insert into public.submissions
        (id, student_id, course_id, module_id, exercise_id, code, results, outcome, message)
      values
        ('${submission}', '${an}', 'intro_python', 'getting_started', 'say_hello',
         'def hello(name):\n    return "Hello, " + name\n',
         '[{"name":"greeting for An","passed":true,"expected":"Hello, An","actual":"Hello, An"}]'::jsonb,
         'passed', null);
    `)
    const rows = await db.query<{ student_id: string, outcome: string, code: string, findings: string[] }>(
      'select student_id, outcome, code, findings from public.submissions',
    )
    expect(rows.rows).toEqual([{
      student_id: an,
      outcome: 'passed',
      code: 'def hello(name):\n    return "Hello, " + name\n',
      findings: [],
    }])

    await db.exec(`
      insert into public.submissions
        (id, student_id, course_id, module_id, exercise_id, code, results, outcome, message, findings)
      values
        ('e55e55e5-5555-4555-8555-555555555555', '${an}', 'intro_python', 'getting_started', 'say_hello',
         'def hello(name):\n    return Hello, name\n', '[]'::jsonb, 'failed', null, '["missing_quotes"]'::jsonb);
    `)
    await expect(db.exec(`
      insert into public.submissions
        (id, student_id, course_id, module_id, exercise_id, code, results, outcome, message, findings)
      values
        ('f66f66f6-6666-4666-8666-666666666666', '${an}', 'intro_python', 'getting_started', 'say_hello',
         'def hello(name):\n    return Hello, name\n', '[]'::jsonb, 'failed', null, '{"id":"missing_quotes"}'::jsonb);
    `)).rejects.toMatchObject({ code: '23514' })

    await expect(db.exec(`
      update public.submissions set outcome = 'failed' where id = '${submission}';
    `)).rejects.toMatchObject({ code: '42501' })
    await expect(db.exec(`
      insert into public.submissions
        (id, student_id, course_id, module_id, exercise_id, code, results, outcome, message)
      values
        ('d44d44d4-4444-4444-8444-444444444444', '${binh}', 'intro_python', 'getting_started', 'say_hello',
         'import os', '[]'::jsonb, 'refused', null);
    `)).rejects.toMatchObject({ code: '23514' })

    await db.exec('reset role; set role authenticated')
    await expect(db.query('select code from public.submissions')).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role; set role anon')
    await expect(db.query('select code from public.submissions')).rejects.toMatchObject({ code: '42501' })

    await db.exec('reset role; set role service_role')
    await db.exec(`delete from public.students where id = '${an}'`)
    expect((await db.query('select id from public.submissions')).rows).toEqual([])
  }
  finally {
    await db.close()
  }
})
