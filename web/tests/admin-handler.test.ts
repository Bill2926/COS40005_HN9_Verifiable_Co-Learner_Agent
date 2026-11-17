import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAdminRole, handleAdmin } from '../server/admin/handle-admin'
import { productOwnerAccount } from '../server/auth/demo-accounts'
import { agentsForTurn, createFakeAgents } from '../server/agents'
import type { ModelSettings } from '../server/language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore, type DecisionRecord } from '../server/storage/decision-log'
import { createMemoryModelSettingsStore } from '../server/storage/model-settings-store'
import { createMemoryVerifyShieldStore, verifyShieldForTurn } from '../server/verify-shield'
import { handleTurn } from '../server/turn/handle-turn'

const owner = productOwnerAccount.email
const adminEmails = 'assistant@example.com, owner@example.com'
const signedInStudent = '6f1b0c1e-1111-4111-8111-111111111111'
const savedKey = 'sk-super-secret-a1b2'
const envKey = 'sk-environment-key-zz99'
const fakeSentence = 'A running total has to be created before the loop, so each pass can add to the same number.'
const realSentence = 'Counted by the saved model.'

const realEnv: ModelSettings = {
  provider: 'real',
  apiKey: envKey,
  baseUrl: 'https://env.example',
  modelName: 'env-model',
}

const fakeEnv: ModelSettings = {
  provider: 'fake',
  apiKey: '',
  baseUrl: '',
  modelName: '',
}

function ownerRequest(overrides: {
  email?: string | null
  env?: ModelSettings
  store?: ReturnType<typeof createMemoryModelSettingsStore>
  decisions?: ReturnType<typeof createMemoryDecisionLogStore>
  verifyShield?: ReturnType<typeof createMemoryVerifyShieldStore>
  verifyShieldEnv?: string
  body?: unknown
} = {}) {
  return {
    email: 'email' in overrides ? overrides.email! : owner,
    adminEmails,
    env: overrides.env ?? realEnv,
    store: overrides.store ?? createMemoryModelSettingsStore(),
    decisions: overrides.decisions,
    verifyShield: overrides.verifyShield,
    verifyShieldEnv: overrides.verifyShieldEnv,
    body: overrides.body ?? { event: 'read' },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin handler', () => {
  it('refuses a student and leaves the saved settings untouched', async () => {
    const store = createMemoryModelSettingsStore()

    await expect(handleAdmin(ownerRequest({
      email: 'an@example.com',
      store,
      body: { event: 'save', provider: 'fake' },
    }))).rejects.toMatchObject({ statusCode: 403 })

    expect(await store.read()).toBeNull()
  })

  it('answers a role check for the product owner and refuses anyone else', () => {
    expect(checkAdminRole({ email: owner, adminEmails })).toEqual({ productOwner: true })
    expect(() => checkAdminRole({ email: 'an@example.com', adminEmails })).toThrow(expect.objectContaining({ statusCode: 403 }))
    expect(() => checkAdminRole({ email: null, adminEmails })).toThrow(expect.objectContaining({ statusCode: 401 }))
  })

  it('refuses a request with no session', async () => {
    await expect(handleAdmin(ownerRequest({ email: null })))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('uses the saved fake provider on the next turn without a restart', async () => {
    const store = createMemoryModelSettingsStore()
    const saved = await handleAdmin(ownerRequest({
      env: realEnv,
      store,
      body: { event: 'save', provider: 'fake' },
    }))

    expect(saved.model).toEqual({
      provider: 'fake',
      apiKeyMask: 'sk-…zz99',
      baseUrl: 'https://env.example',
      modelName: 'env-model',
      saved: true,
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await agentsForTurn(store, realEnv))

    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe(fakeSentence)
  })

  it('uses the saved real provider on the next turn', async () => {
    const store = createMemoryModelSettingsStore()
    const calls: { url: string, authorization: string, model: string }[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { model?: string, stream?: boolean, messages?: { content?: string }[] }
      calls.push({
        url: request.url,
        authorization: request.headers.get('authorization') ?? '',
        model: body.model ?? '',
      })
      const instructions = JSON.stringify(body.messages ?? [])
      if (body.stream) return sse(realSentence)
      const proposal = instructions.includes('You are Mai') ? null : { type: 'explain_concept', scope: 'getting_started' }
      return Response.json({
        id: 'chatcmpl-test',
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({ proposal }),
          },
          finish_reason: 'stop',
        }],
      })
    })

    await handleAdmin(ownerRequest({
      env: fakeEnv,
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-chat',
      },
    }))

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await agentsForTurn(store, fakeEnv))

    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(call => call.url === 'https://api.deepseek.com/chat/completions')).toBe(true)
    expect(calls.every(call => call.authorization === `Bearer ${savedKey}`)).toBe(true)
    expect(calls.every(call => call.model === 'deepseek-chat')).toBe(true)
    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe(realSentence)
    expect(JSON.stringify(state)).not.toContain(savedKey)
  })

  it('returns the API key only as a mask', async () => {
    const store = createMemoryModelSettingsStore()
    const saved = await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-chat',
      },
    }))
    const again = await handleAdmin(ownerRequest({ store, body: { event: 'read' } }))

    expect(saved.model.apiKeyMask).toBe('sk-…a1b2')
    expect(again.model.apiKeyMask).toBe('sk-…a1b2')
    expect(JSON.stringify(saved)).not.toContain(savedKey)
    expect(JSON.stringify(again)).not.toContain(savedKey)

    const shortKey = 'secret1'
    const short = await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: shortKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-chat',
      },
    }))
    expect(short.model.apiKeyMask).toBe('…')
    expect(JSON.stringify(short)).not.toContain(shortKey)
  })

  it('keeps the saved API key when a later save leaves the key blank', async () => {
    const store = createMemoryModelSettingsStore()
    await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-flash',
      },
    }))
    const calls: { authorization: string, model: string }[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { model?: string, stream?: boolean, messages?: unknown }
      calls.push({
        authorization: request.headers.get('authorization') ?? '',
        model: body.model ?? '',
      })
      const instructions = JSON.stringify(body.messages ?? [])
      if (body.stream) return sse(realSentence)
      const proposal = instructions.includes('You are Mai') ? null : { type: 'explain_concept', scope: 'getting_started' }
      return Response.json({
        choices: [{
          message: { role: 'assistant', content: JSON.stringify({ proposal }) },
          finish_reason: 'stop',
        }],
      })
    })

    const updated = await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: '   ',
        baseUrl: 'https://api.deepseek.com/',
        modelName: 'deepseek-chat',
      },
    }))

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await agentsForTurn(store, fakeEnv))

    expect(updated.model.apiKeyMask).toBe('sk-…a1b2')
    expect(JSON.stringify(updated)).not.toContain(savedKey)
    expect(calls.every(call => call.authorization === `Bearer ${savedKey}`)).toBe(true)
    expect(calls.every(call => call.model === 'deepseek-chat')).toBe(true)
  })

  it('refuses to save a real model with a blank model name', async () => {
    const store = createMemoryModelSettingsStore()

    await expect(handleAdmin(ownerRequest({
      env: fakeEnv,
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: ' ',
      },
    }))).rejects.toMatchObject({ statusCode: 400 })

    expect(await store.read()).toBeNull()
  })

  it('falls back to the environment when nothing has been saved', async () => {
    const store = createMemoryModelSettingsStore()
    const viewed = await handleAdmin(ownerRequest({
      env: realEnv,
      store,
      body: { event: 'read' },
    }))

    expect(viewed.model).toEqual({
      provider: 'real',
      apiKeyMask: 'sk-…zz99',
      baseUrl: 'https://env.example',
      modelName: 'env-model',
      saved: false,
    })
    expect(JSON.stringify(viewed)).not.toContain(envKey)

    const calls: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { stream?: boolean, messages?: unknown }
      calls.push(request.url)
      const instructions = JSON.stringify(body.messages ?? [])
      if (body.stream) return sse('From the environment.')
      const proposal = instructions.includes('You are Mai') ? null : { type: 'explain_concept', scope: 'getting_started' }
      return Response.json({
        choices: [{
          message: { role: 'assistant', content: JSON.stringify({ proposal }) },
          finish_reason: 'stop',
        }],
      })
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await agentsForTurn(store, realEnv))

    expect(calls.every(url => url === 'https://env.example/chat/completions')).toBe(true)
    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe('From the environment.')

    const scripted = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'And the empty case?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await agentsForTurn(store, fakeEnv))

    expect(scripted.conversation.find(message => message.author === 'teacher')?.text).toBe(fakeSentence)
  })

  it('shows the product owner one decision per agent proposal', async () => {
    const decisions = createMemoryDecisionLogStore()
    const lesson = 'LISTS_LESSON_SHOULD_NOT_BE_LOGGED'
    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'What are lists?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An Nguyen',
    }), createFakeAgents(
      { proposal: { type: 'explain_concept', scope: 'lists_and_tuples' }, text: lesson },
      { proposal: { type: 'peer_question' }, text: 'wait, are we still on loops?' },
    ), { decisions })

    const viewed = await handleAdmin(ownerRequest({ decisions }))
    const teacher = viewed.decisions.find(decision => decision.agent === 'teacher')
    const deskmate = viewed.decisions.find(decision => decision.agent === 'deskmate')

    expect(viewed.decisions).toHaveLength(2)
    expect(teacher?.turnId).toMatch(/^[0-9a-f-]{36}$/)
    expect(teacher?.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(deskmate?.turnId).toBe(teacher?.turnId)
    expect(deskmate?.time).toBe(teacher?.time)
    expect(Object.keys(teacher ?? {}).sort()).toEqual(decisionFields)
    expect(teacher).toMatchObject({
      studentId: signedInStudent,
      agent: 'teacher',
      proposedMove: 'explain_concept',
      proposedScope: 'lists_and_tuples',
      verdict: 'downgrade',
      ruledMove: 'redirect_to_module',
      ruledScope: 'lists_and_tuples',
      ruleId: 'scope_requires_unlocked_module',
      reasonCode: 'MODULE_CLOSED',
      masteries: priorMasteries,
      unlockedModuleIds: ['getting_started'],
      verifyShieldOn: true,
      ruleChecks: [
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' },
        { ruleId: 'scope_requires_unlocked_module', passed: false, reasonCode: 'MODULE_CLOSED' },
      ],
    })
    expect(deskmate).toMatchObject({
      studentId: signedInStudent,
      agent: 'deskmate',
      proposedMove: 'peer_question',
      proposedScope: null,
      verdict: 'allow',
      ruledMove: 'peer_question',
      ruledScope: null,
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      verifyShieldOn: true,
      ruleChecks: [
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'all_rules', passed: true, reasonCode: 'ALL_RULES_PASSED' },
      ],
    })
    expect(JSON.stringify(viewed.decisions)).not.toContain(lesson)
    expect(JSON.stringify(viewed.decisions)).not.toContain('An Nguyen')
    expect(JSON.stringify(viewed.decisions)).not.toContain('What are lists?')
  })

  it('shows the newest hundred decisions first', async () => {
    const decisions = createMemoryDecisionLogStore()
    for (let index = 0; index < 101; index += 1) {
      await decisions.append(loggedDecision({
        time: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        turnId: `turn-${index}`,
      }))
    }

    const viewed = await handleAdmin(ownerRequest({ decisions }))

    expect(viewed.decisions).toHaveLength(100)
    expect(viewed.decisions[0]?.turnId).toBe('turn-100')
    expect(viewed.decisions[99]?.turnId).toBe('turn-1')
    expect(viewed.decisions.map(decision => decision.turnId)).not.toContain('turn-0')
  })

  it('reads a decision recorded before rule checks with its rule checks absent', async () => {
    const decisions = createMemoryDecisionLogStore()
    await decisions.append(loggedDecision({ turnId: 'older' }))
    await decisions.append(loggedDecision({ turnId: 'off', time: '2026-01-02T00:00:00.000Z', verifyShieldOn: false, ruleChecks: [] }))

    const viewed = await handleAdmin(ownerRequest({ decisions }))

    expect(viewed.decisions.find(decision => decision.turnId === 'older')).not.toHaveProperty('ruleChecks')
    expect(viewed.decisions.find(decision => decision.turnId === 'off')?.ruleChecks).toEqual([])
  })

  it('reads back the addressed agent of each decision', async () => {
    const decisions = createMemoryDecisionLogStore()
    await decisions.append(loggedDecision({ turnId: 'to-mai', agent: 'deskmate', addressedAgent: 'deskmate' }))
    await decisions.append(loggedDecision({ turnId: 'to-nobody', time: '2026-01-02T00:00:00.000Z', addressedAgent: null }))

    const viewed = await handleAdmin(ownerRequest({ decisions }))

    expect(viewed.decisions.find(decision => decision.turnId === 'to-mai')?.addressedAgent).toBe('deskmate')
    expect(viewed.decisions.find(decision => decision.turnId === 'to-nobody')?.addressedAgent).toBeNull()
  })

  it('filters decisions by verdict and by student', async () => {
    const decisions = createMemoryDecisionLogStore()
    const otherStudent = '6f1b0c1e-2222-4222-8222-222222222222'
    await decisions.append(loggedDecision({
      turnId: 'an-allow',
      verdict: 'allow',
      time: '2026-01-01T00:00:01.000Z',
    }))
    await decisions.append(loggedDecision({
      turnId: 'an-block',
      verdict: 'block',
      ruledMove: null,
      ruledScope: null,
      reasonCode: 'ROLE_FORBIDDEN',
      time: '2026-01-01T00:00:02.000Z',
    }))
    await decisions.append(loggedDecision({
      turnId: 'other-block',
      studentId: otherStudent,
      verdict: 'block',
      ruledMove: null,
      ruledScope: null,
      reasonCode: 'ROLE_FORBIDDEN',
      time: '2026-01-01T00:00:03.000Z',
    }))
    await decisions.append(loggedDecision({
      turnId: 'an-downgrade',
      verdict: 'downgrade',
      time: '2026-01-01T00:00:04.000Z',
    }))
    for (let index = 0; index < 100; index += 1) {
      await decisions.append(loggedDecision({
        turnId: `later-allow-${index}`,
        verdict: 'allow',
        time: new Date(Date.UTC(2026, 0, 2, 0, 0, index)).toISOString(),
      }))
    }

    const byVerdict = await handleAdmin(ownerRequest({
      decisions,
      body: { event: 'read', verdict: 'block' },
    }))
    const byStudent = await handleAdmin(ownerRequest({
      decisions,
      body: { event: 'read', studentId: signedInStudent, verdict: '' },
    }))
    const byBoth = await handleAdmin(ownerRequest({
      decisions,
      body: { event: 'read', verdict: 'block', studentId: otherStudent },
    }))

    expect(byVerdict.decisions.map(decision => decision.turnId)).toEqual(['other-block', 'an-block'])
    expect(byStudent.decisions.map(decision => decision.turnId)).not.toContain('other-block')
    expect(byStudent.decisions).toHaveLength(100)
    expect(byStudent.decisions[0]?.turnId).toBe('later-allow-99')
    expect(byBoth.decisions.map(decision => decision.turnId)).toEqual(['other-block'])
  })

  it('switches the VerifyShield off and the next turn allows the proposed move', async () => {
    const verifyShieldStore = createMemoryVerifyShieldStore()
    const decisions = createMemoryDecisionLogStore()
    const answer = 'A list keeps items in order.'

    const before = await handleAdmin(ownerRequest({
      decisions,
      verifyShield: verifyShieldStore,
      verifyShieldEnv: 'on',
    }))
    expect(before.verifyShieldOn).toBe(true)

    const switched = await handleAdmin(ownerRequest({
      decisions,
      verifyShield: verifyShieldStore,
      verifyShieldEnv: 'on',
      body: { event: 'verifyShield', enabled: false },
    }))
    expect(switched.verifyShieldOn).toBe(false)

    await expect(handleAdmin(ownerRequest({
      email: 'an@example.com',
      verifyShield: verifyShieldStore,
      body: { event: 'verifyShield', enabled: true },
    }))).rejects.toMatchObject({ statusCode: 403 })
    expect(await verifyShieldStore.read()).toBe(false)

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'What are lists?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An Nguyen',
    }), createFakeAgents({
      proposal: { type: 'explain_concept', scope: 'lists_and_tuples' },
      text: answer,
    }), {
      verifyShieldOn: await verifyShieldForTurn(verifyShieldStore, 'on'),
      decisions,
    })

    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe(answer)
    const viewed = await handleAdmin(ownerRequest({
      decisions,
      verifyShield: verifyShieldStore,
      verifyShieldEnv: 'on',
    }))
    expect(viewed.verifyShieldOn).toBe(false)
    expect(viewed.decisions).toHaveLength(1)
    expect(viewed.decisions[0]).toMatchObject({
      verdict: 'allow',
      ruleId: 'verify_shield',
      reasonCode: 'VERIFYSHIELD_OFF',
      verifyShieldOn: false,
      proposedScope: 'lists_and_tuples',
    })
    expect(JSON.stringify(viewed.decisions)).not.toContain(answer)
    expect(JSON.stringify(viewed.decisions)).not.toContain('An Nguyen')
  })

  it('refuses a student the decision log', async () => {
    const decisions = createMemoryDecisionLogStore()
    await decisions.append(loggedDecision({ turnId: 'kept' }))

    await expect(handleAdmin(ownerRequest({
      email: 'an@example.com',
      decisions,
      body: { event: 'read', verdict: 'allow', studentId: signedInStudent },
    }))).rejects.toMatchObject({ statusCode: 403 })

    const viewed = await handleAdmin(ownerRequest({ decisions }))
    expect(viewed.decisions.map(decision => decision.turnId)).toEqual(['kept'])
  })

  it('does not log a turn that has no agent proposal', async () => {
    const decisions = createMemoryDecisionLogStore()
    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An Nguyen',
    }), undefined, { decisions })

    const viewed = await handleAdmin(ownerRequest({ decisions }))
    expect(viewed.decisions).toEqual([])
  })

  it('does not log the code from a submission', async () => {
    const decisions = createMemoryDecisionLogStore()
    await handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'submission',
        code: 'print("STUDENT_CODE_SHOULD_NOT_BE_LOGGED")\n',
        results: [{ name: 'adds the numbers', passed: false, expected: '6', actual: '0' }],
      },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An Nguyen',
    }), createFakeAgents({
      proposal: { type: 'explain_concept', scope: 'getting_started' },
      text: 'Look at where the total is created.',
    }), { decisions })

    const viewed = await handleAdmin(ownerRequest({ decisions }))
    expect(viewed.decisions).toHaveLength(1)
    expect(JSON.stringify(viewed.decisions)).not.toContain('STUDENT_CODE_SHOULD_NOT_BE_LOGGED')
    expect(JSON.stringify(viewed.decisions)).not.toContain('An Nguyen')
  })

  it('logs the opening proposal and the introduction that is spoken', async () => {
    const decisions = createMemoryDecisionLogStore()
    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An Nguyen',
    }), createFakeAgents({
      proposal: { type: 'stay_and_practise' },
      text: 'A running total survives every pass of the loop.',
    }), { decisions })

    const viewed = await handleAdmin(ownerRequest({ decisions }))

    expect(viewed.decisions.map(decision => decision.turnId)).toEqual([
      viewed.decisions[0]?.turnId,
      viewed.decisions[0]?.turnId,
    ])
    expect(viewed.decisions.map(decision => ({
      agent: decision.agent,
      proposedMove: decision.proposedMove,
      verdict: decision.verdict,
      ruledMove: decision.ruledMove,
    }))).toEqual([
      { agent: 'teacher', proposedMove: 'explain_concept', verdict: 'allow', ruledMove: 'explain_concept' },
      { agent: 'teacher', proposedMove: 'stay_and_practise', verdict: 'allow', ruledMove: 'stay_and_practise' },
    ])
    expect(JSON.stringify(viewed.decisions)).not.toContain('An Nguyen')
  })
})

const decisionFields = [
  'addressedAgent',
  'agent',
  'masteries',
  'masteryThreshold',
  'proposedMove',
  'proposedScope',
  'reasonCode',
  'ruleChecks',
  'ruleId',
  'ruledMove',
  'ruledScope',
  'studentId',
  'time',
  'turnId',
  'unlockedModuleIds',
  'verdict',
  'verifyShieldOn',
]

function loggedDecision(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    time: '2026-01-01T00:00:00.000Z',
    studentId: signedInStudent,
    turnId: 'turn-0',
    agent: 'teacher',
    proposedMove: 'explain_concept',
    proposedScope: 'loops',
    verdict: 'allow',
    ruledMove: 'explain_concept',
    ruledScope: 'loops',
    ruleId: 'role_table',
    reasonCode: 'ROLE_PERMITTED',
    masteries: priorMasteries,
    unlockedModuleIds: ['getting_started', 'variables', 'strings', 'conditionals', 'loops'],
    verifyShieldOn: true,
    masteryThreshold: 0.9,
    ...overrides,
  }
}

// Every module sits at the Bayesian Knowledge Tracing prior until a submission
// gives the estimate something to read.
const priorMasteries = [
  { moduleId: 'getting_started', mastery: 0.1 },
  { moduleId: 'variables', mastery: 0.1 },
  { moduleId: 'strings', mastery: 0.1 },
  { moduleId: 'conditionals', mastery: 0.1 },
  { moduleId: 'loops', mastery: 0.1 },
  { moduleId: 'lists_and_tuples', mastery: 0.1 },
  { moduleId: 'dictionaries_and_sets', mastery: 0.1 },
  { moduleId: 'functions', mastery: 0.1 },
  { moduleId: 'modules_and_library', mastery: 0.1 },
  { moduleId: 'file_handling', mastery: 0.1 },
  { moduleId: 'error_handling', mastery: 0.1 },
]

function sse(text: string): Response {
  const chunks = [
    { choices: [{ delta: { content: text }, finish_reason: null }] },
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
  ]
  const payload = chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(payload, {
    headers: { 'content-type': 'text/event-stream' },
  })
}
