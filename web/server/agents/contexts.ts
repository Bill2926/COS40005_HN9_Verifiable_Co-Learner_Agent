import type { PracticeTestResult, RunOutput, ModuleMaterials } from '../../shared/turn'

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
    state: 'mastered' | 'open' | 'closed'
    mastery: number
    current: boolean
  }[]
  answeredQuiz: readonly AnsweredQuizResult[]
}

export interface DeskmateContext {
  exerciseStatement: string
  draft: string | null
  runOutput: RunOutput | null
  submission: SubmissionCheck | null
  conversation: TeacherContext['conversation']
  answeredQuiz: readonly DeskmateQuizResult[]
}
