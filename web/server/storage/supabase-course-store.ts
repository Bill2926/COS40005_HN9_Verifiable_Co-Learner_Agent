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
        .select('spec, legacy_unlocks_before, legacy_unlock_threshold')
        .eq('id', courseId)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      if (!result.data) throw new Error(`There is no course ${courseId}.`)
      // Only the server writes this column, from a spec it has built or checked, so it is read as
      // one. courseFromSpec still refuses a spec the server could not run.
      const course = courseFromSpec(result.data.spec as CourseSpec)
      if (result.data.legacy_unlocks_before && result.data.legacy_unlock_threshold !== null) {
        course.legacyUnlocks = {
          before: result.data.legacy_unlocks_before,
          threshold: result.data.legacy_unlock_threshold,
        }
      }
      return course
    },
  }
}
