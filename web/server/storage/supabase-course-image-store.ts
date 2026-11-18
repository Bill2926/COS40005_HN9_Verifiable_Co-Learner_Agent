import { createClient } from '@supabase/supabase-js'
import type { CourseImageStore } from './course-image-store'

export const courseImageBucket = 'course-images'

export function createSupabaseCourseImageStore(options: { url: string, secretKey: string }): CourseImageStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async put(courseId, name, image) {
      const path = `${courseId}/${name}`
      const result = await supabase.storage.from(courseImageBucket).upload(path, image.bytes, {
        contentType: image.contentType,
        upsert: false,
      })
      if (result.error) throw new Error(result.error.message)
      return supabase.storage.from(courseImageBucket).getPublicUrl(path).data.publicUrl
    },
  }
}
