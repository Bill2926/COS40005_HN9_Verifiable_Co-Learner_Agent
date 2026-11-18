import { describe, expect, it } from 'vitest'
import { createAgents } from '../server/agents'
import { pythonCourse } from '../server/course'
import { createFakeLanguageModel, type FakeLanguageModelScript } from '../server/language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { createMemoryQuizAnswerStore } from '../server/storage/quiz-answer-store'
import { createMemoryEvidenceStore, createMemoryMasteryStore, createMemoryUnlockStore } from '../server/student-model'
import { handleTurn, type TurnOptions } from '../server/turn/handle-turn'

// The Teacher looks mastery up with the get_student_mastery tool rather than reading it in its
// prompt. These turns run the real agents on the fake language model, scripted to call the tool.
const student = '6f1b0c1e-1111-4111-8111-111111111111'
const lookUp = { toolCalls: [{ name: 'get_student_mastery', input: {} }] }
const explain = { proposal: { type: 'explain_concept', scope: 'getting_started' } }

async function turn(script: FakeLanguageModelScript) {
  const model = createFakeLanguageModel(script)
  const mastery = createMemoryMasteryStore()
  await mastery.save(student, pythonCourse.modules.map(module => ({
    moduleId: module.id,
    mastery: 0.42,
    passedExercise: false,
    everMastered: false,
  })))
  const quizAnswers = createMemoryQuizAnswerStore()
  const options: TurnOptions = {
    mastery,
    quizAnswers,
    evidence: createMemoryEvidenceStore(quizAnswers.observationsForStudent),
    unlocks: createMemoryUnlockStore(),
    decisions: createMemoryDecisionLogStore(),
    deskmateSettings: { async read() { return false }, async save() {} },
  }
  const store = createMemoryConversationStore({ [student]: 'An' })
  await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, store, undefined, options)
  const state = await handleTurn({
    sessionStudentId: student,
    body: { event: 'message', text: 'How close am I?' },
  }, store, createAgents(model), options)
  return { model, state, decisions: await options.decisions!.list({ studentId: student }) }
}

describe('the get_student_mastery tool', () => {
  it('gives the Teacher each module\'s stored mastery, the threshold and the maximum of 1.0', async () => {
    const { model } = await turn({ steps: [lookUp, explain], replies: ['A loop repeats.'] })

    const result = model.toolResults[0]
    expect(result?.name).toBe('get_student_mastery')
    expect(result?.output).toMatchObject({ masteryThreshold: pythonCourse.masteryThreshold, maximum: 1 })
    const modules = (result?.output as { modules: unknown[] }).modules
    expect(modules).toHaveLength(pythonCourse.modules.length)
    expect(modules[0]).toEqual({ id: 'getting_started', name: pythonCourse.modules[0]!.name, state: 'open', mastery: 0.42 })
  })

  it('keeps mastery out of the Teacher\'s prompt', async () => {
    const { model } = await turn({ steps: [explain], replies: ['A loop repeats.'] })

    const proposeCall = model.calls.find(call => call.operation === 'proposeWithTools')!
    expect(proposeCall.prompt).not.toMatch(/mastery/i)
    expect(proposeCall.maxSteps).toBe(3)
  })

  it('records the tool calls on the decision, and the VerifyShield rules on the final move as before', async () => {
    const { decisions } = await turn({ steps: [lookUp, explain], replies: ['A loop repeats.'] })

    expect(decisions).toHaveLength(1)
    expect(decisions[0]).toMatchObject({ agent: 'teacher', proposedMove: 'explain_concept', verdict: 'allow' })
    expect(decisions[0]!.toolTrace).toEqual([
      { name: 'get_student_mastery', input: {}, summary: expect.stringContaining('11 modules') },
    ])
  })

  it('says nothing when the Teacher reaches 3 steps, and records that it did', async () => {
    const { decisions, state } = await turn({ steps: [lookUp, lookUp, lookUp] })

    expect(state.conversation.some(message => message.author === 'teacher' && message.text === 'A loop repeats.')).toBe(false)
    expect(decisions).toHaveLength(1)
    expect(decisions[0]).toMatchObject({ agent: 'teacher', proposedMove: 'none', verdict: 'block', ruledMove: null, reasonCode: 'STEP_CAP_REACHED' })
    expect(decisions[0]!.toolTrace).toHaveLength(3)
  })
})
