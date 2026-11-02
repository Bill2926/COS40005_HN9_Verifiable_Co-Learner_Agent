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

export interface DeskmateContext {
  misconceptionResponses: readonly { id: string, response: string }[]
  exerciseStatement: string
  draft: string | null
  runOutput: RunOutput | null
  conversation: TeacherContext['conversation']
}

export type ModelExchange =
  | {
    agent: 'teacher'
    phase: 'propose' | 'render'
    context: TeacherContext
    move: Move | null
  }
  | {
    agent: 'deskmate'
    phase: 'propose' | 'render'
    context: DeskmateContext
    move: Move | null
  }

export interface AgentModel<Context> {
  propose: (context: Context) => Promise<Move | null>
  render: (context: Context, move: Move) => AsyncIterable<string>
}

export interface LanguageModel {
  teacher: AgentModel<TeacherContext>
  deskmate: AgentModel<DeskmateContext>
}
