import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { createMemoryLearningPlanStore } from '../server/storage/learning-plan-store'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-2222-4222-8222-222222222222'

function store() {
  return createMemoryConversationStore({ [student]: 'An' })
}

// The plan the scripted Teacher proposes: the materials, then the module's first exercise.
function plans() {
  return createMemoryLearningPlanStore()
}

function agents() {
  return createFakeAgents({
    proposal: { type: 'answer_question', scope: 'getting_started' },
    text: 'Start with the materials.',
    plan: context => ({
      type: 'propose_plan',
      steps: [
        { kind: 'materials', ref: '' },
        { kind: 'exercise', ref: context.exercises[0]!.id },
      ],
    }),
  })
}

function open(conversation = store(), options: Parameters<typeof handleTurn>[3] = {}) {
  return handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation, agents(), {
    plans: plans(),
    ...options,
  })
}

describe('the learning plan in the turn', () => {
  it('shows the Teacher\'s plan for a module the student just opened, unagreed', async () => {
    const state = await open()

    expect(state.learningPlan).toMatchObject({
      moduleId: 'getting_started',
      revision: 1,
      agreed: false,
      currentStep: 0,
      steps: [
        { id: 'materials', title: 'Read the module materials', current: true },
        { id: expect.stringMatching(/^exercise:/), current: false },
      ],
    })
  })

  it('shows no plan when no plan store is wired', async () => {
    const state = await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, store(), agents(), {})

    expect(state.learningPlan).toBeNull()
  })

  it('proposes the plan once; opening the module again reads it back', async () => {
    const conversation = store()
    const planStore = plans()
    const teacher = agents()
    const options = { plans: planStore }

    const first = await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation, teacher, options)
    const again = await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation, teacher, options)

    expect(teacher.exchanges.filter(exchange => exchange.phase === 'plan')).toHaveLength(1)
    expect(again.learningPlan).toEqual(first.learningPlan)
    expect(await planStore.latest(student, 'getting_started')).toMatchObject({ revision: 1, agreedAt: null })
  })

  it('records agreement as a new revision, keeping the first one', async () => {
    const conversation = store()
    const planStore = plans()
    const teacher = agents()
    await handleTurn({
      sessionStudentId: student,
      body: { event: 'open' },
    }, conversation, teacher, { plans: planStore })

    const state = await handleTurn({
      sessionStudentId: student,
      body: { event: 'plan_start' },
    }, conversation, teacher, { plans: planStore, now: () => new Date('2026-11-19T10:00:00Z') })

    expect(state.learningPlan).toMatchObject({ revision: 2, agreed: true })
    expect(await planStore.latest(student, 'getting_started')).toMatchObject({
      revision: 2,
      agreedAt: '2026-11-19T10:00:00.000Z',
    })
  })

  it('keeps the agreed plan and its current step when the student comes back', async () => {
    const conversation = store()
    const planStore = plans()
    const teacher = agents()
    await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation, teacher, { plans: planStore })
    await handleTurn({ sessionStudentId: student, body: { event: 'plan_start' } }, conversation, teacher, { plans: planStore })

    const returned = await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, store(), teacher, { plans: planStore })

    expect(returned.learningPlan).toMatchObject({ revision: 2, agreed: true, currentStep: 0 })
  })

  it('changes no mastery by proposing or agreeing to a plan', async () => {
    const conversation = store()
    const planStore = plans()
    const teacher = agents()
    const opened = await handleTurn({ sessionStudentId: student, body: { event: 'open' } }, conversation, teacher, { plans: planStore })
    const started = await handleTurn({ sessionStudentId: student, body: { event: 'plan_start' } }, conversation, teacher, { plans: planStore })

    expect(started.courseRoadmap.map(module => module.mastery))
      .toEqual(opened.courseRoadmap.map(module => module.mastery))
  })

  it('records the plan decision in the log', async () => {
    const decisions = createMemoryDecisionLogStore()

    await open(store(), { decisions })

    const recorded = await decisions.list({ studentId: student })
    expect(recorded).toEqual(expect.arrayContaining([
      expect.objectContaining({ proposedMove: 'propose_plan', moduleId: 'getting_started' }),
    ]))
  })

  it('starting a module with no plan changes nothing', async () => {
    const state = await handleTurn({ sessionStudentId: student, body: { event: 'plan_start' } }, store(), agents(), { plans: plans() })

    expect(state.learningPlan).toBeNull()
  })

  it('stores a plan with no steps when the VerifyShield is off', async () => {
    const teacher = createFakeAgents({
      proposal: { type: 'answer_question', scope: 'getting_started' },
      text: 'Start with the materials.',
      plan: { type: 'propose_plan', steps: [] },
    })
    const planStore = plans()

    const state = await handleTurn(
      { sessionStudentId: student, body: { event: 'open' } },
      store(),
      teacher,
      { plans: planStore, verifyShieldOn: false },
    )

    expect(state.learningPlan).toMatchObject({ revision: 1, steps: [] })
    expect(await planStore.latest(student, 'getting_started')).toMatchObject({ revision: 1, agreedAt: null })
  })

  it('never proposes a plan in a preview', async () => {    const planStore = plans()
    const teacher = agents()

    const state = await handleTurn({
      sessionStudentId: student,
      body: { event: 'preview_module', moduleId: 'getting_started' },
    }, store(), teacher, { plans: planStore })

    expect(state.learningPlan).toBeNull()
    expect(teacher.exchanges.filter(exchange => exchange.phase === 'plan')).toHaveLength(0)
    expect(await planStore.latest(student, 'getting_started')).toBeNull()
  })
})
