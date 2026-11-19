import type { TurnTools } from '../agent-tools'
import type { DeskmateContext, TeacherContext } from './contexts'
import type { Move } from './moves'

// `Tools` is what an agent may call before it proposes; an agent with none takes no second argument.
export interface Agent<Context, Tools = void> {
  // The move this agent wants to make, or null to stay quiet.
  propose: (context: Context, tools: Tools) => Promise<Move | null>
  // The words for a move the VerifyShield has approved, as they arrive.
  render: (context: Context, move: Move) => AsyncIterable<string>
}

// The Teacher, who also proposes the learning plan when a module opens. The
// Deskmate never plans.
export interface Teacher extends Agent<TeacherContext, TurnTools> {
  // The plan for the module the student opened, as a propose_plan move or
  // null. The VerifyShield rules on it like any other move.
  plan: (context: TeacherContext) => Promise<Move | null>
}

// What the turn handler calls: the Teacher and the Deskmate.
export interface Agents {
  teacher: Teacher
  deskmate: Agent<DeskmateContext>
}

// What the scripted agents in fake-agents.ts record about each call.
export type AgentExchange =
  | {
    agent: 'teacher'
    phase: 'propose' | 'plan' | 'render'
    context: TeacherContext
    move: Move | null
  }
  | {
    agent: 'deskmate'
    phase: 'propose' | 'render'
    context: DeskmateContext
    move: Move | null
  }
