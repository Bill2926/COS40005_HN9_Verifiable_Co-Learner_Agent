import { createClient } from '@supabase/supabase-js'
import type { PracticeTestResult } from '../../shared/turn'
import {
  SubmissionNotFoundError,
  SubmissionRefusedError,
  type StoredSubmission,
  type SubmissionOutcome,
  type SubmissionStore,
} from './submission-store'

const selected = 'id, student_id, module_id, exercise_id, code, results, outcome, message, findings, created_at'

// Scoped to one course: it reads and writes only that course's rows.
export function createSupabaseSubmissionStore(options: {
  url: string
  secretKey: string
  courseId: string
}): SubmissionStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async record(submission) {
      const result = await supabase
        .from('submissions')
        .insert({
          id: crypto.randomUUID(),
          student_id: submission.studentId,
          course_id: options.courseId,
          module_id: submission.moduleId,
          exercise_id: submission.exerciseId,
          code: submission.code,
          results: submission.results,
          outcome: submission.outcome,
          message: submission.message,
          findings: submission.findings,
        })
        .select(selected)
        .single()
      if (result.error) throw new Error(result.error.message)
      return present(result.data)
    },
    async forStudent(studentId) {
      const result = await supabase
        .from('submissions')
        .select(selected)
        .eq('student_id', studentId)
        .eq('course_id', options.courseId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
      if (result.error) throw new Error(result.error.message)
      return result.data.map(present)
    },
    async read(readerId, submissionId) {
      const result = await supabase
        .from('submissions')
        .select(selected)
        .eq('id', submissionId)
        .eq('course_id', options.courseId)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      if (!result.data) throw new SubmissionNotFoundError()
      if (result.data.student_id !== readerId) throw new SubmissionRefusedError()
      return present(result.data)
    },
    async latestForExercise(studentId, moduleId, exerciseId) {
      const result = await supabase
        .from('submissions')
        .select(selected)
        .eq('student_id', studentId)
        .eq('course_id', options.courseId)
        .eq('module_id', moduleId)
        .eq('exercise_id', exerciseId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      return result.data ? present(result.data) : null
    },
  }
}

interface SubmissionRecord {
  id: string
  student_id: string
  module_id: string
  exercise_id: string
  code: string
  results: PracticeTestResult[]
  outcome: SubmissionOutcome
  message: string | null
  findings: string[]
  created_at: string
}

function present(row: SubmissionRecord): StoredSubmission {
  return {
    id: row.id,
    studentId: row.student_id,
    moduleId: row.module_id,
    exerciseId: row.exercise_id,
    code: row.code,
    results: row.results.map(result => ({ ...result })),
    outcome: row.outcome,
    message: row.message,
    findings: [...row.findings],
    createdAt: row.created_at,
  }
}
