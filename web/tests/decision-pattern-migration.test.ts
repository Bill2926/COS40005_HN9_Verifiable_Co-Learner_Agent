import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261119180000_decision_learning_pattern.sql'

it('adds the turn module and the learning pattern to decisions, null on old rows', async () => {
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
    `)

    const sql = await readFile(new URL(migration, migrations), 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    await db.exec(`
      insert into public.decisions
        (recorded_at, student_id, course_id, turn_id, agent, proposed_move, verdict, ruled_move,
         rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on, module_id, learning_pattern)
      select now() + interval '1 second', id, 'intro_python', gen_random_uuid(), 'teacher', 'answer_question', 'allow', 'answer_question',
             'role_table', 'ROLE_PERMITTED', '[]', '[]', true, 'getting_started',
             '{"weakSpots":[{"misconceptionId":"missing_quotes","count":2,"lastSeen":"2026-11-19T10:00:00Z"}],"recurringErrors":[],"exerciseAttempts":[],"hintRungs":[],"materialsSeconds":[]}'
      from public.students;
    `)

    expect((await db.query('select module_id, learning_pattern from public.decisions order by recorded_at')).rows).toEqual([
      { module_id: null, learning_pattern: null },
      {
        module_id: 'getting_started',
        learning_pattern: {
          weakSpots: [{ misconceptionId: 'missing_quotes', count: 2, lastSeen: '2026-11-19T10:00:00Z' }],
          recurringErrors: [],
          exerciseAttempts: [],
          hintRungs: [],
          materialsSeconds: [],
        },
      },
    ])
  }
  finally {
    await db.close()
  }
})
