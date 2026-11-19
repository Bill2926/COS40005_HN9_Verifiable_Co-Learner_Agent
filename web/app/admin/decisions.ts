// What the administrator's pages read from the admin endpoint, and how the
// verdict drawer turns a decision's rule checks into plain English.

import type { Campus } from '../../shared/campus'
import { agentNames, maxToolSteps, type AddressedAgent, type RuleCheck, type ToolCallRecord } from '../../shared/turn'

export type RuleCheckView = RuleCheck

export interface DecisionView {
  time: string
  studentId: string
  turnId: string
  agent: AddressedAgent
  proposedMove: string
  proposedScope: string | null
  // 'ruled' when the VerifyShield ruled on a move; 'step_cap' when the Teacher reached its step cap
  // first, which carries no verdict, rule or reason.
  outcome: 'ruled' | 'step_cap'
  verdict: 'allow' | 'block' | 'downgrade' | null
  ruledMove: string | null
  ruledScope: string | null
  ruleId: string | null
  reasonCode: string | null
  masteries: readonly { moduleId: string, mastery: number }[]
  unlockedModuleIds: readonly string[]
  verifyShieldOn: boolean
  masteryThreshold: number
  // Absent on a decision recorded before rule checks were kept.
  ruleChecks?: readonly RuleCheckView[]
  // The agent the student addressed in the turn; null when none was.
  addressedAgent?: AddressedAgent | null
  // The tools the agent called before its move. Absent on a Deskmate decision and on one recorded
  // before tool calls were kept.
  toolTrace?: readonly ToolCallRecord[]
  // The commit the server was running, and the course history entry in force.
  // Absent on a decision recorded before they were kept.
  codeVersion?: string | null
  courseHistoryId?: number | null
}

export interface ModelSettingsView {
  provider: 'real' | 'fake'
  apiKeyMask: string
  baseUrl: string
  modelName: string
  saved: boolean
}

// One answer of the connection test: whether the provider replied, how long it took, and what it said
// when it did not. The API key is never in it.
export interface ConnectionCheckView {
  ok: boolean
  ms: number
  error?: string
}

export interface ConnectionReportView {
  reply: ConnectionCheckView
  toolCall: ConnectionCheckView
}

export interface AdminStudentView {
  id: string
  displayName: string
  studentNumber: string
  email: string
  campus: Campus | null
}

export interface AdminPayload {
  model: ModelSettingsView
  verifyShieldOn: boolean
  decisions: DecisionView[]
  chain: 'verified' | 'broken'
  students: AdminStudentView[]
}

// The reason code stays the stored value; this is the only place it is worded.
const reasons: Record<string, string> = {
  VERIFYSHIELD_OFF: 'VerifyShield was off, so the move was allowed unchecked.',
  NO_PLACEMENT: 'The turn had no module or exercise to rule against.',
  ALL_RULES_PASSED: 'Every rule passed, so the move was allowed.',
  ROLE_PERMITTED: 'The role table lets this agent make this move.',
  ROLE_FORBIDDEN: 'The role table does not let this agent make this move.',
  NO_CLOSED_KEYWORD: 'The student\'s message names no closed module and nothing out of course.',
  OUT_OF_COURSE_KEYWORD: 'The student\'s message names something outside the course.',
  MODULE_CLOSED_KEYWORD: 'The student\'s message names a module that is still closed.',
  IN_COURSE: 'The move is about a module of this course.',
  OUT_OF_COURSE: 'The move is about something outside the course.',
  SCOPE_UNKNOWN: 'The move names a module the course does not have.',
  MODULE_UNLOCKED: 'The move is about a module the student has unlocked.',
  MODULE_CLOSED: 'The move is about a module the student has not unlocked yet.',
  MODULE_KNOWN: 'The suggested module is part of the course.',
  ADVANCE_UNKNOWN_MODULE: 'The suggested module is not part of the course.',
  NOT_CURRENT_MODULE: 'The suggested module is not the one the student is already in.',
  ADVANCE_TO_CURRENT: 'The suggested module is the one the student is already in.',
  MISCONCEPTION_SHOWN: 'The student\'s code or quiz answers show the misconception.',
  MISCONCEPTION_NOT_SHOWN: 'Nothing the student did shows the misconception.',
  HINT_IN_ORDER: 'The hint is at most one rung above the last one given.',
  HINT_SKIPPED: 'The hint skipped a rung of the hint ladder.',
}

export function reasonText(reasonCode: string): string {
  return reasons[reasonCode] ?? reasonCode
}

// What the decision table shows in the verdict column: the verdict (with a downgrade's move), or
// the step cap, which is not a verdict.
export function outcomeText(decision: Pick<DecisionView, 'outcome' | 'verdict' | 'ruledMove' | 'ruledScope'>): string {
  if (decision.outcome === 'step_cap' || !decision.verdict) return 'step cap'
  if (decision.verdict !== 'downgrade' || !decision.ruledMove) return decision.verdict
  const scope = decision.ruledScope ? ` · ${decision.ruledScope}` : ''
  return `downgrade → ${decision.ruledMove}${scope}`
}

const stepCapNote = `The Teacher reached its ${maxToolSteps}-step limit before proposing a move, so it said nothing and the VerifyShield had nothing to rule on.`

export interface DrawerCheck {
  ruleId: string
  passed: boolean
  reason: string
  deciding: boolean
}

export function drawerChecks(decision: Pick<DecisionView, 'outcome' | 'ruleId' | 'reasonCode' | 'verdict' | 'verifyShieldOn' | 'ruleChecks'>): {
  note: string | null
  checks: DrawerCheck[]
} {
  if (decision.outcome === 'step_cap' || decision.ruleId === null || decision.reasonCode === null) {
    return { note: stepCapNote, checks: [] }
  }
  if (!decision.verifyShieldOn) {
    return { note: 'VerifyShield was off, no rules were checked.', checks: [] }
  }
  if (decision.ruleChecks === undefined) {
    return {
      note: 'Earlier rule checks were not recorded for this decision.',
      checks: [{
        ruleId: decision.ruleId,
        passed: decision.verdict === 'allow',
        reason: reasonText(decision.reasonCode),
        deciding: true,
      }],
    }
  }
  const last = decision.ruleChecks.length - 1
  return {
    note: null,
    checks: decision.ruleChecks.map((check, index) => ({
      ruleId: check.ruleId,
      passed: check.passed,
      reason: reasonText(check.reasonCode),
      deciding: index === last,
    })),
  }
}

export interface ToolCallView {
  name: string
  // The input the model gave, as JSON.
  input: string
  summary: string
}

// The tools an agent called before its move, in order, as the decision review shows them.
export function toolCallsView(decision: Pick<DecisionView, 'toolTrace'>): { note: string | null, calls: ToolCallView[] } {
  if (decision.toolTrace === undefined) return { note: 'Tool calls were not recorded for this decision.', calls: [] }
  if (decision.toolTrace.length === 0) return { note: 'No tools were called.', calls: [] }
  return {
    note: null,
    calls: decision.toolTrace.map(call => ({ name: call.name, input: JSON.stringify(call.input), summary: call.summary })),
  }
}

// The agent the student addressed with an `@` tag, as the drawer words it. A
// record from before it was kept reads as not recorded.
export function addressedText(agent: DecisionView['addressedAgent']): string {
  if (agent === undefined) return 'not recorded'
  if (agent === null) return 'no one'
  return `@${agentNames[agent]}`
}

// The agent behind a decision, named as the student sees it.
export function agentText(agent: AddressedAgent): string {
  return agentNames[agent]
}

// The commit recorded on a decision. One from before code versions were kept reads as not recorded.
export function codeVersionText(version: string | null | undefined): string {
  return version ? version : 'not recorded'
}

// The course history entry in force when the decision was recorded.
export function courseHistoryText(id: number | null | undefined): string {
  return id == null ? 'not recorded' : String(id)
}
