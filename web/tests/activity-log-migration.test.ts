import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const activityMigration = '20261117081101_activity_profile_mindmap_and_quotes.sql'
const an = 'a11a11a1-1111-4111-8111-111111111111'

async function withActivityMigration(check: (db: PGlite) => Promise<void>): Promise<void> {
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
    for (const name of files.filter(name => name < activityMigration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`insert into auth.users (id, email) values ('${an}', 'an@example.com')`)
    await db.exec(await readFile(new URL(activityMigration, migrations), 'utf8'))
    await check(db)
  }
  finally {
    await db.close()
  }
}

it('keeps the activity log append-only and mindmap rows private to the server', async () => {
  await withActivityMigration(async (db) => {
    await db.exec('set role service_role')
    await db.exec(`insert into public.activity_log (student_id, event_type, payload) values ('${an}', 'signed_in', '{}')`)
    const stored = (await db.query<{ course_id: string | null, created_at: Date }>(
      `select course_id, created_at from public.activity_log where student_id = '${an}'`,
    )).rows
    expect(stored).toHaveLength(1)
    expect(stored[0]!.course_id).toBeNull()
    expect(stored[0]!.created_at).toBeInstanceOf(Date)
    for (const payload of ['{"code":"print(1)"}', '{"draft":"print(1)"}', '{"keystrokes":"p"}']) {
      await expect(db.exec(
        `insert into public.activity_log (student_id, event_type, payload) values ('${an}', 'code_run', '${payload}')`,
      )).rejects.toMatchObject({ code: '23514' })
    }
    await expect(db.exec(`update public.activity_log set payload = '{}' where student_id = '${an}'`)).rejects.toMatchObject({ code: '42501' })
    await expect(db.exec(`delete from public.activity_log where student_id = '${an}'`)).rejects.toMatchObject({ code: '42501' })

    await db.exec('reset role; set role authenticated')
    await expect(db.query('select * from public.activity_log')).rejects.toMatchObject({ code: '42501' })
    await expect(db.exec(
      `insert into public.mindmap_notes (id, student_id, course_id, text, colour, x, y) values ('${an}', '${an}', 'intro_python', 'Secret', 'ink', 0, 0)`,
    )).rejects.toMatchObject({ code: '42501' })

    await db.exec('reset role; set role service_role')
    await db.exec(
      `insert into public.mindmap_notes (id, student_id, course_id, text, colour, x, y) values ('${an}', '${an}', 'intro_python', 'Secret', 'ink', 0, 0)`,
    )
    await db.exec('reset role; set role authenticated')
    expect((await db.query('select text from public.mindmap_notes')).rows).toEqual([])
  })
})

it('lets neither anon nor authenticated read, update or delete an activity row', async () => {
  await withActivityMigration(async (db) => {
    await db.exec('set role service_role')
    await db.exec(`insert into public.activity_log (student_id, course_id, event_type, payload) values ('${an}', 'intro_python', 'module_opened', '{"moduleId":"getting_started"}')`)
    await db.exec('reset role')

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(db.query('select * from public.activity_log')).rejects.toMatchObject({ code: '42501' })
      await expect(db.exec(
        `update public.activity_log set event_type = 'code_run' where student_id = '${an}'`,
      )).rejects.toMatchObject({ code: '42501' })
      await expect(db.exec(
        `delete from public.activity_log where student_id = '${an}'`,
      )).rejects.toMatchObject({ code: '42501' })
      await db.exec('reset role')
    }

    await db.exec('set role service_role')
    const rows = (await db.query<{ event_type: string }>(
      `select event_type from public.activity_log where student_id = '${an}'`,
    )).rows
    expect(rows).toEqual([{ event_type: 'module_opened' }])
  })
})
