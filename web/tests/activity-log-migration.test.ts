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

it('accepts a finished run, a paste and going quiet, and still refuses code', async () => {
  await withActivityMigration(async (db) => {
    const migration = '20261119133000_activity_run_paste_and_idle.sql'
    await db.exec(await readFile(new URL(migration, migrations), 'utf8'))
    await db.exec('set role service_role')
    const reports = [
      ['run_finished', '{"exerciseId":"say_hello","outcome":"error","errorType":"NameError"}'],
      ['pasted', '{"exerciseId":"say_hello","characters":42}'],
      ['went_idle', '{"moduleId":"getting_started","exerciseId":"say_hello"}'],
      ['returned', '{"moduleId":"getting_started","exerciseId":"say_hello"}'],
    ] as const
    for (const [eventType, payload] of reports) {
      await db.exec(
        `insert into public.activity_log (student_id, course_id, event_type, payload) values ('${an}', 'intro_python', '${eventType}', '${payload}')`,
      )
    }
    const rows = (await db.query<{ event_type: string }>(
      `select event_type from public.activity_log where student_id = '${an}' order by id`,
    )).rows
    expect(rows.map(row => row.event_type)).toEqual(['run_finished', 'pasted', 'went_idle', 'returned'])
    await expect(db.exec(
      `insert into public.activity_log (student_id, event_type, payload) values ('${an}', 'pasted', '{"code":"print(1)"}')`,
    )).rejects.toMatchObject({ code: '23514' })
  })
})

it('imports an arrangement once and keeps an account reset across devices', async () => {
  await withActivityMigration(async (db) => {
    const migration = '20261117161403_mindmap_arrangement_reset.sql'
    await db.exec(await readFile(new URL(migration, migrations), 'utf8'))
    const update = (positions: string | null) => db.query<{ changed: boolean }>(
      'select public.update_mindmap_arrangement($1, $2, $3) as changed',
      [an, 'intro_python', positions],
    )

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(update(null)).rejects.toMatchObject({ code: '42501' })
      await db.exec('reset role')
    }

    await db.exec('set role service_role')
    const legacy = '[{"moduleId":"getting_started","x":0.4,"y":0.6}]'
    expect((await update(legacy)).rows).toEqual([{ changed: true }])
    expect((await update('[{"moduleId":"variables","x":1,"y":2}]')).rows).toEqual([{ changed: false }])
    expect((await db.query('select module_id, x, y from public.mindmap_positions')).rows)
      .toEqual([{ module_id: 'getting_started', x: 0.4, y: 0.6 }])
    expect((await update(null)).rows).toEqual([{ changed: true }])
    expect((await update(legacy)).rows).toEqual([{ changed: false }])
    expect((await db.query('select module_id from public.mindmap_positions')).rows).toEqual([])
  })
})

it('writes a note and its first link together, or neither', async () => {
  await withActivityMigration(async (db) => {
    await db.exec(await readFile(new URL('20261118120000_note_with_first_link.sql', migrations), 'utf8'))
    const first = 'c33c33c3-3333-4333-8333-333333333333'
    const second = 'd44d44d4-4444-4444-8444-444444444444'
    const insert = (noteId: string, kind: string, target: string, linkId = crypto.randomUUID()) => db.query<{ written: boolean }>(
      'select public.insert_mindmap_note($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as written',
      [an, 'intro_python', noteId, 'A note', 'ink', 1, 2, linkId, kind, target],
    )

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(insert(first, 'module', 'loops')).rejects.toMatchObject({ code: '42501' })
      await db.exec('reset role')
    }

    await db.exec('set role service_role')
    expect((await insert(first, 'module', 'loops')).rows).toEqual([{ written: true }])
    expect((await insert(second, 'note', first)).rows).toEqual([{ written: true }])
    expect((await insert(crypto.randomUUID(), 'note', crypto.randomUUID())).rows).toEqual([{ written: false }])
    // A link that breaks a rule leaves no note behind.
    await expect(insert(crypto.randomUUID(), 'wall', 'loops')).rejects.toMatchObject({ code: '23514' })
    expect((await db.query('select count(*)::int as n from public.mindmap_notes')).rows).toEqual([{ n: 2 }])
    expect((await db.query('select count(*)::int as n from public.mindmap_links')).rows).toEqual([{ n: 2 }])
  })
})
