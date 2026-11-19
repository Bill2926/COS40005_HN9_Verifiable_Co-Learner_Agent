import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { createMemoryEvidenceStore } from '../server/student-model'
import { createFakeSandbox } from '../server/sandbox'
import { handleTurn } from '../server/turn/handle-turn'
import { createMemoryActivityLog } from '../server/activity-recorder'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemorySubmissionStore } from '../server/storage/submission-store'

const student = '6f1b0c1e-1111-4111-8111-111111111111'
const misquoted = 'def hello(name):\n    return Hello, name\n'
const correct = 'def hello(name):\n    return "Hello, " + name\n'
const failing = [
  { name: 'greeting for An', passed: false, expected: 'Hello, An', actual: '' },
  { name: 'greeting for Mai', passed: false, expected: 'Hello, Mai', actual: '' },
  { name: 'greeting for world', passed: false, expected: 'Hello, world', actual: '' },
]
const passing = failing.map(result => ({ ...result, passed: true, actual: result.expected }))

function agents() {
  return createFakeAgents({
    proposal: { type: 'answer_question', scope: 'getting_started' },
    text: 'A plain answer.',
  })
}

// One student working through several submissions in the same course.
function session() {
  const conversation = createMemoryConversationStore({ [student]: 'An' })
  const options = {
    evidence: createMemoryEvidenceStore(),
    submissions: createMemorySubmissionStore(),
    activity: createMemoryActivityLog(),
  }
  return {
    submit: (code: string, results: typeof failing) => handleTurn({
      sessionStudentId: student,
      body: { event: 'submission', code, results },
    }, conversation, agents(), { ...options, sandbox: createFakeSandbox({ outcome: 'checked', results }) }),
    open: () => handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation, agents(), options),
  }
}

describe('the progress panel in the turn', () => {
  it('shows no completed exercise before anything is passed', async () => {
    const { submit } = session()

    const state = await submit(misquoted, failing)

    expect(state.progress.completedExercises).toEqual([])
  })

  it('shows a passed exercise with the attempts it took, counting the failures before the pass', async () => {
    const { submit } = session()
    await submit(misquoted, failing)
    await submit(misquoted, failing)

    const state = await submit(correct, passing)

    expect(state.progress.completedExercises).toEqual([
      expect.objectContaining({ moduleId: 'getting_started', exerciseId: 'say_hello', attempts: 3 }),
    ])
    expect(state.progress.completedExercises[0]?.moduleName).toEqual(expect.any(String))
    expect(state.progress.completedExercises[0]?.title).toEqual(expect.any(String))
  })

  it('keeps the figures after a reload', async () => {
    const { submit, open } = session()
    await submit(correct, passing)

    const state = await open()

    expect(state.progress.completedExercises.map(item => [item.exerciseId, item.attempts])).toEqual([['say_hello', 1]])
  })

  it('carries nothing of the review signals or the raw activity', async () => {
    const { submit } = session()

    const state = await submit(correct, passing)

    expect(JSON.stringify(state.progress)).not.toMatch(/signal|activity|pasted|went_idle/i)
    expect(Object.keys(state.progress)).toEqual(['completedExercises'])
  })
})
