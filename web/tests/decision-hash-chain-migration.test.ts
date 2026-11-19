import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const an = 'a11a11a1-1111-4111-8111-111111111111'

async function database() {
  const names = (await readdir(migrations)).sort().filter(name => name.endsWith('.sql'))
  const migration = names.find(name => name.endsWith('_decision_hash_chain.sql'))
  if (!migration) throw new Error('The decision hash chain migration is missing.')
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create role supabase_auth_admin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz not null default now());
  `)
  for (const name of names) {
    if (name >= migration) break
    await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  }
  await db.exec(`insert into auth.users (id, email) values ('${an}', 'an@example.com')`)
  return {
    db,
    async apply() {
      const sql = await readFile(new URL(migration, migrations), 'utf8')
      await db.exec(sql)
      await db.exec(sql)
      await db.exec('set role service_role')
    },
  }
}

async function insertDecision(db: PGlite, overrides: { codeVersion?: string, contentHash?: string, previousHash?: string } = {}) {
  const columns = ['recorded_at', 'student_id', 'course_id', 'turn_id', 'agent', 'proposed_move', 'outcome', 'verdict', 'ruled_move', 'rule_id', 'reason_code', 'masteries', 'unlocked_module_ids', 'verify_shield_on']
  const values = [`now()`, `'${an}'`, `'intro_python'`, `gen_random_uuid()`, `'teacher'`, `'answer_question'`, `'ruled'`, `'allow'`, `'answer_question'`, `'role_table'`, `'ROLE_PERMITTED'`, `'[]'`, `'[]'`, `true`]
  if (overrides.codeVersion !== undefined) {
    columns.push('code_version')
    values.push(`'${overrides.codeVersion}'`)
  }
  if (overrides.contentHash !== undefined) {
    columns.push('content_hash')
    values.push(`'${overrides.contentHash}'`)
  }
  if (overrides.previousHash !== undefined) {
    columns.push('previous_hash')
    values.push(`'${overrides.previousHash}'`)
  }
  const inserted = await db.query<{ id: string }>(
    `insert into public.decisions (${columns.join(', ')}) values (${values.join(', ')}) returning id`,
  )
  return inserted.rows[0]!.id
}

it('stores a hash of each new decision and of the decision before it, set by the database', async () => {
  const { db, apply } = await database()
  try {
    await apply()
    const history = await db.query<{ id: string }>(`
      insert into public.course_history (course_id, action, actor_email)
      values ('intro_python', 'published', 'lecturer@example.com')
      returning id
    `)
    const inForce = history.rows[0]!.id

    const first = await insertDecision(db, { codeVersion: 'abc123' })
    const second = await insertDecision(db, { contentHash: 'forged', previousHash: 'forged' })

    const rows = await db.query<{
      id: string
      content_hash: string
      previous_hash: string
      code_version: string | null
      course_history_id: string | null
    }>('select id, content_hash, previous_hash, code_version, course_history_id from public.decisions order by id')
    const storedFirst = rows.rows.find(row => String(row.id) === String(first))
    const storedSecond = rows.rows.find(row => String(row.id) === String(second))

    expect(storedFirst?.previous_hash).toBe('genesis')
    expect(storedFirst?.content_hash).toBeTruthy()
    expect(storedFirst?.code_version).toBe('abc123')
    expect(String(storedFirst?.course_history_id)).toBe(String(inForce))
    expect(storedSecond?.previous_hash).toBe(storedFirst?.content_hash)
    expect(storedSecond?.content_hash).not.toBe('forged')
    expect(storedSecond?.previous_hash).not.toBe('forged')
    expect(String(storedSecond?.course_history_id)).toBe(String(inForce))

    const chain = await db.query<{ verify_decision_chain: string | null }>('select public.verify_decision_chain()')
    expect(chain.rows[0]?.verify_decision_chain).toBeNull()
  }
  finally {
    await db.close()
  }
})

it('covers decisions already stored, from the chain starting point', async () => {
  const { db, apply } = await database()
  try {
    await db.exec('set role service_role')
    await insertDecision(db)
    await insertDecision(db)
    await db.exec('reset role')
    await apply()

    const rows = await db.query<{ id: string, content_hash: string, previous_hash: string, course_history_id: string | null }>(
      'select id, content_hash, previous_hash, course_history_id from public.decisions order by id',
    )
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows[0]?.previous_hash).toBe('genesis')
    expect(rows.rows[0]?.content_hash).toBeTruthy()
    expect(rows.rows[1]?.previous_hash).toBe(rows.rows[0]?.content_hash)
    expect(rows.rows[0]?.course_history_id).not.toBeNull()
    expect(rows.rows[1]?.course_history_id).toBe(rows.rows[0]?.course_history_id)

    const chain = await db.query<{ verify_decision_chain: string | null }>('select public.verify_decision_chain()')
    expect(chain.rows[0]?.verify_decision_chain).toBeNull()
  }
  finally {
    await db.close()
  }
})

it('names the edited decision as the first broken row', async () => {
  const { db, apply } = await database()
  try {
    await apply()
    const first = await insertDecision(db)
    const second = await insertDecision(db)

    await db.exec(`update public.decisions set verdict = 'block' where id = ${first}`)
    const brokenFirst = await db.query<{ verify_decision_chain: string | null }>('select public.verify_decision_chain()')
    expect(String(brokenFirst.rows[0]?.verify_decision_chain)).toBe(String(first))

    await db.exec(`update public.decisions set verdict = 'allow' where id = ${first}`)
    await db.exec(`update public.decisions set code_version = 'rewritten' where id = ${second}`)
    const brokenSecond = await db.query<{ verify_decision_chain: string | null }>('select public.verify_decision_chain()')
    expect(String(brokenSecond.rows[0]?.verify_decision_chain)).toBe(String(second))
  }
  finally {
    await db.close()
  }
})

it('stays verified when the session time zone changes', async () => {
  const { db, apply } = await database()
  try {
    await apply()
    await db.exec("set timezone = 'UTC'")
    await insertDecision(db)
    await db.exec("set timezone = 'Asia/Ho_Chi_Minh'")
    const chain = await db.query<{ verify_decision_chain: string | null }>('select public.verify_decision_chain()')
    expect(chain.rows[0]?.verify_decision_chain).toBeNull()
  }
  finally {
    await db.close()
  }
})

it('leaves a decision with no course history entry when none was in force yet', async () => {
  const { db, apply } = await database()
  try {
    await db.exec('set role service_role')
    await db.exec(`
      insert into public.decisions
        (recorded_at, student_id, course_id, turn_id, agent, proposed_move, outcome, verdict,
         ruled_move, rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on)
      values ('2000-01-01T00:00:00Z', '${an}', 'intro_python', gen_random_uuid(), 'teacher',
              'answer_question', 'ruled', 'allow', 'answer_question', 'role_table', 'ROLE_PERMITTED',
              '[]', '[]', true)
    `)
    await db.exec('reset role')
    await apply()

    const row = await db.query<{ course_history_id: string | null }>(
      "select course_history_id from public.decisions where recorded_at = '2000-01-01T00:00:00Z'",
    )
    expect(row.rows[0]?.course_history_id).toBeNull()
    const chain = await db.query<{ verify_decision_chain: string | null }>('select public.verify_decision_chain()')
    expect(chain.rows[0]?.verify_decision_chain).toBeNull()
  }
  finally {
    await db.close()
  }
})

it('lets only the server run the chain command', async () => {
  const { db, apply } = await database()
  try {
    await apply()
    await db.exec('set role anon')
    await expect(db.query('select public.verify_decision_chain()')).rejects.toThrow()
  }
  finally {
    await db.close()
  }
})
