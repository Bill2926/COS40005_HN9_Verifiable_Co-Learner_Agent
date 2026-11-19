import type { ReviewEvent, ReviewSignal } from '../../shared/staff-review'

// The two review signals. Each is something for a person to look at, never a
// verdict about the student, and each is worked out from the activity log when
// the review page opens: nothing here is stored or touches mastery (ADR 0009).
//
// For one exercise, the events since the student's previous pass on it are
// what a pass is judged against.

// A paste of at least this many characters is large: more than a line or two.
export const largePasteCharacters = 200

export function reviewSignals(events: readonly ReviewEvent[]): ReviewSignal[] {
  const ordered = [...events].sort((left, right) => left.id - right.id)
  const signals: ReviewSignal[] = []
  const sinceLastPass = new Map<string, ReviewEvent[]>()

  for (const event of ordered) {
    const exerciseId = text(event.payload.exerciseId)
    if (exerciseId === null) continue
    const before = sinceLastPass.get(exerciseId) ?? []

    if (event.type !== 'submitted' || !passed(event)) {
      sinceLastPass.set(exerciseId, [...before, event])
      continue
    }

    const moduleId = text(event.payload.moduleId)
    const paste = before.filter(item => item.type === 'pasted' && characters(item) >= largePasteCharacters)
    if (paste.length > 0) {
      const largest = Math.max(...paste.map(characters))
      signals.push({
        kind: 'large_paste_then_pass',
        moduleId,
        exerciseId,
        summary: `A paste of ${largest} characters came before this pass. Worth a look.`,
        eventIds: [...paste.map(item => item.id), event.id],
      })
    }
    if (!before.some(item => item.type === 'code_run' || item.type === 'run_finished')) {
      signals.push({
        kind: 'pass_without_run',
        moduleId,
        exerciseId,
        summary: 'This pass came with no run of the code before it. Worth a look.',
        eventIds: [event.id],
      })
    }
    sinceLastPass.set(exerciseId, [])
  }
  return signals
}

function passed(event: ReviewEvent): boolean {
  const { testsPassed, testsTotal } = event.payload
  return typeof testsPassed === 'number' && typeof testsTotal === 'number' && testsTotal > 0 && testsPassed === testsTotal
}

function characters(event: ReviewEvent): number {
  return typeof event.payload.characters === 'number' ? event.payload.characters : 0
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}
