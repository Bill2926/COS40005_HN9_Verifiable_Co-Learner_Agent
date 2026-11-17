import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261117000000_decision_rule_checks.sql'

it('adds rule checks to decisions and leaves existing rows without them', async () => {
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
      insert into public.decisions
        (recorded_at, student_id, course_id, turn_id, agent, proposed_move, verdict, ruled_move,
         rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on, rule_checks)
      select now() + interval '1 second', id, 'intro_python', gen_random_uuid(), 'deskmate', 'peer_question', 'allow', 'peer_question',
             'role_table', 'ROLE_PERMITTED', '[]', '[]', true,
             '[{"ruleId":"role_table","passed":true,"reasonCode":"ROLE_PERMITTED"}]'
      from public.students;
    `)

    expect((await db.query('select agent, rule_checks from public.decisions order by recorded_at')).rows).toEqual([
      { agent: 'teacher', rule_checks: null },
      { agent: 'deskmate', rule_checks: [{ ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' }] },
    ])
  }
  finally {
    await db.close()
  }
})
