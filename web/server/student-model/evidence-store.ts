import type { Observation } from './estimate'

export type TimedObservation = Observation & { time: string }

// Preserve the source's row order for ties. Submissions precede quiz answers
// at identical timestamps because the two tables have independent sequences.
export function mergeObservations(
  submissions: readonly TimedObservation[],
  quizAnswers: readonly TimedObservation[],
): TimedObservation[] {
  return [...submissions, ...quizAnswers].sort((left, right) =>
    Date.parse(left.time) - Date.parse(right.time) || fraction(left.time) - fraction(right.time))
}

function fraction(time: string): number {
  return Number(`0.${time.match(/\.(\d+)/)?.[1] ?? '0'}`)
}

export interface NewEvidence {
  studentId: string
  moduleId: string
  exerciseId: string
  testsPassed: number
  testsTotal: number
}

export interface EvidenceRow {
  time: string
  studentId: string
  moduleId: string
  exerciseId: string
  attempt: number
  testsPassed: number
  testsTotal: number
  allPassed: boolean
}

export interface EvidenceStore {
  // The attempt number comes from the ledger, not the caller, so two
  // submissions can never claim the same attempt on an exercise.
  append: (evidence: NewEvidence) => Promise<EvidenceRow>
  forStudent: (studentId: string) => Promise<TimedObservation[]>
}

export function createMemoryEvidenceStore(
  quizObservations: (studentId: string) => Promise<TimedObservation[]> = async () => [],
): EvidenceStore {
  const rows: EvidenceRow[] = []

  return {
    async append(evidence) {
      const attempts = rows.filter(row =>
        row.studentId === evidence.studentId
        && row.moduleId === evidence.moduleId
        && row.exerciseId === evidence.exerciseId).length
      const row: EvidenceRow = {
        time: new Date().toISOString(),
        studentId: evidence.studentId,
        moduleId: evidence.moduleId,
        exerciseId: evidence.exerciseId,
        attempt: attempts + 1,
        testsPassed: evidence.testsPassed,
        testsTotal: evidence.testsTotal,
        allPassed: allPassed(evidence),
      }
      rows.push(row)
      return { ...row }
    },
    async forStudent(studentId) {
      const quizAnswers = await quizObservations(studentId)
      const submissions = rows.filter(row => row.studentId === studentId)
        .map(({ time, moduleId, exerciseId, allPassed }) => ({ kind: 'submission' as const, time, moduleId, exerciseId, allPassed }))
      return mergeObservations(submissions, quizAnswers)
    },
  }
}

export function allPassed(evidence: Pick<NewEvidence, 'testsPassed' | 'testsTotal'>): boolean {
  return evidence.testsTotal > 0 && evidence.testsPassed === evidence.testsTotal
}
