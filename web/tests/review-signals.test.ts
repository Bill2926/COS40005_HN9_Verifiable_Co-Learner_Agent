import { describe, expect, it } from 'vitest'
import { reviewSignals } from '../server/staff-review'
import type { ReviewEvent } from '../shared/staff-review'

let next = 0
function event(type: string, payload: Record<string, unknown>): ReviewEvent {
  next += 1
  return { id: next, type, time: `2026-11-19T08:${String(next).padStart(2, '0')}:00Z`, payload }
}
const paste = (exerciseId: string, characters: number) => event('pasted', { exerciseId, characters })
const run = (exerciseId: string) => event('code_run', { exerciseId })
const submit = (exerciseId: string, passed: boolean) => event('submitted', {
  moduleId: 'loops',
  exerciseId,
  testsPassed: passed ? 3 : 1,
  testsTotal: 3,
})

describe('review signals', () => {
  it('flags a large paste followed by a pass and links the paste and the pass', () => {
    const events = [run('sum'), paste('sum', 400), submit('sum', true)]

    const signals = reviewSignals(events)

    expect(signals).toEqual([{
      kind: 'large_paste_then_pass',
      moduleId: 'loops',
      exerciseId: 'sum',
      summary: 'A paste of 400 characters came before this pass. Worth a look.',
      eventIds: [events[1]!.id, events[2]!.id],
    }])
  })

  it('does not flag a small paste or a paste after the pass', () => {
    const events = [run('sum'), paste('sum', 12), submit('sum', true), paste('sum', 900)]

    expect(reviewSignals(events)).toEqual([])
  })

  it('flags a pass with no run before it and links the pass', () => {
    const events = [submit('count', true)]

    expect(reviewSignals(events)).toEqual([{
      kind: 'pass_without_run',
      moduleId: 'loops',
      exerciseId: 'count',
      summary: 'This pass came with no run of the code before it. Worth a look.',
      eventIds: [events[0]!.id],
    }])
  })

  it('does not flag a pass that a run came before, nor a failed submission', () => {
    const events = [run('a'), submit('a', true), submit('b', false)]

    expect(reviewSignals(events)).toEqual([])
  })

  it('only looks at the same exercise', () => {
    const events = [paste('other', 900), run('other'), submit('sum', true)]

    expect(reviewSignals(events).map(signal => signal.kind)).toEqual(['pass_without_run'])
  })

  it('never calls anything cheating', () => {
    const events = [paste('sum', 900), submit('sum', true)]

    for (const signal of reviewSignals(events)) {
      expect(signal.summary.toLowerCase()).not.toMatch(/cheat|plagiar|dishonest|misconduct/)
    }
  })
})
