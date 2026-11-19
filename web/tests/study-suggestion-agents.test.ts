import { describe, expect, it } from 'vitest'
import { createAgents, createFakeAgents } from '../server/agents'
import type { LanguageModel, ProposalSchema } from '../server/language-model'
import { createMemoryActivityLog } from '../server/activity-recorder'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryStudySuggestionStore } from '../server/storage/study-suggestion-store'
import { createMemoryEvidenceStore, createMemoryUnlockStore } from '../server/student-model'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-4444-4444-8444-444444444444'
const sentence = 'Submit Say hello so it can be checked.'

async function threeRunsWithoutSubmitting() {
  const activity = createMemoryActivityLog()
  for (let run = 0; run < 3; run += 1) {
    await activity.record({ studentId: student, courseId: 'intro_python', type: 'code_run', payload: { exerciseId: 'say_hello' } })
  }
  return {
    activity,
    studySuggestions: createMemoryStudySuggestionStore(),
    unlocks: createMemoryUnlockStore(),
    evidence: createMemoryEvidenceStore(),
  }
}

function recordingModel() {
  const calls: { agent: 'teacher' | 'deskmate', prompt: string, instructions: string }[] = []
  const agentOf = (instructions: string) => instructions.includes('You are the Teacher') ? 'teacher' : 'deskmate'
  const propose = async <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>) => {
    const agent = agentOf(instructions)
    calls.push({ agent, prompt, instructions })
    return schema.parse({
      proposal: agent === 'teacher' ? { type: 'explain_concept', scope: 'getting_started' } : { type: 'peer_question' },
    }).proposal
  }
  const languageModel: LanguageModel = {
    proposeMove: propose,
    proposeWithTools: async (instructions, prompt, schema) => ({ proposal: await propose(instructions, prompt, schema), ended: 'proposed' as const }),
    async* streamReply(instructions, prompt) {
      calls.push({ agent: agentOf(instructions), prompt, instructions })
      yield 'A reply.'
    },
    async reply(instructions, prompt) {
      calls.push({ agent: agentOf(instructions), prompt, instructions })
      return 'A reply.'
    },
  }
  return { agents: createAgents(languageModel), calls }
}

const conversation = () => createMemoryConversationStore({ [student]: 'An' })
const message = { event: 'message', text: 'What next?' }

describe('the study suggestion and the agents', () => {
  it('puts the step in the Teacher\'s prompts and not in Mai\'s', async () => {
    const options = await threeRunsWithoutSubmitting()
    const { agents, calls } = recordingModel()

    await handleTurn({ sessionStudentId: student, body: message }, conversation(), agents, options)

    const teacher = calls.filter(call => call.agent === 'teacher')
    const deskmate = calls.filter(call => call.agent === 'deskmate')
    expect(teacher.length).toBeGreaterThan(0)
    for (const call of teacher) expect(call.prompt).toContain(sentence)
    expect(teacher[0]!.instructions).toMatch(/do not advise the opposite/i)
    expect(deskmate.length).toBeGreaterThan(0)
    for (const call of deskmate) expect(call.prompt).not.toContain(sentence)
  })

  it('leaves the Mai context without a study suggestion', async () => {
    const options = await threeRunsWithoutSubmitting()
    const agents = createFakeAgents({ proposal: null }, { proposal: { type: 'peer_question' } })

    await handleTurn({ sessionStudentId: student, body: message }, conversation(), agents, options)

    const deskmate = agents.exchanges.find(exchange => exchange.agent === 'deskmate')!
    expect(JSON.stringify(deskmate.context)).not.toContain(sentence)
    expect(Object.keys(deskmate.context)).not.toContain('studySuggestion')
  })

  it('keeps the step in the Teacher\'s prompt after the student dismisses the dialog', async () => {
    const options = await threeRunsWithoutSubmitting()
    const shown = (await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation(), undefined, options)).studySuggestion!
    const store = conversation()
    await handleTurn({ sessionStudentId: student, body: { event: 'dismiss_study_suggestion', key: shown.key } }, store, undefined, options)
    const { agents, calls } = recordingModel()

    const state = await handleTurn({ sessionStudentId: student, body: message }, store, agents, options)

    expect(state.studySuggestion).toBeNull()
    expect(calls.find(call => call.agent === 'teacher')!.prompt).toContain(sentence)
  })

  it('gives the Teacher no study suggestion when the rules choose none', async () => {
    const agents = createFakeAgents({ proposal: null })

    await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation(), agents, { activity: createMemoryActivityLog() })

    const teacher = agents.exchanges.find(exchange => exchange.agent === 'teacher')!
    expect(teacher.context).toMatchObject({ studySuggestion: null })
  })

  describe('the VerifyShield', () => {
    async function advance(moduleId: string, options: Omit<Awaited<ReturnType<typeof threeRunsWithoutSubmitting>>, 'activity'> & { activity?: Awaited<ReturnType<typeof threeRunsWithoutSubmitting>>['activity'] }) {
      await options.unlocks.record(student, ['variables'])
      const agents = createFakeAgents({ proposal: { type: 'advance_to_module', moduleId }, text: 'Maybe.' })
      return handleTurn({ sessionStudentId: student, body: message }, conversation(), agents, options)
    }

    it('downgrades an advance to another module while the step keeps the student on this one', async () => {
      const state = await advance('variables', await threeRunsWithoutSubmitting())

      expect(state.trace?.agents[0].verdict).toMatchObject({ decision: 'downgrade', ruleId: 'advance_follows_study_step' })
    })

    it('rules an advance as it always did when the rules choose no step', async () => {
      const { activity: _activity, ...options } = await threeRunsWithoutSubmitting()

      // Variables is unlocked, so the student opens on it and Getting Started is the other module.
      const state = await advance('getting_started', options)

      expect(state.trace?.agents[0].verdict).toMatchObject({ decision: 'allow' })
    })

    it('lets the advance stand when it names the module the step already names', async () => {
      const options = await threeRunsWithoutSubmitting()
      await options.unlocks.record(student, ['variables'])
      // Opened and left again: the step sends the student back to Getting Started, the module they left.
      const activity = createMemoryActivityLog()
      const log = (type: 'module_opened' | 'mode_switched', payload: Record<string, unknown>) =>
        activity.record({ studentId: student, courseId: 'intro_python', type, payload })
      await log('module_opened', { moduleId: 'getting_started' })
      await log('mode_switched', { mode: 'practice', moduleId: 'getting_started' })
      await log('module_opened', { moduleId: 'variables' })
      await log('mode_switched', { mode: 'practice', moduleId: 'variables' })
      await activity.record({ studentId: student, courseId: 'intro_python', type: 'code_run', payload: { exerciseId: 'total_cost' } })
      const store = createMemoryConversationStore({ [student]: 'An' })
      // The student is on Variables; the step names Getting Started.
      await store.saveResumePoint(student, { moduleId: 'variables', exerciseId: 'total_cost' })

      const toStep = await handleTurn(
        { sessionStudentId: student, body: message },
        store,
        createFakeAgents({ proposal: { type: 'advance_to_module', moduleId: 'getting_started' }, text: 'Go back.' }),
        { ...options, activity },
      )
      const elsewhere = await handleTurn(
        { sessionStudentId: student, body: message },
        store,
        createFakeAgents({ proposal: { type: 'advance_to_module', moduleId: 'loops' }, text: 'Go on.' }),
        { ...options, activity },
      )

      expect(toStep.trace?.agents[0].verdict).toMatchObject({ decision: 'allow' })
      expect(elsewhere.trace?.agents[0].verdict?.decision).not.toBe('allow')
    })
  })
})
