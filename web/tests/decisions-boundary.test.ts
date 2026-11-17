import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { demoAccounts } from '../server/auth/demo-accounts'
import type { DecisionRecord } from '../server/storage/decision-log'
import { createSupabaseDecisionLogStore } from '../server/storage/supabase-decision-log'

const marker = 'BOUNDARY_MARKER_SHOULD_NOT_LEAK'
const code = 'print("STUDENT_CODE_SHOULD_NOT_BE_STORED")'

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

describe('decision log boundary', () => {
  it('lets a signed-in student neither read nor write a decision', async () => {
    const url = envValue('NUXT_PUBLIC_SUPABASE_URL')
    const publishableKey = envValue('NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    const secretKey = envValue('NUXT_SUPABASE_SECRET_KEY')
    expect(url).toBeTruthy()
    expect(publishableKey).toBeTruthy()
    expect(secretKey).toBeTruthy()
    expect(publishableKey.startsWith('sb_secret_')).toBe(false)
    expect(publishableKey).not.toBe(secretKey)

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

    const store = createSupabaseDecisionLogStore({ url, secretKey, courseId: 'intro_python' })
    const turnId = crypto.randomUUID()
    const record: DecisionRecord = {
      time: new Date().toISOString(),
      studentId: studentId!,
      turnId,
      agent: 'teacher',
      proposedMove: 'explain_concept',
      proposedScope: 'lists_and_tuples',
      verdict: 'downgrade',
      ruledMove: 'redirect_to_module',
      ruledScope: 'lists_and_tuples',
      ruleId: 'scope_requires_unlocked_module',
      reasonCode: marker,
      masteries: [{ moduleId: 'loops', mastery: 0 }],
      unlockedModuleIds: ['loops'],
      verifyShieldOn: true,
      masteryThreshold: 0.83,
      ruleChecks: [
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_requires_unlocked_module', passed: false, reasonCode: marker },
      ],
      addressedAgent: 'teacher',
    }
    const olderTurnId = crypto.randomUUID()
    const secret = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    try {
      await store.append(record)
      const listed = await store.list({ studentId, verdict: 'downgrade' })
      const stored = listed.find(decision => decision.turnId === turnId)
      expect(stored && Date.parse(stored.time)).toBe(Date.parse(record.time))
      expect(stored).toMatchObject({
        studentId,
        agent: 'teacher',
        proposedMove: 'explain_concept',
        proposedScope: 'lists_and_tuples',
        verdict: 'downgrade',
        ruledMove: 'redirect_to_module',
        ruledScope: 'lists_and_tuples',
        ruleId: 'scope_requires_unlocked_module',
        reasonCode: marker,
        masteries: [{ moduleId: 'loops', mastery: 0 }],
        unlockedModuleIds: ['loops'],
        verifyShieldOn: true,
        masteryThreshold: 0.83,
        ruleChecks: record.ruleChecks,
        addressedAgent: 'teacher',
      })

      const { ruleChecks: _omitted, ...older } = record
      await store.append({ ...older, turnId: olderTurnId })
      const olderStored = (await store.list({ studentId })).find(decision => decision.turnId === olderTurnId)
      expect(olderStored).toBeDefined()
      expect(olderStored).not.toHaveProperty('ruleChecks')
      expect(await store.list({ studentId: 'not-an-id' })).toEqual([])
      expect(JSON.stringify(listed)).not.toContain(code)
      expect(JSON.stringify(listed)).not.toContain('An')

      const selected = await supabase.from('decisions').select('*')
      expect(selected.error).toBeNull()
      expect(selected.data).toEqual([])
      expect(JSON.stringify(selected)).not.toContain(marker)

      const inserted = await supabase.from('decisions').insert({
        recorded_at: record.time,
        student_id: studentId,
        course_id: 'intro_python',
        turn_id: crypto.randomUUID(),
        agent: 'deskmate',
        proposed_move: 'peer_question',
        verdict: 'allow',
        rule_id: 'role_table',
        reason_code: 'FORGED',
        masteries: [],
        unlocked_module_ids: [],
        verify_shield_on: false,
      })
      expect(inserted.error?.code).toBe('42501')
      expect(inserted.data).toBeNull()

      const updated = await supabase.from('decisions').update({
        reason_code: 'FORGED',
      }).eq('turn_id', turnId)
      expect(updated.data ?? []).toEqual([])

      const deleted = await supabase.from('decisions').delete().eq('turn_id', turnId)
      expect(deleted.data ?? []).toEqual([])

      const persisted = await secret.from('decisions')
        .select('reason_code')
        .eq('turn_id', turnId)
        .single()
      expect(persisted.error).toBeNull()
      expect(persisted.data).toEqual({ reason_code: marker })
    }
    finally {
      await secret.from('decisions').delete().eq('turn_id', turnId)
      await secret.from('decisions').delete().eq('turn_id', olderTurnId)
    }
  }, 20_000)
})
