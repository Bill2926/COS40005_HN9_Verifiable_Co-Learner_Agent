import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261119200000_create_learning_plans.sql'

it('creates the append-only learning plans table', async () => {
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
    await db.exec(await readFile(new URL(migration, migrations), 'utf8'))
    await db.exec(`
      insert into auth.users (id) values ('00000000-0000-4000-8000-000000000002');
    `)
    const student = (await db.query<{ id: string }>('select id from public.students limit 1')).rows[0]!.id

    await db.exec(`
      insert into public.learning_plans (student_id, course_id, module_id, revision, steps)
      values
        ('${student}', 'intro_python', 'getting_started', 1, '[{"kind":"materials","ref":""}]'),
        ('${student}', 'intro_python', 'getting_started', 2, '[{"kind":"materials","ref":""}]');
    `)

    const rows = await db.query('select revision, current_step, agreed_at from public.learning_plans order by revision')
    expect(rows.rows).toEqual([
      { revision: 1, current_step: 0, agreed_at: null },
      { revision: 2, current_step: 0, agreed_at: null },
    ])

    await expect(db.exec(`
      insert into public.learning_plans (student_id, course_id, module_id, revision, steps)
      values ('${student}', 'intro_python', 'getting_started', 2, '[]');
    `)).rejects.toThrow()
    await expect(db.exec(`
      insert into public.learning_plans (student_id, course_id, module_id, revision, steps)
      values ('${student}', 'intro_python', 'getting_started', 3, '{}');
    `)).rejects.toThrow()

    const privileges = await db.query<{ proacl: string }>(`
      select unnest(relacl)::text as proacl from pg_class where relname = 'learning_plans'
    `)
    const granted = privileges.rows.map(row => row.proacl.split('/')[0])
    expect(granted).toContain('service_role=ar')
    expect(granted.some(grant => grant.startsWith('anon='))).toBe(false)
    expect(granted.some(grant => grant.startsWith('authenticated='))).toBe(false)
  }
  finally {
    await db.close()
  }
})
