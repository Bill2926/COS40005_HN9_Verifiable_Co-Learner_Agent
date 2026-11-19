import { createClient } from '@supabase/supabase-js'
import type { StudySuggestionStore } from './study-suggestion-store'

// Scoped to one course: it reads and writes only that course's rows.
export function createSupabaseStudySuggestionStore(options: {
  url: string
  secretKey: string
  courseId: string
}): StudySuggestionStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async dismissed(studentId) {
      const result = await supabase
        .from('study_suggestion_dismissals')
        .select('step, anchor')
        .eq('student_id', studentId)
        .eq('course_id', options.courseId)
      if (result.error) throw new Error(result.error.message)
      const rows = result.data as { step: string, anchor: number }[]
      return new Map(rows.map(row => [row.step, Number(row.anchor)]))
    },
    async dismiss(studentId, identity, anchor) {
      const result = await supabase.from('study_suggestion_dismissals').upsert({
        student_id: studentId,
        course_id: options.courseId,
        step: identity,
        anchor,
        dismissed_at: new Date().toISOString(),
      }, { onConflict: 'student_id,course_id,step' })
      if (result.error) throw new Error(result.error.message)
    },
  }
}
