import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const an = 'a11a11a1-1111-4111-8111-111111111111'
const binh = 'b22b22b2-2222-4222-8222-222222222222'

async function database() {
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
  for (const name of (await readdir(migrations)).sort().filter(name => name.endsWith('.sql'))) {
    await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  }
  await db.exec(`
    insert into auth.users (id, email) values ('${an}', 'an@example.com'), ('${binh}', 'binh@example.com');
  `)
  return db
}

async function decide(db: PGlite, student: string) {
  await db.exec(`
    insert into public.decisions (recorded_at, student_id, course_id, turn_id, agent, proposed_move, outcome, verdict, ruled_move, rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on)
    values (now(), '${student}', 'intro_python', gen_random_uuid(), 'teacher', 'answer_question', 'ruled', 'allow', 'answer_question', 'role_table', 'ROLE_PERMITTED', '[]', '[]', true)
  `)
}

async function count(db: PGlite, table: string, student: string) {
  return Number((await db.query<{ n: string }>(`select count(*) as n from public.${table} where student_id = '${student}'`)).rows[0]!.n)
}

it('deletes one student and every record of theirs, and leaves the others', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    // Interleaved, so each removed decision leaves a gap in the chain.
    for (const student of [an, binh, an, an, binh, an, binh]) await decide(db, student)
    for (const student of [an, binh]) {
      await db.exec(`
        insert into public.activity_log (student_id, course_id, event_type) values ('${student}', 'intro_python', 'signed_in');
        insert into public.staff_access_log (actor_email, actor_role, student_id, course_id, opened)
          values ('lecturer@example.com', 'lecturer', '${student}', 'intro_python', 'student_review');
        insert into public.learning_plans (student_id, course_id, module_id, revision, steps)
          values ('${student}', 'intro_python', 'getting_started', 1, '[]'), ('${student}', 'intro_python', 'getting_started', 2, '[]');
        insert into public.conversations (student_id, course_id, module_id) values ('${student}', 'intro_python', 'getting_started');
      `)
    }
    expect((await db.query('select public.verify_decision_chain() as broken')).rows[0]).toEqual({ broken: null })

    const result = await db.query('select public.delete_student_records($1) as outcome', [an])
    expect(result.rows[0]).toEqual({ outcome: 'deleted' })

    for (const table of ['students', 'decisions', 'activity_log', 'staff_access_log', 'learning_plans', 'conversations']) {
      const column = table === 'students' ? 'id' : 'student_id'
      const rows = (await db.query<{ n: string }>(`select count(*) as n from public.${table} where ${column} = '${an}'`)).rows[0]!.n
      expect(Number(rows), table).toBe(0)
    }

    expect(await count(db, 'decisions', binh)).toBe(3)
    expect(await count(db, 'activity_log', binh)).toBe(1)
    expect(await count(db, 'staff_access_log', binh)).toBe(1)
    expect(await count(db, 'learning_plans', binh)).toBe(2)
    expect(await count(db, 'conversations', binh)).toBe(1)
    expect((await db.query('select public.verify_decision_chain() as broken')).rows[0]).toEqual({ broken: null })

    // A later decision still chains from the one that is now last.
    await decide(db, binh)
    expect((await db.query('select public.verify_decision_chain() as broken')).rows[0]).toEqual({ broken: null })

    expect((await db.query('select public.delete_student_records($1) as outcome', [an])).rows[0]).toEqual({ outcome: 'not-found' })

    await db.exec('reset role')
    expect((await db.query('select id from auth.users')).rows).toEqual([{ id: binh }])
  }
  finally {
    await db.close()
  }
})

it('still shows a decision that was edited before a student was deleted', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    await decide(db, binh)
    await decide(db, an)
    await decide(db, binh)
    await db.exec('reset role')
    await db.exec(`update public.decisions set reason_code = 'EDITED' where student_id = '${binh}' and id = (select min(id) from public.decisions)`)
    await db.exec('set role service_role')
    await db.query('select public.delete_student_records($1)', [an])
    expect((await db.query<{ broken: string | null }>('select public.verify_decision_chain() as broken')).rows[0]!.broken).not.toBeNull()
  }
  finally {
    await db.close()
  }
})

it('lets only the server call it, and lets no role edit a ledger row', async () => {
  const db = await database()
  try {
    await decide(db, an)
    await db.exec(`
      insert into public.activity_log (student_id, course_id, event_type) values ('${an}', 'intro_python', 'signed_in');
      insert into public.learning_plans (student_id, course_id, module_id, revision, steps) values ('${an}', 'intro_python', 'getting_started', 1, '[]');
    `)
    await db.exec('set role authenticated')
    await expect(db.query('select public.delete_student_records($1)', [an])).rejects.toThrow()
    await db.exec('reset role')
    await db.exec('set role service_role')
    for (const statement of [
      `update public.decisions set reason_code = 'X'`,
      `update public.evidence set attempt = attempt`,
      `update public.quiz_answers set module_id = module_id`,
      `update public.activity_log set event_type = 'signed_in'`,
      `update public.learning_plans set current_step = 1`,
      `delete from public.activity_log`,
      `delete from public.learning_plans`,
    ]) {
      await expect(db.exec(statement), statement).rejects.toThrow(/permission denied/)
    }
  }
  finally {
    await db.close()
  }
})
