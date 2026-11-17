import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261117045705_add_message_created_at.sql'

it('stamps new messages with a time and leaves existing messages without one', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create role supabase_auth_admin;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    `)
    for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql') && name < migration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`
      insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
      insert into public.conversations (student_id, course_id, module_id)
        select id, 'intro_python', 'loops' from public.students;
      insert into public.messages (conversation_id, author, text, exercise_id)
        select id, 'student', 'Before the change', 'sum_of_a_list' from public.conversations;
    `)

    await db.exec(await readFile(new URL(migration, migrations), 'utf8'))
    await db.exec(`
      insert into public.messages (conversation_id, author, text, exercise_id)
        select id, 'student', 'After the change', 'sum_of_a_list' from public.conversations;
    `)

    const rows = (await db.query<{ text: string, created_at: Date | null }>(
      'select text, created_at from public.messages order by sequence',
    )).rows
    expect(rows[0]).toEqual({ text: 'Before the change', created_at: null })
    expect(rows[1]!.text).toBe('After the change')
    expect(rows[1]!.created_at).toBeInstanceOf(Date)
  }
  finally {
    await db.close()
  }
})
