// The agents component's interface: the Teacher and the Deskmate as the course defines them.
// `Agents` is what the turn handler calls. `agentsForTurn` builds them for a turn, on the real language
// model or on scripted replies; `createAgents` builds them on a language model you supply.
// `roleTable` says which moves each agent may propose; the VerifyShield rules against it.
// The prompts stay behind this file.
export { moveKey, moveTypes } from './moves'
export type { Move, MoveType } from './moves'
export type { DeskmateContext, SubmissionCheck, TeacherContext } from './contexts'
export type { Agent, AgentExchange, Agents } from './agents'
export { createAgents } from './create-agents'
export { createFakeAgents } from './fake-agents'
export type { FakeAgentScript } from './fake-agents'
export { agentsForTurn, createConfiguredAgents } from './configured-agents'
export { roleTable } from './role-table'
export type { RoleTable } from './role-table'
