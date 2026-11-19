import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)

const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'
const missing = 'f99f99f9-9999-4999-8999-999999999999'

it('keeps campus empty until chosen, records each change and keeps the student from writing it', async () => {
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

    await db.exec(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('${an}', 'an@example.com', '{"display_name": "An"}'),
        ('${binh}', '104123456@student.swin.edu.au', null);
    `)

    // A first sign-in with no name given takes the display name from the email.
    expect((await db.query('select id, display_name, campus from public.students order by student_number')).rows)
      .toEqual([
        { id: an, display_name: 'An', campus: null },
        { id: binh, display_name: '104123456', campus: null },
      ])

    const choose = (id: string, campus: string) => db.query(
      'select public.choose_student_campus($1, $2) as result', [id, campus],
    )
    expect((await choose(an, 'Mars')).rows).toEqual([{ result: 'invalid' }])
    expect((await choose(missing, 'Hanoi')).rows).toEqual([{ result: 'not-found' }])
    expect((await choose(an, 'Hanoi')).rows).toEqual([{ result: 'chosen' }])
    // Chosen once: a second choice is not a change the student can make.
    expect((await choose(an, 'Can Tho')).rows).toEqual([{ result: 'already-chosen' }])
    expect((await db.query('select campus from public.students where id = $1', [an])).rows)
      .toEqual([{ campus: 'Hanoi' }])

    const change = (email: string, id: string, campus: string) => db.query(
      'select public.set_student_campus($1, $2, $3) as result', [email, id, campus],
    )
    expect((await change('owner@example.com', an, 'Da Nang')).rows).toEqual([{ result: 'changed' }])
    expect((await change('owner@example.com', an, 'Da Nang')).rows).toEqual([{ result: 'unchanged' }])
    expect((await change('owner@example.com', an, 'Mars')).rows).toEqual([{ result: 'invalid' }])
    expect((await change('owner@example.com', missing, 'Hanoi')).rows).toEqual([{ result: 'not-found' }])
    // The owner can also give a campus to a student who has none.
    expect((await change('owner@example.com', binh, 'Ho Chi Minh City')).rows).toEqual([{ result: 'changed' }])

    const recorded = (await db.query<{ old_campus: string | null, changed_at: Date | string | null }>(
      'select student_id, old_campus, new_campus, actor_email, changed_at from public.campus_changes order by id',
    )).rows
    expect(recorded.map(row => ({ ...row, changed_at: row.changed_at !== null }))).toEqual([
      { student_id: an, old_campus: 'Hanoi', new_campus: 'Da Nang', actor_email: 'owner@example.com', changed_at: true },
      { student_id: binh, old_campus: null, new_campus: 'Ho Chi Minh City', actor_email: 'owner@example.com', changed_at: true },
    ])

    expect((await db.query('select campus from public.student_directory where id = $1', [an])).rows)
      .toEqual([{ campus: 'Da Nang' }])

    await db.exec('set role authenticated')
    await expect(db.query("update public.students set campus = 'Can Tho' where id = $1", [an])).rejects.toMatchObject({ code: '42501' })
    await expect(change('owner@example.com', an, 'Can Tho')).rejects.toMatchObject({ code: '42501' })
    await expect(choose(binh, 'Can Tho')).rejects.toMatchObject({ code: '42501' })
    await expect(db.query('select * from public.campus_changes')).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role; set role service_role')
    expect((await db.query('select campus from public.students where id = $1', [an])).rows)
      .toEqual([{ campus: 'Da Nang' }])
  }
  finally {
    await db.close()
  }
})
