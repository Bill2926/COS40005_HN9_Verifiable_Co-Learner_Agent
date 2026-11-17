import { createClient } from '@supabase/supabase-js'
import { activityPayload, type ActivityRecorder } from '../activity-recorder'

export function createSupabaseActivityLog(options: { url: string, secretKey: string }): ActivityRecorder {
  const supabase = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    async record(event) {
      const result = await supabase.from('activity_log').insert({
        student_id: event.studentId,
        course_id: event.courseId,
        event_type: event.type,
        payload: activityPayload(event.payload),
      })
      if (result.error) throw new Error(result.error.message)
    },
  }
}
