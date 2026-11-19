import { describe, expect, it } from 'vitest'
import { planStepKey, planStepTitle, planView, type LearningPlan, type PlanModule } from '../server/learning-plan'

const module: PlanModule = {
  materials: [{ kind: 'text' }],
  quiz: [{ id: 'running-total', prompt: 'Where should you set a running total to zero?' }],
  exercises: [{ id: 'sum_of_a_list', title: 'Sum of a list' }],
  misconceptionResponses: [{ id: 'accumulator_reset_inside_loop', response: 'The total resets inside the loop.' }],
}

function plan(overrides: Partial<LearningPlan> = {}): LearningPlan {
  return {
    moduleId: 'loops',
    revision: 1,
    steps: [
      { kind: 'materials', ref: '' },
      { kind: 'exercise', ref: 'sum_of_a_list' },
    ],
    currentStep: 0,
    agreedAt: null,
    createdAt: '2026-11-19T09:00:00.000Z',
    trigger: null,
    decisionTurnId: null,
    ...overrides,
  }
}

describe('planStepTitle', () => {
  it('names the module materials without a ref', () => {
    expect(planStepTitle({ kind: 'materials', ref: '' }, module)).toBe('Read the module materials')
  })

  it('names a quiz question by its prompt', () => {
    expect(planStepTitle({ kind: 'quiz', ref: 'running-total' }, module))
      .toBe('Answer the quiz question: Where should you set a running total to zero?')
  })

  it('names an exercise by its title', () => {
    expect(planStepTitle({ kind: 'exercise', ref: 'sum_of_a_list' }, module)).toBe('Practise: Sum of a list')
  })

  it('names a misconception by the course response', () => {
    expect(planStepTitle({ kind: 'misconception', ref: 'accumulator_reset_inside_loop' }, module))
      .toBe('Work on: The total resets inside the loop.')
  })

  it('has no words for a step that points at nothing', () => {
    expect(planStepTitle({ kind: 'quiz', ref: 'string-slicing' }, module)).toBe('')
  })
})

describe('planStepKey', () => {
  it('is the kind alone for the materials step, and kind and ref otherwise', () => {
    expect(planStepKey({ kind: 'materials', ref: '' })).toBe('materials')
    expect(planStepKey({ kind: 'exercise', ref: 'sum_of_a_list' })).toBe('exercise:sum_of_a_list')
  })
})

describe('planView', () => {
  it('shows the steps in order, the current one marked, and the plan unagreed', () => {
    expect(planView(plan({ currentStep: 1 }), module)).toEqual({
      moduleId: 'loops',
      revision: 1,
      agreed: false,
      steps: [
        { id: 'materials', title: 'Read the module materials', current: false, done: false },
        { id: 'exercise:sum_of_a_list', title: 'Practise: Sum of a list', current: true, done: false },
      ],
      currentStep: 1,
    })
  })

  it('marks an agreed plan as agreed', () => {
    expect(planView(plan({ agreedAt: '2026-11-19T10:00:00.000Z' }), module).agreed).toBe(true)
  })

  it('leaves out a step that no longer matches the module', () => {
    const viewed = planView(plan({
      steps: [
        { kind: 'exercise', ref: 'sum_of_a_list' },
        { kind: 'quiz', ref: 'string-slicing' },
      ],
    }), module)
    expect(viewed.steps.map(step => step.id)).toEqual(['exercise:sum_of_a_list'])
  })

  it('keeps the current mark on its own step when an earlier step is left out', () => {
    const viewed = planView(plan({
      steps: [
        { kind: 'quiz', ref: 'string-slicing' },
        { kind: 'exercise', ref: 'sum_of_a_list' },
      ],
      currentStep: 1,
    }), module)
    expect(viewed.steps).toEqual([
      { id: 'exercise:sum_of_a_list', title: 'Practise: Sum of a list', current: true, done: false },
    ])
  })
})
