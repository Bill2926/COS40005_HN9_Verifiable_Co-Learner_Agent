import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261113160742_rename_advance_move_and_shield_off_reason.sql'

it('migrates stored navigation and shield-off values while preserving other decisions', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create role supabase_auth_admin;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    `)
    for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql') && name < migration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`
      insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
      insert into public.conversations (student_id, module_id)
        select id, 'loops' from public.students;
      insert into public.messages (conversation_id, author, approved_move, text, exercise_id)
        select id, 'teacher', 'advance_to_item:variables', 'Try Variables next.', 'sum_of_a_list'
        from public.conversations;
      insert into public.messages (conversation_id, author, text, exercise_id)
        select id, 'student', 'Can I continue?', 'sum_of_a_list' from public.conversations;
      insert into public.decisions
        (recorded_at, student_id, turn_id, agent, proposed_move, verdict, ruled_move,
         rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on)
      select now(), id, gen_random_uuid(), 'teacher', move.proposed, move.verdict, move.ruled,
             'verify_shield', move.reason, '[]', '[]', move.shield_on
      from public.students
      cross join (values
        ('advance_to_item:variables', 'allow', 'advance_to_item:variables', 'VERIFYSHELD_OFF', false),
        ('advance_to_item:loops', 'block', null, 'ROLE_FORBIDDEN', true),
        ('answer_question', 'allow', 'answer_question', 'VERIFYSHELD_OFF', false),
        ('stay_and_practise', 'allow', 'stay_and_practise', 'ROLE_PERMITTED', true)
      ) as move(proposed, verdict, ruled, reason, shield_on);
    `)

    const sql = await readFile(new URL(migration, migrations), 'utf8')
    await db.exec(sql)
    await db.exec(sql)

    await db.exec('set role authenticated')
    expect((await db.query('select * from public.decisions')).rows).toEqual([])
    expect((await db.query('select * from public.messages')).rows).toEqual([])
    await db.exec('reset role; set role service_role')

    expect((await db.query('select approved_move, text from public.messages order by sequence')).rows).toEqual([
      { approved_move: 'advance_to_module:variables', text: 'Try Variables next.' },
      { approved_move: null, text: 'Can I continue?' },
    ])
    expect((await db.query(
      'select proposed_move, ruled_move, reason_code from public.decisions order by proposed_move',
    )).rows).toEqual([
      { proposed_move: 'advance_to_module:loops', ruled_move: null, reason_code: 'ROLE_FORBIDDEN' },
      { proposed_move: 'advance_to_module:variables', ruled_move: 'advance_to_module:variables', reason_code: 'VERIFYSHIELD_OFF' },
      { proposed_move: 'answer_question', ruled_move: 'answer_question', reason_code: 'VERIFYSHIELD_OFF' },
      { proposed_move: 'stay_and_practise', ruled_move: 'stay_and_practise', reason_code: 'ROLE_PERMITTED' },
    ])
  }
  finally {
    await db.close()
  }
})
