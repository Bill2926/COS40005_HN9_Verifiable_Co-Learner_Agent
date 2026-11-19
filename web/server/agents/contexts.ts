import type { ModuleMaterials, ModuleState, PracticeTestResult, RunOutput } from '../../shared/turn'
import type { LearningPattern } from '../learning-pattern'

export interface SubmissionCheck {
  code: string
  results: readonly PracticeTestResult[]
}

// One answered quiz question, as the Teacher sees it. Only answered questions
// become results, so an unanswered question's correct choice never reaches a
// prompt. The Deskmate sees the same result without the explanation.
export interface AnsweredQuizResult {
  prompt: string
  // The choice the student picked, 0 to 3.
  choice: number
  // The correct choice, known because the question has been answered.
  correctIndex: number
  correct: boolean
  explanation: string
  // The misconception the student's choice shows, or null for none.
  misconceptionId: string | null
}

export type DeskmateQuizResult = Omit<AnsweredQuizResult, 'explanation'>

export interface TeacherContext {
  materials: ModuleMaterials
  hintLadder: readonly string[]
  misconceptionResponses: readonly { id: string, response: string }[]
  // The misconceptions the student's submitted code shows, from the findings
  // kept with their latest submission for this exercise.
  codeFindings: readonly string[]
  exercise: {
    id: string
    title: string
    statement: string
    starterCode: string
  }
  draft: string | null
  runOutput: RunOutput | null
  submission: SubmissionCheck | null
  conversation: readonly {
    author: 'student' | 'teacher' | 'deskmate' | 'event'
    text: string
    approvedMove: string | null
  }[]
  roadmap: readonly {
    id: string
    number: number
    name: string
    part: string
    state: ModuleState
    current: boolean
  }[]
  answeredQuiz: readonly AnsweredQuizResult[]
  // Where the student's work says they struggle and how they study, computed from
  // their records in this course. The Deskmate's context never carries it.
  learningPattern: LearningPattern
}

export interface DeskmateContext {
  exerciseStatement: string
  draft: string | null
  runOutput: RunOutput | null
  submission: SubmissionCheck | null
  conversation: TeacherContext['conversation']
  answeredQuiz: readonly DeskmateQuizResult[]
}
