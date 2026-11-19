import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import { createSupabaseQuizAnswerStore } from '../server/storage/supabase-quiz-answer-store'
import { createSupabaseEvidenceStore } from '../server/storage/supabase-evidence-store'

// Postgres raises this when a role lacks the privilege for the statement.
const permissionDenied = '42501'

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

describe('quiz answers boundary', () => {
  it('keeps only the first answer, and lets a signed-in student neither read nor write it', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(secretKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)

    const supabase = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const an = demoAccounts[0]
    const signedIn = await supabase.auth.signInWithPassword({
      email: an.email,
      password: an.password,
    })
    expect(signedIn.error).toBeNull()
    const studentId = signedIn.data.user?.id
    expect(studentId).toBeTruthy()

    const moduleId = 'getting_started'
    const questionId = `boundary_${crypto.randomUUID()}`
    const store = createSupabaseQuizAnswerStore({ url, secretKey, courseId: 'intro_python' })
    const secret = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    try {
      // The first answer is stored; a second answer to the same question is not,
      // and the first one stands.
      const first = await store.record({ studentId: studentId!, moduleId, questionId, choice: 1, correct: false })
      expect(first.stored).toBe(true)
      const second = await store.record({ studentId: studentId!, moduleId, questionId, choice: 3, correct: true })
      expect(second.stored).toBe(false)
      expect(second.row.choice).toBe(1)
      expect(second.row.correct).toBe(false)

      const forModule = await store.forStudentModule(studentId!, moduleId)
      expect(forModule.filter(row => row.questionId === questionId)).toHaveLength(1)

      // The student cannot read the ledger.
      const selected = await supabase.from('quiz_answers').select('*').eq('question_id', questionId)
      if (selected.error) expect(selected.error.code).toBe(permissionDenied)
      else expect(selected.data).toEqual([])

      // Nor insert into it.
      const inserted = await supabase.from('quiz_answers').insert({
        student_id: studentId,
        course_id: 'intro_python',
        module_id: moduleId,
        question_id: `${questionId}_forged`,
        choice: 0,
        correct: true,
      })
      expect(inserted.error?.code).toBe(permissionDenied)
      expect(inserted.data).toBeNull()

      // Update and delete are revoked on both ledgers.
      const updatedQuiz = await supabase.from('quiz_answers').update({ choice: 2 }).eq('question_id', questionId)
      expect(updatedQuiz.error?.code).toBe(permissionDenied)
      const deletedQuiz = await supabase.from('quiz_answers').delete().eq('question_id', questionId)
      expect(deletedQuiz.error?.code).toBe(permissionDenied)

      const updatedEvidence = await supabase.from('evidence').update({ tests_passed: 0 }).eq('student_id', studentId)
      expect(updatedEvidence.error?.code).toBe(permissionDenied)
      const deletedEvidence = await supabase.from('evidence').delete().eq('student_id', studentId)
      expect(deletedEvidence.error?.code).toBe(permissionDenied)

      // The first answer is still there, unchanged, under the secret key.
      const persisted = await secret.from('quiz_answers')
        .select('choice, correct')
        .eq('question_id', questionId)
        .single()
      expect(persisted.error).toBeNull()
      expect(persisted.data).toEqual({ choice: 1, correct: false })
    }
    finally {
      await secret.from('quiz_answers').delete().eq('question_id', questionId)
    }
  }, 20_000)

  it('merges submissions and quiz answers by timestamp across modules', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    const secret = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const student = createClient(url, envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signedIn = await student.auth.signInWithPassword(demoAccounts[0]!)
    expect(signedIn.error).toBeNull()
    const studentId = signedIn.data.user!.id
    const fixture = crypto.randomUUID()
    const first = '2026-11-11T04:00:00.000100Z'
    const second = '2026-11-11T04:00:00.000200Z'
    const third = '2026-11-11T04:00:00.000300Z'

    try {
      const submitted = await secret.from('evidence').insert([
        { student_id: studentId, course_id: 'intro_python', module_id: 'getting_started', exercise_id: fixture, recorded_at: third, tests_passed: 3, tests_total: 3 },
        { student_id: studentId, course_id: 'intro_python', module_id: 'variables', exercise_id: fixture, recorded_at: first, tests_passed: 1, tests_total: 3 },
      ])
      expect(submitted.error).toBeNull()
      const answered = await secret.from('quiz_answers').insert({
        student_id: studentId, course_id: 'intro_python', module_id: 'loops', question_id: fixture, recorded_at: second, choice: 1, correct: true,
      })
      expect(answered.error).toBeNull()

      const evidence = await createSupabaseEvidenceStore({ url, secretKey, courseId: 'intro_python' }).forStudent(studentId)
      expect(evidence
        .filter(row => (row.kind === 'submission' ? row.exerciseId : row.questionId) === fixture)
        .map(({ kind, moduleId, allPassed }) => ({ kind, moduleId, allPassed }))).toEqual([
        { kind: 'submission', moduleId: 'variables', allPassed: false },
        { kind: 'quiz_answer', moduleId: 'loops', allPassed: true },
        { kind: 'submission', moduleId: 'getting_started', allPassed: true },
      ])
    }
    finally {
      await Promise.all([
        secret.from('evidence').delete().eq('student_id', studentId).eq('exercise_id', fixture),
        secret.from('quiz_answers').delete().eq('student_id', studentId).eq('question_id', fixture),
      ])
    }
  }, 20_000)
})
