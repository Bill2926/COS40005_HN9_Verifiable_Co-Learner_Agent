export type TopicState = 'mastered' | 'open' | 'closed'

interface MapTopicBase {
  id: string
  name: string
  summary: string
  current: boolean
}

export type MapTopic =
  | (MapTopicBase & { state: 'mastered' | 'open' })
  | (MapTopicBase & { state: 'closed'; closedReason: string })

export interface TopicMaterials {
  heading: string
  body: string
  example: string
  keyPoint: string
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
  mode: 'learn' | null
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
  openInLearn: boolean
}

export interface RunOutput {
  stdout: string
  stderr: string
  error: { message: string, line: number } | null
}

export interface PracticeTestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
}

export type TurnEvent =
  | { type: 'text', author: 'teacher' | 'deskmate', delta: string }
  | { type: 'state', state: RedrawState }

export interface TraceVerdict {
  decision: 'allow' | 'block' | 'downgrade'
  ruleId: string
  reasonCode: string
}

export interface AgentTrace {
  agent: 'teacher' | 'deskmate'
  proposal: string | null
  verdict: TraceVerdict | null
}

export interface TurnTrace {
  active: boolean
  agents: readonly [AgentTrace, AgentTrace]
}

export interface RedrawState {
  displayName: string
  course: string
  knowledgeMap: MapTopic[]
  workingArea: WorkingAreaView
  conversation: ConversationMessage[]
  trace?: TurnTrace
}
