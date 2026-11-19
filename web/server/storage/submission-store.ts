import type { PracticeTestResult } from '../../shared/turn'

// A submission kept after the sandbox has checked it: the code, each test, the
// outcome, and the misconceptions the code shows. The owning student can read
// it. Any other student is refused.

export type SubmissionOutcome = 'passed' | 'failed' | 'refused'

export interface NewSubmission {
  studentId: string
  moduleId: string
  exerciseId: string
  code: string
  results: readonly PracticeTestResult[]
  outcome: SubmissionOutcome
  message: string | null
  // The ids of the misconceptions the code shows; empty when it shows none.
  findings: readonly string[]
}

export interface StoredSubmission {
  id: string
  studentId: string
  moduleId: string
  exerciseId: string
  code: string
  results: PracticeTestResult[]
  outcome: SubmissionOutcome
  message: string | null
  findings: readonly string[]
}

export class SubmissionRefusedError extends Error {
  readonly statusCode = 403

  constructor() {
    super('That submission is not yours.')
    this.name = 'SubmissionRefusedError'
  }
}

export class SubmissionNotFoundError extends Error {
  readonly statusCode = 404

  constructor() {
    super('That submission does not exist.')
    this.name = 'SubmissionNotFoundError'
  }
}

export interface SubmissionStore {
  record: (submission: NewSubmission) => Promise<StoredSubmission>
  forStudent: (studentId: string) => Promise<StoredSubmission[]>
  read: (readerId: string, submissionId: string) => Promise<StoredSubmission>
  // The latest submission kept for one exercise, or null when none is.
  latestForExercise: (studentId: string, moduleId: string, exerciseId: string) => Promise<StoredSubmission | null>
}

export function createMemorySubmissionStore(): SubmissionStore {
  const rows: StoredSubmission[] = []

  return {
    async record(submission) {
      const row: StoredSubmission = {
        id: crypto.randomUUID(),
        studentId: submission.studentId,
        moduleId: submission.moduleId,
        exerciseId: submission.exerciseId,
        code: submission.code,
        results: submission.results.map(result => ({ ...result })),
        outcome: submission.outcome,
        message: submission.message,
        findings: [...submission.findings],
      }
      rows.push(row)
      return copySubmission(row)
    },
    async forStudent(studentId) {
      return rows.filter(row => row.studentId === studentId).map(copySubmission)
    },
    async read(readerId, submissionId) {
      return copySubmission(owned(rows.find(row => row.id === submissionId), readerId))
    },
    async latestForExercise(studentId, moduleId, exerciseId) {
      const latest = rows.findLast(row => row.studentId === studentId
        && row.moduleId === moduleId
        && row.exerciseId === exerciseId)
      return latest ? copySubmission(latest) : null
    },
  }
}

function owned(row: StoredSubmission | undefined, readerId: string): StoredSubmission {
  if (!row) throw new SubmissionNotFoundError()
  if (row.studentId !== readerId) throw new SubmissionRefusedError()
  return row
}

function copySubmission(row: StoredSubmission): StoredSubmission {
  return {
    ...row,
    results: row.results.map(result => ({ ...result })),
    findings: [...row.findings],
  }
}
