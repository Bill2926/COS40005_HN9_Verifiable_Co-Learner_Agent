import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import { createSupabaseDeskmateSettingStore } from '../server/storage/supabase-deskmate-setting-store'
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
  it('lets a signed-in student read only their own conversation and write none', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(secretKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)
    expect(publishableKey).not.toBe(secretKey)

    const [an, binh] = demoAccounts
    const asAn = supabaseClient(url, publishableKey)
    const signedIn = await asAn.auth.signInWithPassword({ email: an.email, password: an.password })
    expect(signedIn.error).toBeNull()
    const anId = signedIn.data.user!.id
    const asBinh = supabaseClient(url, publishableKey)
    const binhSignedIn = await asBinh.auth.signInWithPassword({ email: binh.email, password: binh.password })
    expect(binhSignedIn.error).toBeNull()
    const binhId = binhSignedIn.data.user!.id

    const admin = supabaseClient(url, secretKey)
    const moduleId = `boundary-${crypto.randomUUID()}`
    const probes = await admin.from('conversations').insert([
      { student_id: anId, course_id: 'intro_python', module_id: moduleId },
      { student_id: binhId, course_id: 'intro_python', module_id: moduleId },
    ]).select('id, student_id')
    expect(probes.error).toBeNull()
    const anConversation = probes.data!.find(row => row.student_id === anId)!.id
    const binhConversation = probes.data!.find(row => row.student_id === binhId)!.id
    const written = await admin.from('messages').insert([
      { conversation_id: anConversation, author: 'student', text: 'An asks', exercise_id: 'sum_of_a_list' },
      { conversation_id: binhConversation, author: 'student', text: 'Binh asks', exercise_id: 'sum_of_a_list' },
    ])
    expect(written.error).toBeNull()

    try {
      // A query with no student filter returns An's rows only.
      const conversations = await asAn.from('conversations').select('student_id')
      expect(conversations.error).toBeNull()
      expect(conversations.data!.every(row => row.student_id === anId)).toBe(true)
      const messages = await asAn.from('messages').select('conversation_id, text').eq('text', 'Binh asks')
      expect(messages.error).toBeNull()
      expect(messages.data).toEqual([])

      // Naming Binh's id or Binh's conversation returns nothing.
      const named = await asAn.from('conversations').select('*').eq('student_id', binhId)
      expect(named.data).toEqual([])
      const throughId = await asAn.from('messages').select('*').eq('conversation_id', binhConversation)
      expect(throughId.data).toEqual([])

      // Through the store, a crafted request naming Binh returns nothing of Binh,
      // and An still reads An's own conversation.
      const store = createSupabaseConversationStore({ url, secretKey, courseId: 'intro_python', reader: asAn })
      expect(await store.messages(binhId, moduleId)).toEqual([])
      expect((await store.messages(anId, moduleId)).map(message => message.text)).toEqual(['An asks'])

      // A session with no student sees nothing.
      const anonymous = await supabaseClient(url, publishableKey).from('messages').select('*')
      if (anonymous.error) expect(anonymous.error.code).toBe('42501')
      else expect(anonymous.data).toEqual([])

      const resumePoints = await asAn.from('resume_points').select('*')
      if (resumePoints.error) expect(resumePoints.error.code).toBe('42501')
      else expect(resumePoints.data).toEqual([])

      const conversation = await asAn.from('conversations').insert({
        student_id: anId,
        course_id: 'intro_python',
        module_id: 'for_loop',
      })
      expect(conversation.error?.code).toBe('42501')

      const resumePoint = await asAn.from('resume_points').insert({
        student_id: anId,
        course_id: 'intro_python',
        module_id: 'for_loop',
        exercise_id: 'sum_of_a_list',
      })
      expect(resumePoint.error?.code).toBe('42501')

      const message = await asAn.from('messages').insert({
        conversation_id: anConversation,
        author: 'student',
        text: 'Forged',
        exercise_id: 'sum_of_a_list',
      })
      expect(message.error?.code).toBe('42501')
    }
    finally {
      await admin.from('conversations').delete().in('id', [anConversation, binhConversation])
    }
  }, 30_000)
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
    const reader = supabaseClient(url, envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
    const readerSignIn = await reader.auth.signInWithPassword({
      email: created.data.user!.email!,
      password: 'round-trip-password',
    })
    expect(readerSignIn.error).toBeNull()
    const store = createSupabaseConversationStore({ url, secretKey, courseId: 'intro_python', reader })

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
        addressedAgent: 'deskmate',
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
        addressedAgent: message.addressedAgent,
      }))).toEqual([
        {
          sequence: 1,
          author: 'student',
          approvedMove: null,
          text: 'Where does the total live?',
          exerciseId: 'sum_of_a_list',
          addressedAgent: 'deskmate',
        },
        {
          sequence: 2,
          author: 'event',
          approvedMove: null,
          text: 'Count the even numbers',
          exerciseId: 'count_the_even_numbers',
          addressedAgent: null,
        },
      ])
      for (const message of await store.messages(studentId, 'for_loop')) {
        expect(Number.isNaN(Date.parse(message.createdAt ?? ''))).toBe(false)
      }
      expect(await store.messages(studentId, 'variable')).toEqual([])

      // The deskmate switch round-trips for this student, on until switched off.
      const switches = createSupabaseDeskmateSettingStore({ url, secretKey })
      expect(await switches.read(studentId)).toBe(true)
      await switches.save(studentId, false)
      expect(await switches.read(studentId)).toBe(false)
      const signedIn = supabaseClient(url, envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
      const read = await signedIn.from('deskmate_settings').select('*')
      expect(read.data ?? []).toEqual([])
    }
    finally {
      await admin.auth.admin.deleteUser(studentId)
    }
  }, 20_000)
})
