import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import { createSupabaseCourseStore } from '../server/storage/supabase-course-store'
import { createSupabaseQuizAnswerStore } from '../server/storage/supabase-quiz-answer-store'

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

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

describe('courses boundary', () => {
  it('lets a student signed in with the publishable key neither read nor write course content', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)

    const signedOut = createClient(url, publishableKey, noSession)
    const student = createClient(url, publishableKey, noSession)
    const signedIn = await student.auth.signInWithPassword(demoAccounts[0]!)
    expect(signedIn.error).toBeNull()

    for (const client of [student, signedOut]) {
      // The spec holds hint ladders, reference solutions and the correct quiz choices.
      const selected = await client.from('courses').select('spec').eq('id', 'intro_python')
      expect(selected.error?.code).toBe(permissionDenied)
      expect(JSON.stringify(selected)).not.toContain('referenceSolution')
      // The lecturer's unpublished course draft is never readable by a student.
      const draft = await client.from('courses').select('draft').eq('id', 'intro_python')
      expect(draft.error?.code).toBe(permissionDenied)
      expect(draft.data).toBeNull()
      const drafted = await client.from('courses').update({ draft: { courseId: 'intro_python' } }).eq('id', 'intro_python')
      expect(drafted.error?.code).toBe(permissionDenied)

      const inserted = await client.from('courses').insert({ id: 'forged', title: 'Forged', spec: { courseId: 'forged', title: 'Forged' } })
      expect(inserted.error?.code).toBe(permissionDenied)
      const updated = await client.from('courses').update({ title: 'Forged' }).eq('id', 'intro_python')
      expect(updated.error?.code).toBe(permissionDenied)
      const deleted = await client.from('courses').delete().eq('id', 'intro_python')
      expect(deleted.error?.code).toBe(permissionDenied)
    }
  }, 20_000)

  it('serves the server the Python course from the database', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(secretKey).toBeTruthy()

    const course = await createSupabaseCourseStore({ url, secretKey }).course('intro_python')

    expect(course.title).toBe('Introduction to Programming with Python')
    expect(course.masteryThreshold).toBe(0.9)
    expect(course.modules.map(module => [module.id, module.available])).toEqual([
      ['getting_started', true],
      ['variables', true],
      ['strings', true],
      ['conditionals', true],
      ['loops', true],
      ['lists_and_tuples', false],
      ['dictionaries_and_sets', false],
      ['functions', false],
      ['modules_and_library', false],
      ['file_handling', false],
      ['error_handling', false],
    ])
    expect(course.studyModules[0]!.exercises.map(exercise => exercise.id))
      .toEqual(['say_hello', 'join_words', 'sign_the_program'])
  }, 20_000)

  it('records student data under the course its store is scoped to', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    const secret = createClient(url, secretKey, noSession)
    const student = createClient(url, envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), noSession)
    const signedIn = await student.auth.signInWithPassword(demoAccounts[0]!)
    expect(signedIn.error).toBeNull()
    const studentId = signedIn.data.user!.id
    const questionId = `course_${crypto.randomUUID()}`

    try {
      await createSupabaseQuizAnswerStore({ url, secretKey, courseId: 'intro_python' })
        .record({ studentId, moduleId: 'getting_started', questionId, choice: 0, correct: true })

      const stored = await secret.from('quiz_answers').select('course_id').eq('question_id', questionId).single()
      expect(stored.error).toBeNull()
      expect(stored.data).toEqual({ course_id: 'intro_python' })
    }
    finally {
      await secret.from('quiz_answers').delete().eq('question_id', questionId)
    }
  }, 20_000)
})
