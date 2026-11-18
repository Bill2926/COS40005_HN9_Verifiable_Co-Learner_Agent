import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)

it('gives a note back one optional image path', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create role supabase_auth_admin;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz not null default now());
    `)
    const files = (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()
    for (const name of files) await db.exec(await readFile(new URL(name, migrations), 'utf8'))

    expect((await db.query(`
      select data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'mindmap_notes' and column_name = 'image_path'
    `)).rows).toEqual([{ data_type: 'text', is_nullable: 'YES' }])
  }
  finally {
    await db.close()
  }
})
