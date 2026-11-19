import { describe, expect, it } from 'vitest'
import { createAgents, createFakeAgents } from '../server/agents'
import type { LanguageModel, ProposalSchema } from '../server/language-model'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { createMemoryEvidenceStore } from '../server/student-model'
import { createFakeSandbox } from '../server/sandbox'
import { handleTurn } from '../server/turn/handle-turn'
import { createMemoryActivityLog } from '../server/activity-recorder'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemorySubmissionStore } from '../server/storage/submission-store'

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

function teacher() {
  return createFakeAgents({
    proposal: { type: 'answer_question', scope: 'getting_started' },
    text: 'A plain answer.',
  })
}

function submit(code: string, conversation = store(), options: Parameters<typeof handleTurn>[3] = {}) {
  return handleTurn({
    sessionStudentId: student,
    body: { event: 'submission', code, results },
  }, conversation, teacher(), {
    evidence: createMemoryEvidenceStore(),
    sandbox: createFakeSandbox({ outcome: 'checked', results }),
    submissions: createMemorySubmissionStore(),
    ...options,
  })
}

describe('the learning pattern in the turn', () => {
  it('shows the student their weak spots in plain words', async () => {
    const state = await submit(misquoted)

    expect(state.weakSpots).toEqual([
      'The words are missing their quotes, so Python looks for a variable instead of using the text. Put the text between quotes.',
    ])
  })

  it('shows no weak spots when the work shows none', async () => {
    const state = await submit(correct)

    expect(state.weakSpots).toEqual([])
  })

  it('leaves mastery to the evidence, whatever the pattern found', async () => {
    const withFinding = await submit(misquoted)
    const withoutFinding = await submit(correct)

    expect(withoutFinding.courseRoadmap[0]?.mastery).toBe(withFinding.courseRoadmap[0]?.mastery)
  })

  it('records the pattern and the module on each decision the turn made', async () => {
    const decisions = createMemoryDecisionLogStore()

    await submit(misquoted, store(), { decisions })

    const recorded = await decisions.list({ studentId: student })
    expect(recorded).not.toEqual([])
    for (const decision of recorded) {
      expect(decision.moduleId).toBe('getting_started')
      expect(decision.learningPattern?.weakSpots).toEqual([
        { misconceptionId: 'missing_quotes', count: 1, lastSeen: expect.any(String) },
      ])
    }
  })

  it('reads the time on materials and the rung climbed into the pattern', async () => {
    let now = new Date('2026-11-19T10:00:00Z')
    const activity = createMemoryActivityLog(() => now)
    const decisions = createMemoryDecisionLogStore()
    await activity.record({
      studentId: student,
      courseId: 'intro_python',
      type: 'module_opened',
      payload: { moduleId: 'getting_started' },
    })
    now = new Date('2026-11-19T10:10:00Z')
    await activity.record({
      studentId: student,
      courseId: 'intro_python',
      type: 'mode_switched',
      payload: { mode: 'practice' },
    })
    const conversation = store()
    const agents = createFakeAgents({
      proposal: { type: 'hint_level_N', level: 1, scope: 'getting_started' },
      text: 'Look at the line before the loop.',
    })
    const hintTurn = () => handleTurn({
      sessionStudentId: student,
      body: { event: 'message', text: 'Give me the first hint.' },
    }, conversation, agents, { activity, decisions })
    // The first turn's snapshot is the pattern the Teacher saw: no rung yet.
    // The second turn reads the first turn's decision back into the pattern.
    await hintTurn()
    await hintTurn()

    const [decision] = await decisions.list({ studentId: student })
    expect(decision?.learningPattern?.hintRungs).toEqual([
      { moduleId: 'getting_started', rungs: [1] },
    ])
    expect(decision?.learningPattern?.materialsSeconds).toEqual([
      { moduleId: 'getting_started', seconds: 600 },
    ])
  })

  it('names the pattern to the Teacher in the propose prompt', async () => {
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

    const submissions = createMemorySubmissionStore()
    const conversation = store()
    await submit(misquoted, conversation, { submissions })
    await handleTurn({
      sessionStudentId: student,
      body: { event: 'message', text: 'Why does print(Hello) fail?' },
    }, conversation, createAgents(model), {
      evidence: createMemoryEvidenceStore(),
      submissions,
    })

    expect(prompts[0]).toContain('Learning pattern')
    expect(prompts[0]).toContain('missing_quotes')
  })

  it('never names the pattern to Mai', async () => {
    const prompts: string[] = []
    const model: LanguageModel = {
      proposeMove: async (_instructions: string, prompt: string) => {
        prompts.push(prompt)
        return { type: 'peer_question' }
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
      body: { event: 'message', text: 'Mai, what do you think?', addressedAgent: 'deskmate' },
    }, store(), createAgents(model), {})

    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain('Learning pattern')
  })
})
