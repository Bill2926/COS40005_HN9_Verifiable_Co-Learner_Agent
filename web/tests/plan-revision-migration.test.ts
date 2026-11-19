import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261119210000_plan_revision_trigger_and_activity.sql'

it('keeps what brought a revision about and accepts the plan activity events', async () => {
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
    for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql') && name <= migration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`insert into auth.users (id) values ('00000000-0000-4000-8000-000000000002');`)
    const student = (await db.query<{ id: string }>('select id from public.students limit 1')).rows[0]!.id
    const turn = '11111111-1111-4111-8111-111111111111'

    await db.exec(`
      insert into public.learning_plans (student_id, course_id, module_id, revision, steps, trigger, decision_turn_id)
      values ('${student}', 'intro_python', 'loops', 1, '[]', 'failed_submissions', '${turn}');
    `)
    expect((await db.query('select trigger, decision_turn_id from public.learning_plans')).rows)
      .toEqual([{ trigger: 'failed_submissions', decision_turn_id: turn }])

    for (const type of ['approach_written', 'plan_agreed', 'idle_check_in']) {
      await db.exec(`insert into public.activity_log (student_id, course_id, event_type, payload) values ('${student}', 'intro_python', '${type}', '{}')`)
    }
    await expect(db.exec(
      `insert into public.activity_log (student_id, course_id, event_type, payload) values ('${student}', 'intro_python', 'pasted_a_lot', '{}')`,
    )).rejects.toThrow()
  }
  finally {
    await db.close()
  }
})
