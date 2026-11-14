import { createClient } from '@supabase/supabase-js'
import { mergeObservations, type EvidenceRow, type EvidenceStore, type TimedObservation } from '../student-model'
import { createSupabaseQuizAnswerStore } from './supabase-quiz-answer-store'

const selected = 'recorded_at, student_id, module_id, exercise_id, attempt, tests_passed, tests_total, all_passed'

// Scoped to one course: it reads and writes only that course's rows.
export function createSupabaseEvidenceStore(options: {
  url: string
  secretKey: string
  courseId: string
}): EvidenceStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const quizAnswers = createSupabaseQuizAnswerStore(options)

  async function submissionsForStudent(studentId: string): Promise<TimedObservation[]> {
    const submissions: TimedObservation[] = []
    const pageSize = 500
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from('evidence').select(selected)
        .eq('student_id', studentId)
        .eq('course_id', options.courseId)
        .order('recorded_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (result.error) throw new Error(result.error.message)
      submissions.push(...result.data.map((row): TimedObservation => ({
        kind: 'submission', time: row.recorded_at, moduleId: row.module_id,
        exerciseId: row.exercise_id, allPassed: row.all_passed,
      })))
      if (result.data.length < pageSize) return submissions
    }
  }

  return {
    async append(evidence) {
      // attempt is filled by the table's trigger and all_passed is a generated
      // column, so neither can disagree with the rest of the row.
      const result = await supabase
        .from('evidence')
        .insert({
          student_id: evidence.studentId,
          course_id: options.courseId,
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
      const [submissions, answers] = await Promise.all([
        submissionsForStudent(studentId),
        quizAnswers.observationsForStudent(studentId),
      ])
      return mergeObservations(submissions, answers)
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
