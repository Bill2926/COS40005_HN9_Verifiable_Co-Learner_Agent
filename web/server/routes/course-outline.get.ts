import { defaultCourseId } from '../course'
import { createSupabaseCourseStore } from '../storage/supabase-course-store'

// The public outline of the course for the About page: names and parts only,
// nothing about any student, and none of the course's teacher-only content.
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const course = await createSupabaseCourseStore({
    url: config.public.supabaseUrl,
    secretKey: config.supabaseSecretKey,
  }).course(defaultCourseId)
  return {
    title: course.title,
    modules: course.modules.map(({ number, name, part, summary, available }) => ({ number, name, part, summary, available })),
  }
})
