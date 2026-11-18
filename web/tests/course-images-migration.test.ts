import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)

it('lets only the course owner write course images, while students read them', async () => {
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
      alter table storage.objects enable row level security;
      grant usage on schema storage, auth to authenticated;
      grant select, insert, update, delete on storage.objects to authenticated;
      grant usage on sequence storage.objects_id_seq to authenticated;
    `)
    const files = (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()
    for (const name of files) await db.exec(await readFile(new URL(name, migrations), 'utf8'))

    expect((await db.query('select public from storage.buckets where id = $1', ['course-images'])).rows)
      .toEqual([{ public: true }])

    await db.exec(`insert into storage.objects (bucket_id, name) values ('course-images', 'intro_python/a.png')`)
    await db.exec('set role authenticated')
    const as = (email: string) => db.exec(`select set_config('test.jwt', '{"email":"${email}"}', false)`)
    const insert = (course: string) => db.query(
      `insert into storage.objects (bucket_id, name) values ('course-images', $1)`, [`${course}/b.png`])

    // A student reads; the owner (any email case) writes into the course's folder only.
    await as('an@student.swin.edu.au')
    expect((await db.query(`select name from storage.objects where bucket_id = 'course-images'`)).rows)
      .toEqual([{ name: 'intro_python/a.png' }])
    await expect(insert('intro_python')).rejects.toThrow()
    await as('Lecturer@example.com')
    await insert('intro_python')
    await expect(insert('other_course')).rejects.toThrow()
    await as('other@example.com')
    await expect(insert('intro_python')).rejects.toThrow()
  }
  finally {
    await db.close()
  }
})
