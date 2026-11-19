import { describe, expect, it } from 'vitest'
import { createAgents, createFakeAgents } from '../server/agents'
import type { LanguageModel, ProposalSchema } from '../server/language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemorySubmissionStore } from '../server/storage/submission-store'
import { createFakeSandbox } from '../server/sandbox'
import { createMemoryEvidenceStore } from '../server/student-model'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-1111-4111-8111-111111111111'
const misquoted = 'def hello(name):\n    return Hello, name\n'
const correct = 'def hello(name):\n    return "Hello, " + name\n'
const results = [
  { name: 'greeting for An', passed: false, expected: 'Hello, An', actual: '' },
  { name: 'greeting for Mai', passed: false, expected: 'Hello, Mai', actual: '' },
  { name: 'greeting for world', passed: false, expected: 'Hello, world', actual: '' },
]

function store() {
  return createMemoryConversationStore({ [student]: 'An' })
}

function claimingTeacher() {
  return createFakeAgents({
    proposal: { type: 'address_misconception', misconceptionId: 'missing_quotes', scope: 'getting_started' },
    text: 'The words need quotes around them.',
  })
}

function submit(code: string, submissions = createMemorySubmissionStore(), conversation = store()) {
  return handleTurn({
    sessionStudentId: student,
    body: { event: 'submission', code, results },
  }, conversation, claimingTeacher(), {
    evidence: createMemoryEvidenceStore(),
    submissions,
    sandbox: createFakeSandbox({ outcome: 'checked', results }),
  })
}

function message(conversation = store(), options: Parameters<typeof handleTurn>[3] = {}) {
  return handleTurn({
    sessionStudentId: student,
    body: { event: 'message', text: 'Why does print(Hello) fail?' },
  }, conversation, claimingTeacher(), options)
}

describe('a misconception claim', () => {
  it('stands when the submitted code shows it', async () => {
    const state = await submit(misquoted)

    expect(state.trace?.agents[0]).toMatchObject({
      agent: 'teacher',
      proposal: 'address_misconception:missing_quotes',
      verdict: { decision: 'allow', reasonCode: 'ROLE_PERMITTED' },
    })
    expect(state.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      approvedMove: 'address_misconception:missing_quotes',
      text: 'The words need quotes around them.',
    })
  })

  it('stands on a later message, from the finding kept with the submission', async () => {
    const conversation = store()
    const submissions = createMemorySubmissionStore()
    await submit(misquoted, submissions, conversation)

    const state = await message(conversation, { evidence: createMemoryEvidenceStore(), submissions })

    expect(state.trace?.agents[0]).toMatchObject({
      verdict: { decision: 'allow' },
    })
    expect(state.conversation.at(-1)?.approvedMove).toBe('address_misconception:missing_quotes')
  })

  it('stands when a quiz answer shows it', async () => {
    const state = await handleTurn({
      sessionStudentId: student,
      body: { event: 'quiz_answer', moduleId: 'getting_started', questionId: 'print-text', choice: 0 },
    }, store(), claimingTeacher())

    expect(state.trace?.agents[0]).toMatchObject({
      verdict: { decision: 'allow' },
    })
    expect(state.conversation.at(-1)?.approvedMove).toBe('address_misconception:missing_quotes')
  })

  it('becomes an ordinary answer when the work shows no such misconception', async () => {
    const state = await message()

    expect(state.trace?.agents[0]).toMatchObject({
      agent: 'teacher',
      proposal: 'address_misconception:missing_quotes',
      verdict: {
        decision: 'downgrade',
        ruleId: 'misconception_shown',
        reasonCode: 'MISCONCEPTION_NOT_SHOWN',
      },
    })
    expect(state.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      approvedMove: 'answer_question',
      text: 'The words need quotes around them.',
    })
  })

  it('becomes an ordinary answer when the correct code shows no finding', async () => {
    const conversation = store()
    const submissions = createMemorySubmissionStore()
    await submit(correct, submissions, conversation)

    const state = await message(conversation, { evidence: createMemoryEvidenceStore(), submissions })

    expect(state.trace?.agents[0]).toMatchObject({
      verdict: { decision: 'downgrade', reasonCode: 'MISCONCEPTION_NOT_SHOWN' },
    })
  })

  it('stands with the VerifyShield off, as the shield rules on no claim', async () => {
    const state = await message(store(), { verifyShieldOn: false })

    expect(state.trace?.agents[0]).toMatchObject({
      verdict: { decision: 'allow' },
    })
    expect(state.conversation.at(-1)?.approvedMove).toBe('address_misconception:missing_quotes')
  })

  it('is named to the Teacher with the work that shows it', async () => {
    const prompts: string[] = []
    const model: LanguageModel = {
      proposeMove: async () => null,
      proposeWithTools: async <Proposal>(_instructions: string, prompt: string, schema: ProposalSchema<Proposal>) => {
        prompts.push(prompt)
        return {
          proposal: schema.parse({ proposal: { type: 'answer_question', scope: 'getting_started' } }).proposal,
          ended: 'proposed' as const,
        }
      },
      async* streamReply() {
        yield 'A reply.'
      },
      async reply() {
        return 'A reply.'
      },
    }

    await handleTurn({
      sessionStudentId: student,
      body: { event: 'submission', code: misquoted, results },
    }, store(), createAgents(model), {
      evidence: createMemoryEvidenceStore(),
      sandbox: createFakeSandbox({ outcome: 'checked', results }),
    })

    expect(prompts[0]).toContain('Misconceptions the student\'s work shows\nmissing_quotes')
  })
})
