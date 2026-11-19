import { describe, expect, it } from 'vitest'
import { createFakeAgents, type FakeAgentScript } from '../server/agents'
import { createMemoryActivityLog } from '../server/activity-recorder'
import type { PlanStep } from '../server/learning-plan'
import { createFakeSandbox } from '../server/sandbox'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { createMemoryLearningPlanStore } from '../server/storage/learning-plan-store'
import { createMemoryQuizAnswerStore } from '../server/storage/quiz-answer-store'
import { createMemorySubmissionStore } from '../server/storage/submission-store'
import { createMemoryEvidenceStore } from '../server/student-model'
import type { TeacherContext } from '../server/agents'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-3333-4333-8333-333333333333'
const failing = [
  { name: 'greeting for An', passed: false, expected: 'Hello, An', actual: '' },
  { name: 'greeting for Mai', passed: false, expected: 'Hello, Mai', actual: '' },
  { name: 'greeting for world', passed: false, expected: 'Hello, world', actual: '' },
]
const longAgo = new Date(Date.now() - 3_600_000)

// One student's world: every store a turn reads, and a plan agreed an hour ago.
function world(steps: PlanStep[], teacherScript: FakeAgentScript<TeacherContext>, agreed = true) {
  // The seeded plan is an hour old; every revision after it is stamped by the real clock.
  let seeded = false
  const plans = createMemoryLearningPlanStore(() => {
    if (seeded) return new Date()
    seeded = true
    return longAgo
  })
  const stores = {
    plans,
    activity: createMemoryActivityLog(),
    decisions: createMemoryDecisionLogStore(),
    quizAnswers: createMemoryQuizAnswerStore(),
    submissions: createMemorySubmissionStore(),
    evidence: createMemoryEvidenceStore(),
    sandbox: createFakeSandbox({ outcome: 'checked', results: failing }),
  }
  const agents = createFakeAgents(teacherScript)
  const conversation = createMemoryConversationStore({ [student]: 'An' })
  const ready = plans.append(student, {
    moduleId: 'getting_started',
    revision: 1,
    steps,
    currentStep: 0,
    agreedAt: agreed ? longAgo.toISOString() : null,
    trigger: null,
    decisionTurnId: null,
  })
  const turn = async (body: object) => {
    await ready
    return handleTurn({ sessionStudentId: student, body }, conversation, agents, stores)
  }
  const submit = (code = 'def hello(name):\n    return name\n') =>
    turn({ event: 'submission', code, results: failing })
  return { ...stores, agents, turn, submit }
}

const revisedSteps = [{ kind: 'exercise' as const, ref: 'join_words' }]
const revise: FakeAgentScript<TeacherContext> = {
  proposal: { type: 'revise_plan', steps: revisedSteps },
  text: 'Let us try another route.',
}
const practise: PlanStep[] = [{ kind: 'exercise', ref: 'say_hello' }]

describe('revising the plan after failed submissions', () => {
  it('turns a revision into a check-in until the exercise has failed three times', async () => {
    const { turn, submit, plans, decisions } = world(practise, revise)
    await submit()
    await submit()

    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 1 })
    expect(await decisions.list({ studentId: student })).toContainEqual(expect.objectContaining({
      proposedMove: 'revise_plan',
      verdict: 'downgrade',
      ruledMove: 'continue_plan',
      reasonCode: 'PLAN_NO_TRIGGER',
    }))
    await turn({ event: 'open' })
  })

  it('revises after the third failure, recording the trigger and the decision it came from', async () => {
    const { submit, plans, decisions } = world(practise, revise)
    await submit()
    await submit()
    const state = await submit()

    const latest = await plans.latest(student, 'getting_started')
    expect(latest).toMatchObject({ revision: 2, trigger: 'failed_submissions', steps: [{ kind: 'exercise', ref: 'join_words' }] })
    expect(state.learningPlan).toMatchObject({ revision: 2, steps: [{ id: 'exercise:join_words' }] })
    const ruled = (await decisions.list({ studentId: student })).filter(decision => decision.turnId === latest!.decisionTurnId)
    expect(ruled).toContainEqual(expect.objectContaining({ proposedMove: 'revise_plan', verdict: 'allow' }))
  })

  it('answers a fourth failure with a check-in, because the revision used up the trigger', async () => {
    const { submit, plans } = world(practise, revise)
    for (let count = 0; count < 3; count += 1) await submit()
    await new Promise(resolve => setTimeout(resolve, 5))
    await submit()

    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 2 })
  })

  it('does not count failures of different exercises together', async () => {
    const { turn, plans } = world(practise, revise)
    for (const exerciseId of ['say_hello', 'join_words', 'sign_the_program']) {
      await turn({ event: 'select_exercise', exerciseId })
      await turn({ event: 'submission', code: 'x', results: failing })
    }

    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 1 })
  })
})

describe('revising the plan for a wrong answer or a misconception', () => {
  it('revises after a wrong quiz answer', async () => {
    const { turn, plans } = world([{ kind: 'quiz', ref: 'print-text' }], revise)
    await turn({ event: 'quiz_answer', moduleId: 'getting_started', questionId: 'print-text', choice: 0 })

    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 2, trigger: 'wrong_quiz_answer' })
  })

  it('revises when the submitted code shows the module\'s misconception', async () => {
    const { submit, plans } = world(practise, revise)
    await submit('print(Hello)\n')

    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 2, trigger: 'misconception' })
  })

  it('brings the teacher in when a right answer finishes a step, and revises on it', async () => {
    const { turn, plans, agents } = world([{ kind: 'quiz', ref: 'print-text' }, { kind: 'exercise', ref: 'say_hello' }], revise)
    await turn({ event: 'quiz_answer', moduleId: 'getting_started', questionId: 'print-text', choice: 1 })

    expect(agents.exchanges.some(exchange => exchange.agent === 'teacher' && exchange.phase === 'propose')).toBe(true)
    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 2, trigger: 'step_done' })
  })

  it('stays quiet on a right answer that finishes nothing', async () => {
    const { turn, agents } = world(practise, revise)
    await turn({ event: 'quiz_answer', moduleId: 'getting_started', questionId: 'print-text', choice: 1 })

    expect(agents.exchanges).toHaveLength(0)
  })
})

describe('the approach step', () => {
  const approach: PlanStep[] = [{ kind: 'approach', ref: 'say_hello' }, { kind: 'try', ref: 'say_hello' }, { kind: 'exercise', ref: 'say_hello' }]
  const hint: FakeAgentScript<TeacherContext> = {
    proposal: { type: 'hint_level_N', level: 1, scope: 'getting_started' },
    text: 'How is it going?',
  }

  it('keeps the student\'s next message as their approach and moves to trying it', async () => {
    const { turn, activity } = world(approach, hint)
    const before = await turn({ event: 'open' })
    expect(before.learningPlan).toMatchObject({ currentStep: 0, steps: [{ done: false }, { done: false }, { done: false }] })

    const state = await turn({ event: 'message', text: 'I will print the greeting with the name added.' })

    expect(activity.events).toContainEqual(expect.objectContaining({
      type: 'approach_written',
      payload: { moduleId: 'getting_started', exerciseId: 'say_hello' },
    }))
    expect(state.learningPlan).toMatchObject({ currentStep: 1, steps: [{ done: true }, { current: true }, { done: false }] })
  })

  it('does not keep a message as the approach before the student agreed to the plan', async () => {
    const { turn, activity } = world(approach, hint, false)
    await turn({ event: 'message', text: 'I will print it.' })

    expect(activity.events.filter(event => event.type === 'approach_written')).toHaveLength(0)
  })

  it('lets a wrong approach be tried: a hint becomes a check-in until the student runs or submits', async () => {
    const { turn, decisions, agents } = world(approach, hint)
    await turn({ event: 'message', text: 'I will print the greeting.' })

    expect(await decisions.list({ studentId: student })).toContainEqual(expect.objectContaining({
      proposedMove: 'hint_level_1',
      verdict: 'downgrade',
      ruleId: 'approach_before_correction',
      ruledMove: 'continue_plan',
    }))
    const rendered = agents.exchanges.filter(exchange => exchange.phase === 'render').at(-1)
    expect(rendered?.move).toEqual({ type: 'continue_plan' })
  })

  it('corrects once the student has submitted since the approach', async () => {
    const { turn, submit, decisions } = world(approach, hint)
    await turn({ event: 'message', text: 'I will print the greeting.' })
    await submit()

    const hints = (await decisions.list({ studentId: student })).filter(decision => decision.proposedMove === 'hint_level_1')
    // The log lists the newest decision first.
    expect(hints[0]).toMatchObject({ verdict: 'allow', ruledMove: 'hint_level_1' })
    expect(hints[1]).toMatchObject({ verdict: 'downgrade', ruledMove: 'continue_plan' })
  })

  it('shows the teacher the plan and the current step', async () => {
    const { turn, agents } = world(approach, hint)
    await turn({ event: 'message', text: 'I will print the greeting.' })

    const context = agents.exchanges.find(exchange => exchange.phase === 'propose')!.context as TeacherContext
    expect(context.plan).toMatchObject({
      revision: 1,
      approachAwaitingTry: true,
      steps: [{ kind: 'approach', done: true }, { kind: 'try', current: true }, { kind: 'exercise' }],
    })
  })

  it('marks a step done from the sandbox result, not from what the browser reported', async () => {
    const { turn, plans } = world([{ kind: 'exercise', ref: 'say_hello' }], hint)
    const state = await turn({
      event: 'submission',
      code: 'print("Hello")',
      results: [{ name: 'greeting for An', passed: true, expected: 'Hello, An', actual: 'Hello, An' }],
    })

    expect(state.learningPlan).toMatchObject({ steps: [{ done: false }], currentStep: 0 })
    expect(await plans.latest(student, 'getting_started')).toMatchObject({ revision: 1 })
  })
})

describe('checking in after a quiet period', () => {
  const checkIn: FakeAgentScript<TeacherContext> = { proposal: { type: 'continue_plan' }, text: 'How is the first step going?' }

  it('checks in once after three quiet minutes, and again only after activity', async () => {
    const { turn, agents, activity } = world(practise, checkIn)

    const first = await turn({ event: 'idle' })
    const again = await turn({ event: 'idle' })

    expect(first.conversation.at(-1)).toMatchObject({ author: 'teacher', approvedMove: 'continue_plan', text: 'How is the first step going?' })
    expect(again.conversation).toHaveLength(first.conversation.length)
    expect(agents.exchanges.filter(exchange => exchange.agent === 'teacher' && exchange.phase === 'propose')).toHaveLength(1)

    await activity.record({ studentId: student, courseId: 'intro_python', type: 'code_run', payload: { exerciseId: 'say_hello' } })
    const next = await turn({ event: 'idle' })
    expect(next.conversation.filter(message => message.approvedMove === 'continue_plan')).toHaveLength(2)
  })

  it('does not end the quiet period by going quiet again', async () => {
    const { turn, activity, agents } = world(practise, checkIn)
    await turn({ event: 'idle' })
    await activity.record({ studentId: student, courseId: 'intro_python', type: 'went_idle', payload: { moduleId: 'getting_started', exerciseId: 'say_hello' } })
    await turn({ event: 'idle' })

    expect(agents.exchanges.filter(exchange => exchange.agent === 'teacher' && exchange.phase === 'propose')).toHaveLength(1)
  })

  it('has the VerifyShield rule on the check-in like any other move', async () => {
    const { turn, decisions } = world(practise, checkIn)
    await turn({ event: 'idle' })

    expect(await decisions.list({ studentId: student })).toContainEqual(expect.objectContaining({
      proposedMove: 'continue_plan',
      verdict: 'allow',
    }))
  })

  it('has nothing to check in on when the module has no plan', async () => {
    const agents = createFakeAgents(checkIn)
    const state = await handleTurn(
      { sessionStudentId: student, body: { event: 'idle' } },
      createMemoryConversationStore({ [student]: 'An' }),
      agents,
      { plans: createMemoryLearningPlanStore(), activity: createMemoryActivityLog() },
    )

    expect(agents.exchanges).toHaveLength(0)
    expect(state.learningPlan).toBeNull()
  })
})

describe('agreeing to the plan', () => {
  it('records plan_agreed and keeps the decision the plan came from', async () => {
    const { turn, plans, activity } = world(practise, revise, false)
    await turn({ event: 'open' })
    await plans.append(student, { ...(await plans.latest(student, 'getting_started'))!, revision: 2, decisionTurnId: '11111111-1111-4111-8111-111111111111' })
    await turn({ event: 'plan_start' })

    expect(activity.events).toContainEqual(expect.objectContaining({ type: 'plan_agreed', payload: { moduleId: 'getting_started' } }))
    expect(await plans.latest(student, 'getting_started')).toMatchObject({
      revision: 3,
      decisionTurnId: '11111111-1111-4111-8111-111111111111',
    })
  })
})
