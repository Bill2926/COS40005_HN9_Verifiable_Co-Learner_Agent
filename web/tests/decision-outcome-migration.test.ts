import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261118170000_decision_outcome.sql'

it('records a step cap as its own outcome, with no VerifyShield ruling', async () => {
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
      insert into public.decisions
        (recorded_at, student_id, course_id, turn_id, agent, proposed_move, verdict, ruled_move,
         rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on, rule_checks)
      select now() + interval '1 second', id, 'intro_python', gen_random_uuid(), 'teacher', 'none', 'block', null,
             'step_cap', 'STEP_CAP_REACHED', '[]', '[]', true, '[]'
      from public.students;
    `)

    const sql = await readFile(new URL(migration, migrations), 'utf8')
    await db.exec(sql)
    await db.exec(sql)

    // A ruling keeps its verdict; a step cap logged before as a fake block becomes its own outcome.
    expect((await db.query('select outcome, verdict, rule_id, reason_code, rule_checks from public.decisions order by recorded_at')).rows).toEqual([
      { outcome: 'ruled', verdict: 'allow', rule_id: 'role_table', reason_code: 'ROLE_PERMITTED', rule_checks: null },
      { outcome: 'step_cap', verdict: null, rule_id: null, reason_code: null, rule_checks: null },
    ])
    const insert = (outcome: string, verdict: string | null) => db.exec(`
      insert into public.decisions
        (recorded_at, student_id, course_id, turn_id, agent, proposed_move, outcome, verdict,
         rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on)
      select now(), id, 'intro_python', gen_random_uuid(), 'teacher', 'none', '${outcome}', ${verdict ? `'${verdict}'` : 'null'},
             ${verdict ? "'role_table'" : 'null'}, ${verdict ? "'ROLE_PERMITTED'" : 'null'}, '[]', '[]', true
      from public.students;
    `)
    await expect(insert('step_cap', 'block')).rejects.toThrow()
    await expect(insert('ruled', null)).rejects.toThrow()
    await expect(insert('timed_out', null)).rejects.toThrow()
  }
  finally {
    await db.close()
  }
})
