import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import { createSupabaseConversationStore } from '../server/storage/supabase-conversation-store'

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

function supabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

describe('conversation storage boundary', () => {
  it('returns nothing and refuses inserts on conversations, messages, and resume points', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(secretKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)
    expect(publishableKey).not.toBe(secretKey)

    const supabase = supabaseClient(url, publishableKey)
    const an = demoAccounts[0]
    const signedIn = await supabase.auth.signInWithPassword({
      email: an.email,
      password: an.password,
    })
    expect(signedIn.error).toBeNull()
    const studentId = signedIn.data.user?.id
    expect(studentId).toBeTruthy()

    for (const table of ['conversations', 'messages', 'resume_points'] as const) {
      const selected = await supabase.from(table).select('*')
      expect(selected.error).toBeNull()
      expect(selected.data).toEqual([])
    }

    const conversation = await supabase.from('conversations').insert({
      student_id: studentId,
      course_id: 'intro_python',
      module_id: 'for_loop',
    })
    expect(conversation.error?.code).toBe('42501')
    expect(conversation.data).toBeNull()

    const resumePoint = await supabase.from('resume_points').insert({
      student_id: studentId,
      course_id: 'intro_python',
      module_id: 'for_loop',
      exercise_id: 'sum_of_a_list',
    })
    expect(resumePoint.error?.code).toBe('42501')
    expect(resumePoint.data).toBeNull()

    const admin = supabaseClient(url, secretKey)
    const probe = await admin.from('conversations').insert({
      student_id: studentId,
      course_id: 'intro_python',
      module_id: `boundary-${crypto.randomUUID()}`,
    }).select('id').single()
    expect(probe.error).toBeNull()

    try {
      const hidden = await supabase.from('conversations').select('*').eq('id', probe.data!.id)
      expect(hidden.error).toBeNull()
      expect(hidden.data).toEqual([])

      const message = await supabase.from('messages').insert({
        conversation_id: probe.data!.id,
        author: 'student',
        text: 'Forged',
        exercise_id: 'sum_of_a_list',
      })
      expect(message.error?.code).toBe('42501')
      expect(message.data).toBeNull()
    }
    finally {
      await admin.from('conversations').delete().eq('id', probe.data!.id)
    }
  }, 20_000)
})

describe('supabase conversation store', () => {
  it('writes one conversation per module and a resume point, then reads them back', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(secretKey).toBeTruthy()

    const admin = supabaseClient(url, secretKey)
    const created = await admin.auth.admin.createUser({
      email: `round-trip-${crypto.randomUUID()}@example.com`,
      password: 'round-trip-password',
      email_confirm: true,
      user_metadata: { display_name: 'Round trip' },
    })
    expect(created.error).toBeNull()
    const studentId = created.data.user!.id
    const store = createSupabaseConversationStore({ url, secretKey, courseId: 'intro_python' })

    try {
      expect(await store.displayName(studentId)).toBe('Round trip')

      await store.saveResumePoint(studentId, {
        moduleId: 'for_loop',
        exerciseId: 'count_the_even_numbers',
      })
      await store.appendMessage(studentId, 'for_loop', {
        author: 'student',
        approvedMove: null,
        text: 'Where does the total live?',
        exerciseId: 'sum_of_a_list',
      })
      await store.appendMessage(studentId, 'for_loop', {
        author: 'event',
        approvedMove: null,
        text: 'Count the even numbers',
        exerciseId: 'count_the_even_numbers',
      })

      expect(await store.resumePoint(studentId)).toEqual({
        moduleId: 'for_loop',
        exerciseId: 'count_the_even_numbers',
      })
      expect((await store.messages(studentId, 'for_loop')).map(message => ({
        sequence: message.sequence,
        author: message.author,
        approvedMove: message.approvedMove,
        text: message.text,
        exerciseId: message.exerciseId,
      }))).toEqual([
        {
          sequence: 1,
          author: 'student',
          approvedMove: null,
          text: 'Where does the total live?',
          exerciseId: 'sum_of_a_list',
        },
        {
          sequence: 2,
          author: 'event',
          approvedMove: null,
          text: 'Count the even numbers',
          exerciseId: 'count_the_even_numbers',
        },
      ])
      for (const message of await store.messages(studentId, 'for_loop')) {
        expect(Number.isNaN(Date.parse(message.createdAt ?? ''))).toBe(false)
      }
      expect(await store.messages(studentId, 'variable')).toEqual([])
    }
    finally {
      await admin.auth.admin.deleteUser(studentId)
    }
  }, 20_000)
})
