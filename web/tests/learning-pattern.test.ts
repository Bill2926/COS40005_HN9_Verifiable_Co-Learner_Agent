import { describe, expect, it } from 'vitest'
import { learningPattern } from '../server/learning-pattern'

// Records in, pattern out. The same records always give the same pattern, in
// whatever order the stores hand them over.

function records(overrides: Parameters<typeof learningPattern>[0] = {}) {
  return {
    evidence: [],
    submissions: [],
    quizAnswers: [],
    activity: [],
    decisions: [],
    ...overrides,
  }
}

describe('the learning pattern', () => {
  it('is empty for a student with no records', () => {
    expect(learningPattern(records())).toEqual({
      weakSpots: [],
      recurringErrors: [],
      exerciseAttempts: [],
      hintRungs: [],
      materialsSeconds: [],
    })
  })

  it('counts a weak spot once per submission that shows it, and notes when last seen', () => {
    const pattern = learningPattern(records({
      submissions: [
        { time: '2026-11-19T08:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'failed', findings: ['missing_quotes'] },
        { time: '2026-11-19T09:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'passed', findings: ['missing_quotes'] },
        { time: '2026-11-19T10:00:00Z', moduleId: 'getting_started', exerciseId: 'sign_the_program', outcome: 'failed', findings: [] },
      ],
    }))
    expect(pattern.weakSpots).toEqual([
      { misconceptionId: 'missing_quotes', count: 2, lastSeen: '2026-11-19T09:00:00Z' },
    ])
  })

  it('counts a wrong quiz answer naming a misconception as one more sighting', () => {
    const pattern = learningPattern(records({
      submissions: [
        { time: '2026-11-19T08:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'failed', findings: ['missing_quotes'] },
      ],
      quizAnswers: [
        { time: '2026-11-19T11:00:00Z', moduleId: 'getting_started', misconceptionId: 'missing_quotes' },
        { time: '2026-11-19T07:00:00Z', moduleId: 'getting_started', misconceptionId: 'missing_quotes' },
      ],
    }))
    expect(pattern.weakSpots).toEqual([
      { misconceptionId: 'missing_quotes', count: 3, lastSeen: '2026-11-19T11:00:00Z' },
    ])
  })

  it('orders weak spots by how often, then by id', () => {
    const pattern = learningPattern(records({
      submissions: [
        { time: '2026-11-19T08:00:00Z', moduleId: 'loops', exerciseId: 'sum_of_a_list', outcome: 'failed', findings: ['sum_instead_of_loop'] },
        { time: '2026-11-19T09:00:00Z', moduleId: 'loops', exerciseId: 'sum_of_a_list', outcome: 'failed', findings: ['accumulator_reset_inside_loop'] },
        { time: '2026-11-19T10:00:00Z', moduleId: 'loops', exerciseId: 'count_items', outcome: 'failed', findings: ['accumulator_reset_inside_loop'] },
      ],
    }))
    expect(pattern.weakSpots.map(spot => spot.misconceptionId)).toEqual([
      'accumulator_reset_inside_loop',
      'sum_instead_of_loop',
    ])
  })

  it('tallies the error kinds runs and failed submissions name', () => {
    const pattern = learningPattern(records({
      submissions: [
        { time: '2026-11-19T08:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'failed', findings: [] },
        { time: '2026-11-19T09:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'failed', findings: [] },
        { time: '2026-11-19T10:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'refused', findings: [] },
      ],
      activity: [
        { time: '2026-11-19T08:30:00Z', type: 'run_finished', moduleId: 'getting_started', payload: { outcome: 'error', errorType: 'NameError' } },
        { time: '2026-11-19T08:31:00Z', type: 'run_finished', moduleId: 'getting_started', payload: { outcome: 'error', errorType: 'NameError' } },
        { time: '2026-11-19T08:32:00Z', type: 'run_finished', moduleId: 'getting_started', payload: { outcome: 'stopped' } },
        { time: '2026-11-19T08:33:00Z', type: 'run_finished', moduleId: 'getting_started', payload: { outcome: 'completed' } },
      ],
    }))
    expect(pattern.recurringErrors).toEqual([
      { kind: 'NameError', count: 2 },
      { kind: 'failed', count: 2 },
      { kind: 'stopped', count: 1 },
    ])
  })

  it('reports the attempts an exercise took to pass, and whether it passed', () => {
    const pattern = learningPattern(records({
      evidence: [
        { time: '2026-11-19T08:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', allPassed: false },
        { time: '2026-11-19T09:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', allPassed: false },
        { time: '2026-11-19T10:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', allPassed: true },
        // A pass after the first pass does not add to the attempts to pass.
        { time: '2026-11-19T11:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', allPassed: true },
        { time: '2026-11-19T08:00:00Z', moduleId: 'loops', exerciseId: 'sum_of_a_list', allPassed: false },
      ],
    }))
    expect(pattern.exerciseAttempts).toEqual([
      { exerciseId: 'say_hello', attempts: 3, passed: true },
      { exerciseId: 'sum_of_a_list', attempts: 1, passed: false },
    ])
  })

  it('lists the hint rungs a module has used, from the decisions', () => {
    const pattern = learningPattern(records({
      decisions: [
        { moduleId: 'loops', ruledMove: 'hint_level_1' },
        { moduleId: 'loops', ruledMove: 'hint_level_2' },
        { moduleId: 'loops', ruledMove: 'hint_level_1' },
        { moduleId: 'loops', ruledMove: 'answer_question' },
        { moduleId: 'strings', ruledMove: 'hint_level_1' },
        { moduleId: null, ruledMove: 'hint_level_3' },
      ],
    }))
    expect(pattern.hintRungs).toEqual([
      { moduleId: 'loops', rungs: [1, 2] },
      { moduleId: 'strings', rungs: [1] },
    ])
  })

  it('adds up the time on materials from module_opened and mode_switched', () => {
    const pattern = learningPattern(records({
      activity: [
        { time: '2026-11-19T08:00:00Z', type: 'module_opened', moduleId: 'getting_started', payload: {} },
        // 10 minutes on materials, then away to practice.
        { time: '2026-11-19T08:10:00Z', type: 'mode_switched', moduleId: null, payload: { mode: 'practice' } },
        { time: '2026-11-19T08:15:00Z', type: 'mode_switched', moduleId: null, payload: { mode: 'materials' } },
        // Back to materials for five minutes, until another module opens.
        { time: '2026-11-19T08:20:00Z', type: 'module_opened', moduleId: 'variables', payload: {} },
        // Ten minutes back on materials, until another module opens.
        { time: '2026-11-19T08:25:00Z', type: 'module_opened', moduleId: 'getting_started', payload: {} },
        // The trailing materials stretch ends at the last event, ten minutes on.
        { time: '2026-11-19T08:35:00Z', type: 'mode_switched', moduleId: null, payload: { mode: 'practice' } },
      ],
    }))
    expect(pattern.materialsSeconds).toEqual([
      { moduleId: 'getting_started', seconds: 1500 },
      { moduleId: 'variables', seconds: 300 },
    ])
  })

  it('gives the same pattern for the same records in a different order', () => {
    const submissions = [
      { time: '2026-11-19T08:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'failed' as const, findings: ['missing_quotes'] },
      { time: '2026-11-19T09:00:00Z', moduleId: 'getting_started', exerciseId: 'say_hello', outcome: 'passed' as const, findings: ['missing_quotes'] },
    ]
    const activity = [
      { time: '2026-11-19T08:00:00Z', type: 'module_opened', moduleId: 'getting_started', payload: {} },
      { time: '2026-11-19T08:10:00Z', type: 'mode_switched', moduleId: null, payload: { mode: 'practice' } },
    ]
    const decisions = [
      { moduleId: 'getting_started', ruledMove: 'hint_level_1' },
      { moduleId: 'getting_started', ruledMove: 'answer_question' },
    ]
    const first = learningPattern(records({ submissions, activity, decisions }))
    const second = learningPattern(records({
      submissions: [...submissions].reverse(),
      activity: [...activity].reverse(),
      decisions: [...decisions].reverse(),
    }))
    expect(second).toEqual(first)
  })
})
