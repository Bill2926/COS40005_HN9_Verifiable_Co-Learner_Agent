import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'

// Postgres raises this when a role lacks the privilege for the statement.
const permissionDenied = '42501'
const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

function envValue(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  if (!existsSync('.env')) return ''

  const line = readFileSync('.env', 'utf8')
    .split('\n')
    .find(entry => entry.startsWith(`${name}=`))
  if (!line) return ''

  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
}

describe('student numbers boundary', () => {
  it('keeps a signed-in student from changing their own student number', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)
    expect(secretKey).toBeTruthy()

    const admin = createClient(url, secretKey, noSession)
    const student = createClient(url, publishableKey, noSession)
    const an = demoAccounts[0]!
    const signedIn = await student.auth.signInWithPassword({ email: an.email, password: an.password })
    expect(signedIn.error).toBeNull()
    const studentId = signedIn.data.user!.id

    const before = await admin.from('students').select('student_number').eq('id', studentId).single()
    expect(before.data?.student_number).toMatch(/^SWB\d{4,}$/)

    const updated = await student.from('students')
      .update({ student_number: 'SWB7777' })
      .eq('id', studentId)
      .select('student_number')
    expect(updated.error).toBeNull()
    expect(updated.data).toEqual([])

    const changed = await student.rpc('set_student_number', {
      actor_email: an.email,
      target: studentId,
      new_number: 'SWB7777',
    })
    expect(changed.error?.code).toBe(permissionDenied)

    const directory = await student.from('student_directory').select('*')
    expect(directory.error?.code).toBe(permissionDenied)

    const after = await admin.from('students').select('student_number').eq('id', studentId).single()
    expect(after.data?.student_number).toBe(before.data?.student_number)
  }, 20_000)
})
