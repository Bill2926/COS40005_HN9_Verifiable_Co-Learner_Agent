import { createClient } from '@supabase/supabase-js'
import type { UnlockStore } from '../student-model'

export function createSupabaseUnlockStore({ url, secretKey, courseId }: {
  url: string
  secretKey: string
  courseId: string
}): UnlockStore {
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function forStudent(studentId: string): Promise<string[]> {
    const result = await supabase.from('module_unlocks').select('module_id')
      .eq('course_id', courseId).eq('student_id', studentId)
    if (result.error) throw new Error(result.error.message)
    return result.data.map(row => row.module_id)
  }

  return {
    forStudent,
    async record(studentId, moduleIds) {
      const result = await supabase.from('module_unlocks')
        .upsert(moduleIds.map(moduleId => ({ student_id: studentId, course_id: courseId, module_id: moduleId })), {
          onConflict: 'student_id,course_id,module_id',
          ignoreDuplicates: true,
        })
      if (result.error) throw new Error(result.error.message)
      return forStudent(studentId)
    },
  }
}
