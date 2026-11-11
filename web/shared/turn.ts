export type ModuleState = 'mastered' | 'open' | 'closed'

interface RoadmapModuleBase {
  id: string
  name: string
  summary: string
  current: boolean
}

export type RoadmapModule =
  | (RoadmapModuleBase & { state: 'mastered' | 'open' })
  | (RoadmapModuleBase & { state: 'closed'; closedReason: string })

export interface ModuleMaterials {
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
  moduleId: string
  moduleName: string
  materials: ModuleMaterials
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
  scope: string | null
  verdict: TraceVerdict | null
}

export interface TraceMastery {
  moduleId: string
  mastery: number
}

export interface TurnTrace {
  active: boolean
  verifyShieldOn: boolean
  masteries: readonly TraceMastery[]
  unlockedModuleIds: readonly string[]
  agents: readonly [AgentTrace, AgentTrace]
}

export interface RedrawState {
  displayName: string
  course: string
  courseRoadmap: RoadmapModule[]
  workingArea: WorkingAreaView
  conversation: ConversationMessage[]
  trace?: TurnTrace
}
