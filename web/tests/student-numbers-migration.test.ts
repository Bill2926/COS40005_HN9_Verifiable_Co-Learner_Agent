import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const studentNumberMigration = '20261117130000_student_numbers.sql'

const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'
const owner = 'c33c33c3-3333-4333-8333-333333333333'
const lecturer = 'd44d44d4-4444-4444-8444-444444444444'
const missing = 'f99f99f9-9999-4999-8999-999999999999'

it('numbers students in sign-up order, never reuses a number and keeps the directory private', async () => {
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
    for (const name of files.filter(name => name < studentNumberMigration)) {
      await db.exec(await readFile(new URL(name, migrations), 'utf8'))
    }
    await db.exec(`
      insert into auth.users (id, email, created_at) values
        ('${binh}', 'binh@example.com', '2026-11-01T08:00:00Z'),
        ('${lecturer}', 'lecturer@example.com', '2026-11-01T11:00:00Z'),
        ('${an}', 'an@example.com', '2026-11-01T09:00:00Z'),
        ('${owner}', 'owner@example.com', '2026-11-01T10:00:00Z');
    `)
    await db.exec(await readFile(new URL(studentNumberMigration, migrations), 'utf8'))

    const numbers = async () => (await db.query<{ id: string, student_number: string | null }>(
      'select id, student_number from public.students order by student_number nulls last, id',
    )).rows
    expect(await numbers()).toEqual([
      { id: binh, student_number: 'SWB0001' },
      { id: an, student_number: 'SWB0002' },
      { id: owner, student_number: null },
      { id: lecturer, student_number: null },
    ])

    const signUp = async (id: string, email: string) => db.exec(
      `insert into auth.users (id, email, created_at) values ('${id}', '${email}', now())`,
    )
    const newStudent = 'e55e55e5-5555-4555-8555-555555555555'
    const laterStudent = 'f66f66f6-6666-4666-8666-666666666666'
    await signUp(newStudent, 'new@example.com')
    expect((await db.query('select student_number from public.students where id = $1', [newStudent])).rows)
      .toEqual([{ student_number: 'SWB0003' }])

    await db.exec("select setval('private.student_number_seq', 9999)")
    await signUp(laterStudent, 'later@example.com')
    expect((await db.query('select student_number from public.students where id = $1', [laterStudent])).rows)
      .toEqual([{ student_number: 'SWB10000' }])

    const change = (email: string, studentId: string, number: string) => db.query(
      'select public.set_student_number($1, $2, $3) as result', [email, studentId, number],
    )
    expect((await change('owner@example.com', an, 'SWB9001')).rows).toEqual([{ result: 'changed' }])
    expect((await db.query('select old_number, new_number, actor_email from public.student_number_changes')).rows)
      .toEqual([{ old_number: 'SWB0002', new_number: 'SWB9001', actor_email: 'owner@example.com' }])
    expect((await change('owner@example.com', an, 'SWB9001')).rows).toEqual([{ result: 'unchanged' }])
    expect((await change('owner@example.com', an, 'SWB12')).rows).toEqual([{ result: 'invalid' }])
    expect((await change('owner@example.com', missing, 'SWB9002')).rows).toEqual([{ result: 'not-found' }])
    expect((await change('owner@example.com', binh, 'SWB0003')).rows).toEqual([{ result: 'duplicate' }])
    expect((await change('owner@example.com', binh, 'SWB0002')).rows).toEqual([{ result: 'used' }])

    expect((await change('owner@example.com', laterStudent, 'SWB9002')).rows).toEqual([{ result: 'changed' }])
    expect((await change('owner@example.com', binh, 'SWB10000')).rows).toEqual([{ result: 'used' }])
    expect((await db.query('select old_number, new_number from public.student_number_changes order by id')).rows)
      .toEqual([
        { old_number: 'SWB0002', new_number: 'SWB9001' },
        { old_number: 'SWB10000', new_number: 'SWB9002' },
      ])

    const nextStudent = 'e77e77e7-7777-4777-8777-777777777777'
    await signUp(nextStudent, 'next@example.com')
    expect((await db.query('select student_number from public.students where id = $1', [nextStudent])).rows)
      .toEqual([{ student_number: 'SWB10001' }])

    // A correction can be undone: the student's own earlier number is still
    // theirs to return to, but no other student may ever take it.
    expect((await change('owner@example.com', an, 'SWB0002')).rows).toEqual([{ result: 'changed' }])
    expect((await change('owner@example.com', binh, 'SWB0002')).rows).toEqual([{ result: 'duplicate' }])
    expect((await db.query('select old_number, new_number from public.student_number_changes order by id')).rows)
      .toEqual([
        { old_number: 'SWB0002', new_number: 'SWB9001' },
        { old_number: 'SWB10000', new_number: 'SWB9002' },
        { old_number: 'SWB9001', new_number: 'SWB0002' },
      ])

    const directory = async () => (await db.query(
      'select id, display_name, student_number, email from public.student_directory order by student_number',
    )).rows as { id: string, student_number: string, email: string }[]
    expect((await directory()).map(row => [row.student_number, row.email])).toEqual([
      ['SWB0001', 'binh@example.com'],
      ['SWB0002', 'an@example.com'],
      ['SWB0003', 'new@example.com'],
      ['SWB10001', 'next@example.com'],
      ['SWB9002', 'later@example.com'],
    ])

    await db.exec('set role authenticated')
    const refused = await db.query("update public.students set student_number = 'SWB7777' where id = $1", [binh])
    expect(refused.affectedRows).toBe(0)
    await expect(db.query('select * from public.student_directory')).rejects.toMatchObject({ code: '42501' })
    await expect(change('owner@example.com', binh, 'SWB7777')).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role; set role service_role')
    expect((await db.query('select student_number from public.students where id = $1', [binh])).rows)
      .toEqual([{ student_number: 'SWB0001' }])
  }
  finally {
    await db.close()
  }
})
