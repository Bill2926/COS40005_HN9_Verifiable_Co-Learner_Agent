import type { RunOutput, TopicMaterials } from '../../shared/turn'
import type { Move } from './moves'

export interface TeacherContext {
  materials: TopicMaterials
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
  conversation: readonly {
    author: 'student' | 'teacher' | 'deskmate' | 'event'
    text: string
    approvedMove: string | null
  }[]
}

export interface ModelExchange {
  phase: 'propose' | 'render'
  context: TeacherContext
  move: Move | null
}

export interface LanguageModel {
  propose: (context: TeacherContext) => Promise<Move | null>
  render: (context: TeacherContext, move: Move) => AsyncIterable<string>
}
