import { describe, expect, it } from 'vitest'
import { planProgress, type LearningPlan, type PlanRecords } from '../server/learning-plan'

const created = '2026-11-19T10:00:00.000Z'
const later = (seconds: number) => new Date(Date.parse(created) + seconds * 1000).toISOString()

function plan(steps: LearningPlan['steps'], overrides: Partial<LearningPlan> = {}): LearningPlan {
  return {
    moduleId: 'loops',
    revision: 2,
    steps,
    currentStep: 0,
    agreedAt: created,
    createdAt: created,
    trigger: null,
    decisionTurnId: null,
    ...overrides,
  }
}

function records(overrides: Partial<PlanRecords> = {}): PlanRecords {
  return { quizAnswers: [], submissions: [], activity: [], materialsSeconds: 0, ...overrides }
}

const failed = (exerciseId: string, seconds: number, findings: string[] = []) =>
  ({ exerciseId, outcome: 'failed' as const, findings, time: later(seconds) })
const passed = (exerciseId: string, seconds: number, findings: string[] = []) =>
  ({ exerciseId, outcome: 'passed' as const, findings, time: later(seconds) })

describe('plan progress: a step is done only from verified records', () => {
  const steps = [
    { kind: 'materials', ref: '' },
    { kind: 'quiz', ref: 'q1' },
    { kind: 'approach', ref: 'ex1' },
    { kind: 'try', ref: 'ex1' },
    { kind: 'exercise', ref: 'ex1' },
  ] as const

  it('has no step done and the first current before anything is verified', () => {
    expect(planProgress(plan(steps), records(), 3)).toMatchObject({ done: [false, false, false, false, false], currentStep: 0 })
  })

  it('has nothing done until the student agreed to the plan', () => {
    const unagreed = plan(steps, { agreedAt: null })
    expect(planProgress(unagreed, records({ materialsSeconds: 600 }), 3).currentStep).toBe(0)
  })

  it('marks the materials done after enough time on them', () => {
    expect(planProgress(plan(steps), records({ materialsSeconds: 30 }), 3).done[0]).toBe(false)
    expect(planProgress(plan(steps), records({ materialsSeconds: 90 }), 3).done[0]).toBe(true)
  })

  it('marks a quiz step done by a right answer only', () => {
    const wrong = records({ quizAnswers: [{ questionId: 'q1', correct: false, time: later(5) }] })
    const right = records({ quizAnswers: [{ questionId: 'q1', correct: true, time: later(5) }] })
    expect(planProgress(plan(steps), wrong, 3).done[1]).toBe(false)
    expect(planProgress(plan(steps), right, 3).done[1]).toBe(true)
  })

  it('marks the approach done by an approach written for that exercise since the plan', () => {
    const other = records({ activity: [{ type: 'approach_written', time: later(5), payload: { exerciseId: 'ex2' } }] })
    const mine = records({ activity: [{ type: 'approach_written', time: later(5), payload: { exerciseId: 'ex1' } }] })
    const before = records({ activity: [{ type: 'approach_written', time: later(-5), payload: { exerciseId: 'ex1' } }] })
    expect(planProgress(plan(steps), other, 3).done[2]).toBe(false)
    expect(planProgress(plan(steps), before, 3).done[2]).toBe(false)
    expect(planProgress(plan(steps), mine, 3).done[2]).toBe(true)
  })

  it('marks trying done only by a run or submission after the approach', () => {
    const approach = { type: 'approach_written' as const, time: later(10), payload: { exerciseId: 'ex1' } }
    const runBefore = { type: 'code_run' as const, time: later(5), payload: { exerciseId: 'ex1' } }
    const runAfter = { type: 'code_run' as const, time: later(20), payload: { exerciseId: 'ex1' } }
    expect(planProgress(plan(steps), records({ activity: [runBefore, approach] }), 3).done[3]).toBe(false)
    expect(planProgress(plan(steps), records({ activity: [approach, runAfter] }), 3).done[3]).toBe(true)
    expect(planProgress(plan(steps), records({ activity: [approach], submissions: [failed('ex1', 30)] }), 3).done[3]).toBe(true)
  })

  it('marks an exercise step done only by a sandbox pass', () => {
    expect(planProgress(plan(steps), records({ submissions: [failed('ex1', 5)] }), 3).done[4]).toBe(false)
    expect(planProgress(plan(steps), records({ submissions: [passed('ex1', 5)] }), 3).done[4]).toBe(true)
  })

  it('marks a weak-spot step done by a later pass whose code no longer shows it', () => {
    const weak = plan([{ kind: 'misconception', ref: 'reset' }])
    expect(planProgress(weak, records({ submissions: [passed('ex1', 5, ['reset'])] }), 3).done[0]).toBe(false)
    expect(planProgress(weak, records({ submissions: [passed('ex1', 5)] }), 3).done[0]).toBe(true)
  })

  it('makes the first step not done the current one, past the end when all are done', () => {
    const two = plan([{ kind: 'materials', ref: '' }, { kind: 'quiz', ref: 'q1' }])
    const quizOnly = records({ quizAnswers: [{ questionId: 'q1', correct: true, time: later(1) }] })
    expect(planProgress(two, quizOnly, 3).currentStep).toBe(0)
    expect(planProgress(two, { ...quizOnly, materialsSeconds: 100 }, 3).currentStep).toBe(2)
  })
})

describe('plan progress: what happened since the last revision', () => {
  const one = plan([{ kind: 'exercise', ref: 'ex1' }])

  it('counts failures of the same exercise against the limit', () => {
    const two = records({ submissions: [failed('ex1', 1), failed('ex1', 2)] })
    const three = records({ submissions: [failed('ex1', 1), failed('ex1', 2), failed('ex1', 3)] })
    const spread = records({ submissions: [failed('ex1', 1), failed('ex2', 2), failed('ex3', 3)] })
    expect(planProgress(one, two, 3).triggers).toEqual([])
    expect(planProgress(one, three, 3).triggers).toEqual(['failed_submissions'])
    expect(planProgress(one, spread, 3).triggers).toEqual([])
    expect(planProgress(one, two, 2).triggers).toEqual(['failed_submissions'])
  })

  it('ignores failures from before the last revision', () => {
    const old = records({ submissions: [failed('ex1', -3), failed('ex1', -2), failed('ex1', -1)] })
    expect(planProgress(one, old, 3).triggers).toEqual([])
  })

  it('sees a wrong quiz answer and a detected misconception', () => {
    expect(planProgress(one, records({ quizAnswers: [{ questionId: 'q1', correct: false, time: later(1) }] }), 3).triggers)
      .toEqual(['wrong_quiz_answer'])
    expect(planProgress(one, records({ submissions: [failed('ex1', 1, ['reset'])] }), 3).triggers)
      .toEqual(['misconception'])
  })

  it('sees a step finished since the revision wrote its current step', () => {
    const quiz = plan([{ kind: 'quiz', ref: 'q1' }, { kind: 'exercise', ref: 'ex1' }])
    const answered = records({ quizAnswers: [{ questionId: 'q1', correct: true, time: later(1) }] })
    expect(planProgress(quiz, answered, 3).triggers).toEqual(['step_done'])
    expect(planProgress({ ...quiz, currentStep: 1 }, answered, 3).triggers).toEqual([])
  })

  it('knows an approach is waiting to be tried until a run or submission follows it', () => {
    const approach = { type: 'approach_written' as const, time: later(10), payload: { exerciseId: 'ex1' } }
    const run = { type: 'code_run' as const, time: later(20), payload: { exerciseId: 'ex1' } }
    expect(planProgress(one, records({ activity: [approach] }), 3).approachAwaitingTry).toBe(true)
    expect(planProgress(one, records({ activity: [approach, run] }), 3).approachAwaitingTry).toBe(false)
    expect(planProgress(one, records(), 3).approachAwaitingTry).toBe(false)
  })
})

describe('plan progress across revisions and before agreement', () => {
  it('keeps an approach written before a revision, so the student does not write it twice', () => {
    const revised = plan([{ kind: 'approach', ref: 'ex1' }, { kind: 'try', ref: 'ex1' }], { createdAt: later(100) })
    const approach = { type: 'approach_written', time: later(10), payload: { exerciseId: 'ex1' } }

    expect(planProgress(revised, records({ activity: [approach] }), 3)).toMatchObject({ currentStep: 1, approachAwaitingTry: true })
  })

  it('sees no trigger on a plan that is not agreed', () => {
    const proposed = plan([{ kind: 'quiz', ref: 'q1' }], { agreedAt: null })

    expect(planProgress(proposed, records({ quizAnswers: [{ questionId: 'q1', correct: false, time: later(1) }] }), 3).triggers).toEqual([])
  })
})
