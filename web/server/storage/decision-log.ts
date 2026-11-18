import type { AddressedAgent, RuleCheck, ToolCallRecord } from '../../shared/turn'

export interface DecisionMastery {
  moduleId: string
  mastery: number
}

// How a decision ended: the VerifyShield ruled on a proposed move, or the agent reached its step
// cap before proposing one, so there was nothing to rule on.
export type DecisionOutcome = 'ruled' | 'step_cap'

export interface DecisionRecord {
  time: string
  studentId: string
  turnId: string
  agent: AddressedAgent
  proposedMove: string
  proposedScope: string | null
  outcome: DecisionOutcome
  // The VerifyShield's ruling: null, with no rule or reason, when the outcome is a step cap.
  verdict: 'allow' | 'block' | 'downgrade' | null
  ruledMove: string | null
  ruledScope: string | null
  ruleId: string | null
  reasonCode: string | null
  masteries: readonly DecisionMastery[]
  unlockedModuleIds: readonly string[]
  verifyShieldOn: boolean
  masteryThreshold: number
  // The ordered rule checks behind the verdict, ending with the deciding one.
  // Empty when the VerifyShield was off; absent on a record from before they were recorded.
  ruleChecks?: readonly RuleCheck[]
  // The agent the student addressed in this turn, null when none was (or Mai was
  // addressed while switched off). Absent on a record from before it was recorded.
  addressedAgent?: AddressedAgent | null
  // The tools the agent called before this move, in order. Absent on a Deskmate decision and on a
  // record from before tool calls were recorded.
  toolTrace?: readonly ToolCallRecord[]
}

export interface DecisionQuery {
  verdict?: NonNullable<DecisionRecord['verdict']>
  studentId?: string
}

export interface DecisionLogStore {
  append(record: DecisionRecord): Promise<void>
  list(query?: DecisionQuery): Promise<DecisionRecord[]>
}

export function createMemoryDecisionLogStore(): DecisionLogStore {
  const records: DecisionRecord[] = []

  return {
    async append(record) {
      records.push(copyDecision(record))
    },
    async list(query: DecisionQuery = {}) {
      return records
        .map((record, index) => ({ record, index }))
        .filter((item) => {
          if (query.verdict && item.record.verdict !== query.verdict) return false
          if (query.studentId && item.record.studentId !== query.studentId) return false
          return true
        })
        .sort((left, right) => {
          if (left.record.time !== right.record.time) return left.record.time < right.record.time ? 1 : -1
          return right.index - left.index
        })
        .slice(0, 100)
        .map(item => copyDecision(item.record))
    },
  }
}

function copyDecision(record: DecisionRecord): DecisionRecord {
  const { ruleChecks, toolTrace, ...rest } = record
  return {
    ...rest,
    ...(toolTrace ? { toolTrace: toolTrace.map(call => ({ ...call })) } : {}),
    masteries: record.masteries.map(item => ({ ...item })),
    unlockedModuleIds: [...record.unlockedModuleIds],
    ...(ruleChecks ? { ruleChecks: ruleChecks.map(check => ({ ...check })) } : {}),
  }
}
