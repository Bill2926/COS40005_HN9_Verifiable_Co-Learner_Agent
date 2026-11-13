// The evidence ledger: one append-only row per submission, server only. Only
// the submission path writes it, no agent does, and a run writes nothing.

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
  forStudent: (studentId: string) => Promise<EvidenceRow[]>
}

export function createMemoryEvidenceStore(): EvidenceStore {
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
      return rows.filter(row => row.studentId === studentId).map(row => ({ ...row }))
    },
  }
}

export function allPassed(evidence: Pick<NewEvidence, 'testsPassed' | 'testsTotal'>): boolean {
  return evidence.testsTotal > 0 && evidence.testsPassed === evidence.testsTotal
}
