import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { normaliseCourseSpec } from '../server/course/materials'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261118180000_retire_diagram_blocks.sql'

async function migratedDatabase(before: (db: PGlite) => Promise<void> = async () => {}): Promise<PGlite> {
  const db = new PGlite()
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
  const files = (await readdir(migrations)).sort().filter(name => name.endsWith('.sql'))
  for (const name of files.filter(name => name < migration)) await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  await before(db)
  for (const name of files.filter(name => name >= migration)) await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  return db
}

type Block = { type: string, [field: string]: unknown }
type Spec = { modules: { content?: { materials: Block[] } }[] }

async function stored(db: PGlite): Promise<{ spec: Spec, draft: Spec | null }> {
  const result = await db.query<{ spec: Spec, draft: Spec | null }>(`select spec, draft from public.courses where id = 'intro_python'`)
  return result.rows[0]!
}

it('turns the seeded diagram into the bundled image, so a fresh database loads its course', async () => {
  const db = await migratedDatabase()
  try {
    const { spec } = await stored(db)
    const blocks = spec.modules[0]!.content!.materials
    expect(blocks.some(block => block.type === 'diagram')).toBe(false)
    expect(blocks[3]).toEqual({
      type: 'image',
      url: '/course-images/first-program.png',
      alt: 'Diagram: A program leads to print().',
    })
    expect(() => normaliseCourseSpec(spec)).not.toThrow()
  }
  finally {
    await db.close()
  }
})

it('keeps the source of any other diagram, in the spec and the draft, as a code block', async () => {
  const diagram = { type: 'diagram', mermaid: 'flowchart LR\n  a[Start] --> b[Next]' }
  const db = await migratedDatabase(async (db) => {
    await db.query(`
      update public.courses
      set spec = jsonb_insert(spec, '{modules,0,content,materials,-1}', $1::jsonb, true),
          draft = jsonb_insert(spec, '{modules,0,content,materials,0}', $1::jsonb)
      where id = 'intro_python'`, [JSON.stringify(diagram)])
  })
  try {
    const { spec, draft } = await stored(db)
    const code = { type: 'code', code: diagram.mermaid }
    expect(spec.modules[0]!.content!.materials.at(-1)).toEqual(code)
    expect(draft!.modules[0]!.content!.materials[0]).toEqual(code)
    for (const doc of [spec, draft!]) {
      expect(JSON.stringify(doc)).not.toContain('"diagram"')
      expect(() => normaliseCourseSpec(doc)).not.toThrow()
    }
  }
  finally {
    await db.close()
  }
})

it('leaves a course with no diagrams as it was', async () => {
  let before: { spec: Spec, draft: Spec | null } | undefined
  const db = await migratedDatabase(async (db) => {
    await db.exec(`
      update public.courses
      set spec = jsonb_set(spec, '{modules,0,content,materials}',
        (spec #> '{modules,0,content,materials}') - 3)
      where id = 'intro_python'`)
    before = await stored(db)
  })
  try {
    expect(await stored(db)).toEqual(before)
  }
  finally {
    await db.close()
  }
})
