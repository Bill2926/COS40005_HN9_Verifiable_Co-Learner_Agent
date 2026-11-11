export interface DecisionMastery {
  moduleId: string
  mastery: number
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
  return {
    ...record,
    masteries: record.masteries.map(item => ({ ...item })),
    unlockedModuleIds: [...record.unlockedModuleIds],
  }
}
