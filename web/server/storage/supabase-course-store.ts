import { createClient } from '@supabase/supabase-js'
import { courseFromSpec, type CourseSpec } from '../course'
import type { CourseStore } from './course-store'

// Reads a course's stored spec with the secret key; no student role can read the courses table.
// The spec is read on every call, so a lecturer's import applies on the student's next request.
export function createSupabaseCourseStore(options: {
  url: string
  secretKey: string
}): CourseStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async course(courseId) {
      const result = await supabase
        .from('courses')
        .select('spec')
        .eq('id', courseId)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      if (!result.data) throw new Error(`There is no course ${courseId}.`)
      // Only the server writes this column, from a spec it has built or checked, so it is read as
      // one. courseFromSpec still refuses a spec the server could not run.
      return courseFromSpec(result.data.spec as CourseSpec)
    },
  }
}
