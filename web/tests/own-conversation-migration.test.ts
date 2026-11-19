import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'

let db: PGlite

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create role supabase_auth_admin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz not null default now());
    create function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
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
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${an}', 'an@example.com', '{"display_name":"An"}'),
      ('${binh}', 'binh@example.com', '{"display_name":"Binh"}');
    insert into public.conversations (id, student_id, course_id, module_id) values
      ('c0000000-0000-4000-8000-00000000000a', '${an}', 'intro_python', 'loops'),
      ('c0000000-0000-4000-8000-00000000000b', '${binh}', 'intro_python', 'loops');
    insert into public.messages (conversation_id, author, text, exercise_id) values
      ('c0000000-0000-4000-8000-00000000000a', 'student', 'An asks', 'sum_of_a_list'),
      ('c0000000-0000-4000-8000-00000000000b', 'student', 'Binh asks', 'sum_of_a_list');
  `)
}, 60_000)

afterEach(async () => {
  await db.close()
})

async function asStudent<T>(uid: string | null, query: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('test.uid', '${uid ?? ''}', false)`)
  try {
    return (await db.query<T>(query)).rows
  }
  finally {
    await db.exec('reset role')
  }
}

it('lets a signed-in student read only their own conversations and messages', async () => {
  const conversations = await asStudent<{ student_id: string }>(an, 'select student_id from public.conversations')
  expect(conversations.map(row => row.student_id)).toEqual([an])

  const messages = await asStudent<{ text: string }>(an, 'select text from public.messages')
  expect(messages.map(row => row.text)).toEqual(['An asks'])

  const named = await asStudent(an, `select * from public.conversations where student_id = '${binh}'`)
  expect(named).toEqual([])
  const throughId = await asStudent(an, `select * from public.messages where conversation_id = 'c0000000-0000-4000-8000-00000000000b'`)
  expect(throughId).toEqual([])
})

it('returns no rows to a session with no student', async () => {
  expect(await asStudent(null, 'select * from public.conversations')).toEqual([])
  expect(await asStudent(null, 'select * from public.messages')).toEqual([])
}, 30_000)

it('still refuses student writes and anonymous reads', async () => {
  await db.exec(`set role authenticated; select set_config('test.uid', '${an}', false)`)
  await expect(db.query(`insert into public.messages (conversation_id, author, text, exercise_id)
    values ('c0000000-0000-4000-8000-00000000000a', 'student', 'Forged', 'x')`)).rejects.toMatchObject({ code: '42501' })
  await expect(db.query(`delete from public.conversations`)).rejects.toMatchObject({ code: '42501' })
  await db.exec('reset role; set role anon')
  await expect(db.query('select * from public.messages')).rejects.toMatchObject({ code: '42501' })
  await db.exec('reset role')
}, 30_000)
