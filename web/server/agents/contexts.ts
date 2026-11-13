import type { PracticeTestResult, RunOutput, ModuleMaterials } from '../../shared/turn'

export interface SubmissionCheck {
  code: string
  results: readonly PracticeTestResult[]
}

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
}

export interface DeskmateContext {
  misconceptionResponses: readonly { id: string, response: string }[]
  exerciseStatement: string
  draft: string | null
  runOutput: RunOutput | null
  submission: SubmissionCheck | null
  conversation: TeacherContext['conversation']
}
