import { createClient } from '@supabase/supabase-js'

// Who is learning a course. A change to the course itself reaches all of them at once (ADR 0008),
// because every one of them has a stored mastery derived from its modules, exercises and questions.
export interface EnrollmentStore {
  enrolledStudentIds: (courseId: string) => Promise<string[]>
}

export function createSupabaseEnrollmentStore({ url, secretKey }: {
  url: string
  secretKey: string
}): EnrollmentStore {
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async enrolledStudentIds(courseId) {
      const result = await supabase.from('enrollments').select('student_id')
        .eq('course_id', courseId).order('student_id')
      if (result.error) throw new Error(result.error.message)
      return result.data.map(row => row.student_id)
    },
  }
}
