import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const lecturerMigration = '20261114085830_lecturer_enrollments_and_course_history.sql'
const thresholdMigration = '20261114091244_mastery_threshold_and_module_unlocks.sql'

it('backfills students, enrolls new students, seeds history and keeps both ledgers private', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create role supabase_auth_admin;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    `)
    const files = (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()
    for (const name of files.filter(name => name < lecturerMigration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`
      insert into auth.users (id, email) values
        ('a11a11a1-1111-4111-8111-111111111111', 'an@example.com'),
        ('b22b22b2-2222-4222-8222-222222222222', 'binh@example.com'),
        ('c33c33c3-3333-4333-8333-333333333333', 'owner@example.com');
    `)
    await db.exec(await readFile(new URL(lecturerMigration, migrations), 'utf8'))
    expect((await db.query("select owner_email from public.courses where id = 'intro_python'")).rows)
      .toEqual([{ owner_email: 'lecturer@example.com' }])
    expect((await db.query('select student_id from public.enrollments order by student_id')).rows).toEqual([
      { student_id: 'a11a11a1-1111-4111-8111-111111111111' },
      { student_id: 'b22b22b2-2222-4222-8222-222222222222' },
    ])

    await db.exec(`
      insert into auth.users (id, email) values
        ('d44d44d4-4444-4444-8444-444444444444', 'lecturer@example.com'),
        ('e55e55e5-5555-4555-8555-555555555555', 'new@example.com');
    `)

    await db.exec('set role authenticated')
    await expect(db.query('select * from public.enrollments')).rejects.toMatchObject({ code: '42501' })
    await expect(db.query('select * from public.course_history')).rejects.toMatchObject({ code: '42501' })

    await db.exec('reset role; set role service_role')
    expect((await db.query('select course_id, student_id from public.enrollments order by student_id')).rows).toEqual([
      { course_id: 'intro_python', student_id: 'a11a11a1-1111-4111-8111-111111111111' },
      { course_id: 'intro_python', student_id: 'b22b22b2-2222-4222-8222-222222222222' },
      { course_id: 'intro_python', student_id: 'e55e55e5-5555-4555-8555-555555555555' },
    ])
    expect((await db.query('select course_id, action, actor_email from public.course_history')).rows).toEqual([
      { course_id: 'intro_python', action: 'seeded', actor_email: 'lecturer@example.com' },
    ])

    const setThreshold = (email: string, value: number) => db.query(
      "select public.set_course_mastery_threshold('intro_python', $1, $2) as saved", [email, value],
    )
    await db.exec('reset role')
    await db.exec(await readFile(new URL(thresholdMigration, migrations), 'utf8'))
    await db.exec('set role authenticated')
    await expect(setThreshold('lecturer@example.com', 0.99)).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role; set role service_role')
    expect((await setThreshold('other@example.com', 0.99)).rows).toEqual([{ saved: false }])
    expect((await setThreshold('lecturer@example.com', 0.99)).rows).toEqual([{ saved: true }])
    expect((await setThreshold('lecturer@example.com', 0.99)).rows).toEqual([{ saved: true }])
    expect((await db.query("select previous_threshold, mastery_threshold from public.course_history where action = 'mastery_threshold_changed'")).rows)
      .toEqual([{ previous_threshold: 0.9, mastery_threshold: 0.99 }])
  }
  finally {
    await db.close()
  }
})
