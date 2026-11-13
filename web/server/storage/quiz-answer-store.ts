// The quiz-answer ledger: one append-only row per question a student answers,
// server only. Only the first answer to a question is stored; later choices a
// student makes to explore are never written. Like the evidence ledger, it is
// marked on the server so the answer key never has to reach the client first.

import type { TimedObservation } from '../student-model'

export interface NewQuizAnswer {
  studentId: string
  moduleId: string
  questionId: string
  // The choice index the student picked, 0 to 3.
  choice: number
  // Whether that choice was the correct one, decided on the server.
  correct: boolean
}

export interface QuizAnswerRow {
  time: string
  studentId: string
  moduleId: string
  questionId: string
  choice: number
  correct: boolean
}

// The result of recording an answer: the stored row, and whether this call is
// the one that stored it. A second answer to a question that already has one is
// `stored: false` and returns the first answer unchanged.
export interface RecordedQuizAnswer {
  row: QuizAnswerRow
  stored: boolean
}

export interface QuizAnswerStore {
  // Records the first answer to a question. If the question already has an
  // answer, nothing is written and the existing row comes back with
  // `stored: false`.
  record: (answer: NewQuizAnswer) => Promise<RecordedQuizAnswer>
  // The student's answers for one module, in the order they were written.
  forStudentModule: (studentId: string, moduleId: string) => Promise<QuizAnswerRow[]>
  observationsForStudent: (studentId: string) => Promise<TimedObservation[]>
}

export function quizObservation(row: QuizAnswerRow): TimedObservation {
  const { time, moduleId, questionId, correct } = row
  return { kind: 'quiz_answer', time, moduleId, questionId, allPassed: correct }
}

export function createMemoryQuizAnswerStore(): QuizAnswerStore {
  const rows: QuizAnswerRow[] = []

  function answerOf(studentId: string, moduleId: string, questionId: string): QuizAnswerRow | undefined {
    return rows.find(row =>
      row.studentId === studentId
      && row.moduleId === moduleId
      && row.questionId === questionId)
  }

  return {
    async observationsForStudent(studentId) {
      return rows.filter(row => row.studentId === studentId).map(quizObservation)
    },
    async record(answer) {
      const existing = answerOf(answer.studentId, answer.moduleId, answer.questionId)
      if (existing) return { row: { ...existing }, stored: false }
      const row: QuizAnswerRow = {
        time: new Date().toISOString(),
        studentId: answer.studentId,
        moduleId: answer.moduleId,
        questionId: answer.questionId,
        choice: answer.choice,
        correct: answer.correct,
      }
      rows.push(row)
      return { row: { ...row }, stored: true }
    },
    async forStudentModule(studentId, moduleId) {
      return rows
        .filter(row => row.studentId === studentId && row.moduleId === moduleId)
        .map(row => ({ ...row }))
    },
  }
}
