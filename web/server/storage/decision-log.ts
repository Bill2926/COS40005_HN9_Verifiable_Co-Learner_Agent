import type { AddressedAgent, RuleCheck, ToolCallRecord } from '../../shared/turn'
import type { LearningPattern } from '../learning-pattern'

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
  // The commit the server was running, and the course history entry in force.
  // Absent on a decision recorded before they were kept.
  codeVersion?: string | null
  courseHistoryId?: number | null
  // The module the decision's turn was placed on. Absent on a row from before it was recorded.
  moduleId?: string
  // The learning pattern the Teacher saw this turn, a snapshot for audit. Absent
  // on a row from before it was recorded.
  learningPattern?: LearningPattern
}

export interface DecisionQuery {
  verdict?: NonNullable<DecisionRecord['verdict']>
  studentId?: string
}

// What the administrator sees of the hash chain: the hashes themselves stay in the database.
export type DecisionChain = 'verified' | 'broken'

export interface DecisionLogStore {
  append(record: DecisionRecord): Promise<void>
  list(query?: DecisionQuery): Promise<DecisionRecord[]>
  // Verified when every stored decision still matches its own hash and the decision before it.
  chain(): Promise<DecisionChain>
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
    // The in-memory log has no edit, so its chain is intact. The database is what an edit can break.
    async chain() {
      return 'verified'
    },
  }
}

function copyDecision(record: DecisionRecord): DecisionRecord {
  const { ruleChecks, toolTrace, learningPattern, ...rest } = record
  return {
    ...rest,
    ...(toolTrace ? { toolTrace: toolTrace.map(call => ({ ...call })) } : {}),
    masteries: record.masteries.map(item => ({ ...item })),
    unlockedModuleIds: [...record.unlockedModuleIds],
    ...(ruleChecks ? { ruleChecks: ruleChecks.map(check => ({ ...check })) } : {}),
    ...(learningPattern ? { learningPattern: copyPattern(learningPattern) } : {}),
  }
}

function copyPattern(pattern: LearningPattern): LearningPattern {
  return {
    weakSpots: pattern.weakSpots.map(spot => ({ ...spot })),
    recurringErrors: pattern.recurringErrors.map(error => ({ ...error })),
    exerciseAttempts: pattern.exerciseAttempts.map(attempts => ({ ...attempts })),
    hintRungs: pattern.hintRungs.map(rungs => ({ moduleId: rungs.moduleId, rungs: [...rungs.rungs] })),
    materialsSeconds: pattern.materialsSeconds.map(seconds => ({ ...seconds })),
  }
}
