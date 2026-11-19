import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261120100000_create_study_suggestion_dismissals.sql'

it('keeps one dismissal per student, course and step, readable only by the server', async () => {
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
    await db.exec(`insert into auth.users (id) values ('00000000-0000-4000-8000-000000000003');`)
    const student = (await db.query<{ id: string }>('select id from public.students limit 1')).rows[0]!.id

    await db.exec(`
      insert into public.study_suggestion_dismissals (student_id, course_id, step, anchor)
      values ('${student}', 'intro_python', 'hopping|getting_started||', 12);
      insert into public.study_suggestion_dismissals (student_id, course_id, step, anchor)
      values ('${student}', 'intro_python', 'hopping|getting_started||', 20)
      on conflict (student_id, course_id, step) do update set anchor = excluded.anchor;
    `)
    const rows = await db.query('select step, anchor from public.study_suggestion_dismissals')
    expect(rows.rows).toEqual([{ step: 'hopping|getting_started||', anchor: 20 }])

    await expect(db.exec(`
      insert into public.study_suggestion_dismissals (student_id, course_id, step, anchor)
      values ('${student}', 'intro_python', 'hopping|getting_started||', 21);
    `)).rejects.toThrow()

    const privileges = await db.query<{ acl: string }>(`
      select unnest(relacl)::text as acl from pg_class where relname = 'study_suggestion_dismissals'
    `)
    const granted = privileges.rows.map(row => row.acl.split('/')[0])
    expect(granted).toContain('service_role=arw')
    expect(granted.some(grant => grant.startsWith('anon='))).toBe(false)
    expect(granted.some(grant => grant.startsWith('authenticated='))).toBe(false)
  }
  finally {
    await db.close()
  }
})
