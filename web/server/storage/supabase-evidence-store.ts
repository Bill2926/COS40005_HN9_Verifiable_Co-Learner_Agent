import { createClient } from '@supabase/supabase-js'
import type { EvidenceRow, EvidenceStore } from '../student-model'

const selected = 'recorded_at, student_id, module_id, exercise_id, attempt, tests_passed, tests_total, all_passed'

export function createSupabaseEvidenceStore(options: {
  url: string
  secretKey: string
}): EvidenceStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async append(evidence) {
      // attempt is filled by the table's trigger and all_passed is a generated
      // column, so neither can disagree with the rest of the row.
      const result = await supabase
        .from('evidence')
        .insert({
          student_id: evidence.studentId,
          module_id: evidence.moduleId,
          exercise_id: evidence.exerciseId,
          tests_passed: evidence.testsPassed,
          tests_total: evidence.testsTotal,
        })
        .select(selected)
        .single()
      if (result.error) throw new Error(result.error.message)
      return presentEvidence(result.data)
    },
    async forStudent(studentId) {
      // The estimate reads the ledger in the order it was written.
      const result = await supabase
        .from('evidence')
        .select(selected)
        .eq('student_id', studentId)
        .order('recorded_at', { ascending: true })
        .order('id', { ascending: true })
      if (result.error) throw new Error(result.error.message)
      return (result.data ?? []).map(presentEvidence)
    },
  }
}

interface EvidenceRecord {
  recorded_at: string
  student_id: string
  module_id: string
  exercise_id: string
  attempt: number
  tests_passed: number
  tests_total: number
  all_passed: boolean
}

function presentEvidence(row: EvidenceRecord): EvidenceRow {
  return {
    time: row.recorded_at,
    studentId: row.student_id,
    moduleId: row.module_id,
    exerciseId: row.exercise_id,
    attempt: row.attempt,
    testsPassed: row.tests_passed,
    testsTotal: row.tests_total,
    allPassed: row.all_passed,
  }
}
