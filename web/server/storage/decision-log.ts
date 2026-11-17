export interface DecisionMastery {
  moduleId: string
  mastery: number
}

export interface DecisionRuleCheck {
  ruleId: string
  passed: boolean
  reasonCode: string
}

export interface DecisionRecord {
  time: string
  studentId: string
  turnId: string
  agent: 'teacher' | 'deskmate'
  proposedMove: string
  proposedScope: string | null
  verdict: 'allow' | 'block' | 'downgrade'
  ruledMove: string | null
  ruledScope: string | null
  ruleId: string
  reasonCode: string
  masteries: readonly DecisionMastery[]
  unlockedModuleIds: readonly string[]
  verifyShieldOn: boolean
  masteryThreshold: number
  // The ordered rule checks behind the verdict, ending with the deciding one.
  // Empty when the VerifyShield was off; absent on a record from before they were recorded.
  ruleChecks?: readonly DecisionRuleCheck[]
  // The agent the student addressed in this turn, null when none was (or Mai was
  // addressed while switched off). Absent on a record from before it was recorded.
  addressedAgent?: 'teacher' | 'deskmate' | null
}

export interface DecisionQuery {
  verdict?: DecisionRecord['verdict']
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
  const { ruleChecks, ...rest } = record
  return {
    ...rest,
    masteries: record.masteries.map(item => ({ ...item })),
    unlockedModuleIds: [...record.unlockedModuleIds],
    ...(ruleChecks ? { ruleChecks: ruleChecks.map(check => ({ ...check })) } : {}),
  }
}
