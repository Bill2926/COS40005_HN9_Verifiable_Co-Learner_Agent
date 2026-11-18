import { createClient } from '@supabase/supabase-js'
import type { MasteryStore, StoredMastery } from '../student-model'

// The stored copy of mastery (ADR 0008). The server holds the only key that can read or write it,
// and a save replaces the student's whole picture so a module the course no longer has leaves no row.
export function createSupabaseMasteryStore({ url, secretKey, courseId }: {
  url: string
  secretKey: string
  courseId: string
}): MasteryStore {
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function forStudent(studentId: string): Promise<StoredMastery[]> {
    const result = await supabase.from('module_masteries')
      .select('module_id, mastery, passed_exercise, ever_mastered')
      .eq('course_id', courseId).eq('student_id', studentId)
    if (result.error) throw new Error(result.error.message)
    return result.data.map(row => ({
      moduleId: row.module_id,
      mastery: row.mastery,
      passedExercise: row.passed_exercise,
      everMastered: row.ever_mastered,
    }))
  }

  return {
    forStudent,
    async save(studentId, masteries) {
      const removed = await supabase.from('module_masteries').delete()
        .eq('course_id', courseId).eq('student_id', studentId)
      if (removed.error) throw new Error(removed.error.message)
      if (masteries.length > 0) {
        const inserted = await supabase.from('module_masteries').insert(masteries.map(item => ({
          student_id: studentId,
          course_id: courseId,
          module_id: item.moduleId,
          mastery: item.mastery,
          passed_exercise: item.passedExercise,
          ever_mastered: item.everMastered,
        })))
        if (inserted.error) throw new Error(inserted.error.message)
      }
      return forStudent(studentId)
    },
  }
}
