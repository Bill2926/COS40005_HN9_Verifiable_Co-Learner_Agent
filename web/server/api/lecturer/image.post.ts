import { staffSessionEmail } from '../../auth/staff-session-email'
import { handleCourseImage } from '../../lecturer/handle-lecturer'
import { createSupabaseCourseImageStore } from '../../storage/supabase-course-image-store'
import { createSupabaseLecturerStore } from '../../storage/supabase-lecturer-store'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const config = useRuntimeConfig(event)
  const options = { url: config.public.supabaseUrl, secretKey: config.supabaseSecretKey }
  const body = await readBody(event) as { courseId?: unknown, image?: unknown } | null
  return handleCourseImage({
    email: await staffSessionEmail(event),
    lecturerEmails: config.lecturerEmails,
    store: createSupabaseLecturerStore(options),
    images: createSupabaseCourseImageStore(options),
    courseId: body?.courseId,
    image: body?.image,
  })
})
