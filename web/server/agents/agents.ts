import type { TurnTools } from '../agent-tools'
import type { DeskmateContext, TeacherContext } from './contexts'
import type { Move } from './moves'

export interface Agent<Context> {
  // The move this agent wants to make, or null to stay quiet. `tools` are the turn's tools the agent
  // may call first; an agent that uses none ignores them.
  propose: (context: Context, tools?: TurnTools) => Promise<Move | null>
  // The words for a move the VerifyShield has approved, as they arrive.
  render: (context: Context, move: Move) => AsyncIterable<string>
}

// What the turn handler calls: the Teacher and the Deskmate.
export interface Agents {
  teacher: Agent<TeacherContext>
  deskmate: Agent<DeskmateContext>
}

// What the scripted agents in fake-agents.ts record about each call.
export type AgentExchange =
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
