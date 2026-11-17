import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261117045708_addressed_agent_and_deskmate_settings.sql'

it('adds the addressed agent to messages and decisions, and a deskmate switch per student, over existing rows', async () => {
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
        select id, 'student', 'Before', 'sum_of_a_list' from public.conversations;
      insert into public.decisions
        (recorded_at, student_id, course_id, turn_id, agent, proposed_move, verdict, ruled_move,
         rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on)
      select now(), id, 'intro_python', gen_random_uuid(), 'teacher', 'answer_question', 'allow', 'answer_question',
             'role_table', 'ROLE_PERMITTED', '[]', '[]', true
      from public.students;
    `)

    const sql = await readFile(new URL(migration, migrations), 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    await db.exec(`
      insert into public.messages (conversation_id, author, text, exercise_id, addressed_agent)
        select id, 'student', 'After', 'sum_of_a_list', 'deskmate' from public.conversations;
      insert into public.deskmate_settings (student_id, enabled)
        select id, false from public.students;
    `)

    expect((await db.query('select text, addressed_agent from public.messages order by sequence')).rows).toEqual([
      { text: 'Before', addressed_agent: null },
      { text: 'After', addressed_agent: 'deskmate' },
    ])
    expect((await db.query('select addressed_agent from public.decisions')).rows).toEqual([{ addressed_agent: null }])
    expect((await db.query('select enabled from public.deskmate_settings')).rows).toEqual([{ enabled: false }])
    await expect(db.exec(`update public.messages set addressed_agent = 'principal'`)).rejects.toThrow()
    await expect(db.exec(`update public.decisions set addressed_agent = 'principal'`)).rejects.toThrow()
  }
  finally {
    await db.close()
  }
})
