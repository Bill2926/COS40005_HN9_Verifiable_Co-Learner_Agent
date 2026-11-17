import { createClient } from '@supabase/supabase-js'
import type { DecisionLogStore, DecisionMastery, DecisionQuery, DecisionRecord } from './decision-log'
import type { RuleCheck } from '../../shared/turn'

const studentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Scoped to one course: it reads and writes only that course's rows.
export function createSupabaseDecisionLogStore(options: {
  url: string
  secretKey: string
  courseId: string
}): DecisionLogStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async append(record) {
      const result = await supabase.from('decisions').insert({
        recorded_at: record.time,
        student_id: record.studentId,
        course_id: options.courseId,
        turn_id: record.turnId,
        agent: record.agent,
        proposed_move: record.proposedMove,
        proposed_scope: record.proposedScope,
        verdict: record.verdict,
        ruled_move: record.ruledMove,
        ruled_scope: record.ruledScope,
        rule_id: record.ruleId,
        reason_code: record.reasonCode,
        masteries: record.masteries.map(item => ({ ...item })),
        unlocked_module_ids: [...record.unlockedModuleIds],
        verify_shield_on: record.verifyShieldOn,
        mastery_threshold: record.masteryThreshold,
        rule_checks: record.ruleChecks ? record.ruleChecks.map(check => ({ ...check })) : null,
        addressed_agent: record.addressedAgent ?? null,
      })
      if (result.error) throw new Error(result.error.message)
    },
    async list(query: DecisionQuery = {}) {
      if (query.studentId && !studentIdPattern.test(query.studentId)) return []

      let request = supabase
        .from('decisions')
        .select('recorded_at, student_id, turn_id, agent, proposed_move, proposed_scope, verdict, ruled_move, ruled_scope, rule_id, reason_code, masteries, unlocked_module_ids, verify_shield_on, mastery_threshold, rule_checks, addressed_agent')
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .eq('course_id', options.courseId)
        .limit(100)
      if (query.verdict) request = request.eq('verdict', query.verdict)
      if (query.studentId) request = request.eq('student_id', query.studentId)

      const result = await request
      if (result.error) throw new Error(result.error.message)
      return (result.data ?? []).map(presentDecision)
    },
  }
}

interface DecisionRow {
  recorded_at: string
  student_id: string
  turn_id: string
  agent: string
  proposed_move: string
  proposed_scope: string | null
  verdict: string
  ruled_move: string | null
  ruled_scope: string | null
  rule_id: string
  reason_code: string
  masteries: unknown
  unlocked_module_ids: unknown
  verify_shield_on: boolean
  mastery_threshold: number
  rule_checks: unknown
  addressed_agent: string | null
}

function presentDecision(row: DecisionRow): DecisionRecord {
  if (row.agent !== 'teacher' && row.agent !== 'deskmate') {
    throw new Error('A decision row has an unexpected agent.')
  }
  if (row.verdict !== 'allow' && row.verdict !== 'block' && row.verdict !== 'downgrade') {
    throw new Error('A decision row has an unexpected verdict.')
  }
  return {
    time: row.recorded_at,
    studentId: row.student_id,
    turnId: row.turn_id,
    agent: row.agent,
    proposedMove: row.proposed_move,
    proposedScope: row.proposed_scope,
    verdict: row.verdict,
    ruledMove: row.ruled_move,
    ruledScope: row.ruled_scope,
    ruleId: row.rule_id,
    reasonCode: row.reason_code,
    masteries: masteriesFrom(row.masteries),
    unlockedModuleIds: stringsFrom(row.unlocked_module_ids),
    verifyShieldOn: row.verify_shield_on,
    masteryThreshold: row.mastery_threshold,
    // A row from before rule checks were recorded holds null: leave the field out.
    addressedAgent: row.addressed_agent === 'teacher' || row.addressed_agent === 'deskmate' ? row.addressed_agent : null,
    ...(row.rule_checks === null || row.rule_checks === undefined ? {} : { ruleChecks: ruleChecksFrom(row.rule_checks) }),
  }
}

function ruleChecksFrom(value: unknown): RuleCheck[] {
  if (!Array.isArray(value)) throw new Error('A decision row has rule checks that are not a list.')
  return value.map((item) => {
    if (
      typeof item !== 'object' || item === null
      || typeof item.ruleId !== 'string'
      || typeof item.passed !== 'boolean'
      || typeof item.reasonCode !== 'string'
    ) {
      throw new Error('A decision row has a malformed rule check.')
    }
    return { ruleId: item.ruleId, passed: item.passed, reasonCode: item.reasonCode }
  })
}

function masteriesFrom(value: unknown): DecisionMastery[] {
  if (!Array.isArray(value)) throw new Error('A decision row is missing its masteries.')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('A decision row has a mastery that is not a record.')
    if (!('moduleId' in item) || typeof item.moduleId !== 'string') {
      throw new Error('A decision row has a mastery without a module.')
    }
    if (!('mastery' in item) || typeof item.mastery !== 'number') {
      throw new Error('A decision row has a mastery that is not a number.')
    }
    return { moduleId: item.moduleId, mastery: item.mastery }
  })
}

function stringsFrom(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error('A decision row is missing its unlocked modules.')
  }
  return value
}
