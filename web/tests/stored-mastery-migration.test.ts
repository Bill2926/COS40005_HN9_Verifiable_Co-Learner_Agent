import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261118110000_store_module_masteries.sql'

const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'

it('stores one mastery number per student, course and module, for the server alone', async () => {
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
    for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql') && name < migration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`
      insert into auth.users (id, email) values
        ('${an}', 'an@example.com'),
        ('${binh}', 'binh@example.com');
    `)
    await db.exec(await readFile(new URL(migration, migrations), 'utf8'))
    await db.exec('set role service_role')

    const rows = async () => (await db.query<{ student_id: string, module_id: string, mastery: number, passed_exercise: boolean, ever_mastered: boolean }>(
      'select student_id, module_id, mastery, passed_exercise, ever_mastered from public.module_masteries order by student_id, module_id',
    )).rows
    await db.exec(`
      insert into public.module_masteries (student_id, course_id, module_id, mastery) values
        ('${an}', 'intro_python', 'getting_started', 0.42),
        ('${binh}', 'intro_python', 'getting_started', 0.1),
        ('${binh}', 'intro_python', 'variables', 0.1);
    `)
    expect(await rows()).toEqual([
      { student_id: an, module_id: 'getting_started', mastery: 0.42, passed_exercise: false, ever_mastered: false },
      { student_id: binh, module_id: 'getting_started', mastery: 0.1, passed_exercise: false, ever_mastered: false },
      { student_id: binh, module_id: 'variables', mastery: 0.1, passed_exercise: false, ever_mastered: false },
    ])

    // One row per student, course and module: the server replaces a picture, it never adds to it.
    await expect(db.exec(`
      insert into public.module_masteries (student_id, course_id, module_id, mastery) values
        ('${an}', 'intro_python', 'getting_started', 0.9);
    `)).rejects.toMatchObject({ code: '23505' })
    await expect(db.exec(`
      insert into public.module_masteries (student_id, course_id, module_id, mastery, passed_exercise, ever_mastered) values
        ('${an}', 'intro_python', 'strings', 1.5, true, true);
    `)).rejects.toMatchObject({ code: '23514' })

    await db.exec(`
      update public.module_masteries set mastery = 0.95, passed_exercise = true, ever_mastered = true
      where student_id = '${an}' and course_id = 'intro_python' and module_id = 'getting_started';
      delete from public.module_masteries where student_id = '${binh}' and course_id = 'intro_python' and module_id = 'variables';
    `)
    expect(await rows()).toEqual([
      { student_id: an, module_id: 'getting_started', mastery: 0.95, passed_exercise: true, ever_mastered: true },
      { student_id: binh, module_id: 'getting_started', mastery: 0.1, passed_exercise: false, ever_mastered: false },
    ])

    // The stored number is the server's own: no signed-in role reads or writes it, however
    // permissive a policy a later migration adds to the tables around it.
    await db.exec('reset role; set role authenticated')
    await expect(rows()).rejects.toMatchObject({ code: '42501' })
    await expect(db.exec(`
      insert into public.module_masteries (student_id, course_id, module_id, mastery) values
        ('${an}', 'intro_python', 'loops', 0.9);
    `)).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role; set role anon')
    await expect(rows()).rejects.toMatchObject({ code: '42501' })

    await db.exec('reset role; set role service_role')
    await db.exec(`delete from public.students where id = '${an}'`)
    expect(await rows()).toEqual([
      { student_id: binh, module_id: 'getting_started', mastery: 0.1, passed_exercise: false, ever_mastered: false },
    ])
  }
  finally {
    await db.close()
  }
})
