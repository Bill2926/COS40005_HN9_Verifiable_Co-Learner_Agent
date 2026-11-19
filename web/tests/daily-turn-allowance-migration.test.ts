import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const migration = '20261119140100_daily_proposing_turns.sql'

const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'

it('reserves 60 proposing turns per student per day for the server alone', async () => {
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

    const reserve = async (student: string, day: string) => (await db.query<{ take_daily_proposing_turn: boolean }>(
      `select public.take_daily_proposing_turn('${student}', '${day}')`,
    )).rows[0]!.take_daily_proposing_turn
    const taken = async (student: string, day: string) => (await db.query<{ taken: number }>(
      `select taken from public.daily_turn_allowances where student_id = '${student}' and day = '${day}'`,
    )).rows

    for (let turn = 0; turn < 60; turn++) {
      expect(await reserve(an, '2026-11-19')).toBe(true)
    }
    expect(await reserve(an, '2026-11-19')).toBe(false)
    expect(await taken(an, '2026-11-19')).toEqual([{ taken: 60 }])

    expect(await reserve(an, '2026-11-20')).toBe(true)
    expect(await taken(an, '2026-11-20')).toEqual([{ taken: 1 }])
    expect(await reserve(binh, '2026-11-19')).toBe(true)
    expect(await taken(binh, '2026-11-19')).toEqual([{ taken: 1 }])

    await db.exec(`delete from public.students where id = '${an}'`)
    expect(await taken(an, '2026-11-19')).toEqual([])
    expect(await taken(binh, '2026-11-19')).toEqual([{ taken: 1 }])

    await db.exec('reset role; set role authenticated')
    await expect(taken(binh, '2026-11-19')).rejects.toMatchObject({ code: '42501' })
    await expect(reserve(binh, '2026-11-19')).rejects.toMatchObject({ code: '42501' })
    await db.exec('reset role; set role anon')
    await expect(taken(binh, '2026-11-19')).rejects.toMatchObject({ code: '42501' })
    await expect(reserve(binh, '2026-11-19')).rejects.toMatchObject({ code: '42501' })
  }
  finally {
    await db.close()
  }
})
