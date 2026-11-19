import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)

// Tables created with select, insert, update and delete for anon and authenticated.
// Later tables were created without those grants. These are the ones that still had them.
const olderTables = [
  'students',
  'conversations',
  'messages',
  'resume_points',
  'model_settings',
  'verify_shield_settings',
  'decisions',
  'evidence',
  'quiz_answers',
] as const

const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const

it('revokes anon and authenticated privileges on the older tables', async () => {
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
    for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql'))) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }

    for (const table of olderTables) {
      for (const role of ['anon', 'authenticated']) {
        for (const privilege of privileges) {
          const allowed = await db.query<{ allowed: boolean }>(
            'select has_table_privilege($1, $2, $3) as allowed',
            [role, `public.${table}`, privilege],
          )
          expect(allowed.rows[0]?.allowed).toBe(false)
        }
        await db.exec(`set role ${role}`)
        await expect(db.query(`select * from public.${table}`)).rejects.toMatchObject({ code: '42501' })
        await db.exec('reset role')
      }

      const server = await db.query<{ allowed: boolean }>(
        'select has_table_privilege($1, $2, $3) as allowed',
        ['service_role', `public.${table}`, 'SELECT'],
      )
      expect(server.rows[0]?.allowed).toBe(true)
    }
  }
  finally {
    await db.close()
  }
})
