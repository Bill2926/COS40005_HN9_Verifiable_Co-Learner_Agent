export type TopicState = 'mastered' | 'open' | 'closed'

interface MapTopicBase {
  id: string
  name: string
  current: boolean
}

export type MapTopic =
  | (MapTopicBase & { state: 'mastered' | 'open' })
  | (MapTopicBase & { state: 'closed'; closedReason: string })

export interface TopicMaterials {
  heading: string
  body: string
  example: string
  scopeNote: string
}

export interface ExerciseCheck {
  name: string
  expression: string
  expected: string
}

export interface ExerciseChoice {
  id: string
  title: string
}

export interface CurrentExercise {
  id: string
  title: string
  statement: string
  starterCode: string
  tests: readonly [ExerciseCheck, ExerciseCheck, ExerciseCheck]
}

export interface WorkingAreaView {
  mode: 'learn'
  topicId: string
  topicName: string
  materials: TopicMaterials
  exercise: CurrentExercise
  exercises: readonly ExerciseChoice[]
}

export interface ConversationMessage {
  id: string
  author: 'student' | 'teacher' | 'deskmate' | 'event'
  name: string
  role: string
  text: string
  exerciseId: string
  approvedMove: string | null
}

export interface RunOutput {
  stdout: string
  stderr: string
  error: { message: string, line: number } | null
}

export type TurnEvent =
  | { type: 'text', author: 'teacher' | 'deskmate', delta: string }
  | { type: 'state', state: RedrawState }

export interface RedrawState {
  knowledgeMap: MapTopic[]
  workingArea: WorkingAreaView
  conversation: ConversationMessage[]
}
