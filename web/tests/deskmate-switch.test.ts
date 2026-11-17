import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { createMemoryDeskmateSettingStore } from '../server/storage/deskmate-setting-store'
import { handleTurn } from '../server/turn/handle-turn'

const an = '6f1b0c1e-1111-4111-8111-111111111111'
const binh = '6f1b0c1e-2222-4222-8222-222222222222'

function memoryStore() {
  return createMemoryConversationStore({ [an]: 'An', [binh]: 'Bình' })
}

function bothAgents() {
  return createFakeAgents(
    { proposal: { type: 'explain_concept', scope: 'getting_started' }, text: 'Teacher says hi.' },
    { proposal: { type: 'peer_question' }, text: 'Mai wonders.' },
  )
}

describe('deskmate switch', () => {
  it('is on by default and reported by the opened workspace', async () => {
    const state = await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, memoryStore(), undefined, {
      deskmateSettings: createMemoryDeskmateSettingStore(),
    })
    expect(state.deskmateOn).toBe(true)
  })

  it('persists for the session student only, whatever student the body names', async () => {
    const settings = createMemoryDeskmateSettingStore()
    const store = memoryStore()
    const switched = await handleTurn({
      sessionStudentId: an,
      body: { event: 'deskmate_switch', on: false, studentId: binh },
    }, store, undefined, { deskmateSettings: settings })
    expect(switched.deskmateOn).toBe(false)

    const again = await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, store, undefined, { deskmateSettings: settings })
    expect(again.deskmateOn).toBe(false)
    const other = await handleTurn({ sessionStudentId: binh, body: { event: 'open' } }, store, undefined, { deskmateSettings: settings })
    expect(other.deskmateOn).toBe(true)
  })

  it('never calls Mai while off, records no deskmate decision, and keeps her earlier messages', async () => {
    const settings = createMemoryDeskmateSettingStore()
    const store = memoryStore()
    const decisions = createMemoryDecisionLogStore()
    const options = { deskmateSettings: settings, decisions }
    await handleTurn({ sessionStudentId: an, body: { event: 'message', text: 'First?' } }, store, bothAgents(), options)
    await handleTurn({ sessionStudentId: an, body: { event: 'deskmate_switch', on: false } }, store, undefined, options)

    const agents = bothAgents()
    const state = await handleTurn({ sessionStudentId: an, body: { event: 'message', text: 'Second?' } }, store, agents, options)

    expect(agents.exchanges.map(exchange => exchange.agent)).not.toContain('deskmate')
    const logged = await decisions.list()
    const secondTurn = logged.filter(record => record.turnId === logged[0]!.turnId)
    expect(secondTurn.map(record => record.agent)).toEqual(['teacher'])
    expect(state.conversation.map(message => message.author)).toEqual(['student', 'teacher', 'deskmate', 'student', 'teacher'])
  })
})

describe('addressed agent', () => {
  it('lets only the Teacher answer a message addressed to the Teacher, and stores the tag apart from the text', async () => {
    const store = memoryStore()
    const decisions = createMemoryDecisionLogStore()
    const agents = bothAgents()
    const state = await handleTurn({
      sessionStudentId: an,
      body: { event: 'message', text: 'Why?', addressedAgent: 'teacher' },
    }, store, agents, { decisions })

    expect(agents.exchanges.map(exchange => exchange.agent)).not.toContain('deskmate')
    expect(state.conversation.map(message => message.author)).toEqual(['student', 'teacher'])
    expect(state.conversation[0]).toMatchObject({ text: 'Why?', addressedAgent: 'teacher' })
    expect(await decisions.list()).toEqual([expect.objectContaining({ agent: 'teacher', addressedAgent: 'teacher' })])

    const reopened = await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, store)
    expect(reopened.conversation[0]).toMatchObject({ addressedAgent: 'teacher' })
  })

  it('still redirects a closed-module move addressed to the Teacher', async () => {
    const agents = createFakeAgents({ proposal: { type: 'explain_concept', scope: 'lists_and_tuples' }, text: 'LISTS' })
    const decisions = createMemoryDecisionLogStore()
    const state = await handleTurn({
      sessionStudentId: an,
      body: { event: 'message', text: 'What are lists?', addressedAgent: 'teacher' },
    }, memoryStore(), agents, { decisions })

    expect(state.conversation[1]).toMatchObject({ author: 'teacher', approvedMove: 'redirect_to_module' })
    expect(await decisions.list()).toEqual([expect.objectContaining({ verdict: 'downgrade', addressedAgent: 'teacher' })])
  })

  it('lets only Mai answer a message addressed to her, still bound by the role table', async () => {
    const decisions = createMemoryDecisionLogStore()
    const asking = bothAgents()
    const state = await handleTurn({
      sessionStudentId: an,
      body: { event: 'message', text: 'Mai?', addressedAgent: 'deskmate' },
    }, memoryStore(), asking, { decisions })
    expect(asking.exchanges.map(exchange => exchange.agent)).not.toContain('teacher')
    expect(state.conversation.map(message => message.author)).toEqual(['student', 'deskmate'])
    expect(await decisions.list()).toEqual([expect.objectContaining({ agent: 'deskmate', addressedAgent: 'deskmate' })])

    const hinting = createFakeAgents(
      { proposal: { type: 'explain_concept', scope: 'getting_started' }, text: 'TEACHER' },
      { proposal: { type: 'hint_level_N', level: 1, scope: 'getting_started' }, text: 'HINT' },
    )
    const blocked = await handleTurn({
      sessionStudentId: an,
      body: { event: 'message', text: 'Hint?', addressedAgent: 'deskmate' },
    }, memoryStore(), hinting, { decisions: createMemoryDecisionLogStore() })
    expect(blocked.conversation.map(message => message.author)).toEqual(['student'])
    expect(JSON.stringify(blocked)).not.toContain('HINT')
  })

  it('records a null addressed agent when no agent is addressed, and both answer', async () => {
    const decisions = createMemoryDecisionLogStore()
    const state = await handleTurn({ sessionStudentId: an, body: { event: 'message', text: 'Hi' } }, memoryStore(), bothAgents(), { decisions })
    expect(state.conversation.map(message => message.author)).toEqual(['student', 'teacher', 'deskmate'])
    expect((await decisions.list()).map(record => record.addressedAgent)).toEqual([null, null])
  })

  it('treats a message to Mai as unaddressed while she is switched off, with a note', async () => {
    const settings = createMemoryDeskmateSettingStore()
    const store = memoryStore()
    const decisions = createMemoryDecisionLogStore()
    await handleTurn({ sessionStudentId: an, body: { event: 'deskmate_switch', on: false } }, store, undefined, { deskmateSettings: settings })
    const agents = bothAgents()
    const state = await handleTurn({
      sessionStudentId: an,
      body: { event: 'message', text: 'Mai?', addressedAgent: 'deskmate' },
    }, store, agents, { deskmateSettings: settings, decisions })

    expect(agents.exchanges.map(exchange => exchange.agent)).not.toContain('deskmate')
    expect(state.conversation.map(message => message.author)).toEqual(['student', 'teacher'])
    expect(state.notice).toBe('Mai is switched off.')
    expect(await decisions.list()).toEqual([expect.objectContaining({ agent: 'teacher', addressedAgent: null })])
  })
})
