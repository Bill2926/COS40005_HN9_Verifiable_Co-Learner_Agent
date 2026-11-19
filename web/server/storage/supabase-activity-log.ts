import { createClient } from '@supabase/supabase-js'
import { activityPayload, type ActivityRecorder, type ActivityRow } from '../activity-recorder'

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
    async forStudent(studentId) {
      const result = await supabase
        .from('activity_log')
        .select('id, course_id, created_at, event_type, payload')
        .eq('student_id', studentId)
        .order('id', { ascending: true })
      if (result.error) throw new Error(result.error.message)
      const rows = result.data as { id: number, course_id: string | null, created_at: string, event_type: ActivityRow['type'], payload: Record<string, unknown> }[]
      return rows.map(row => ({
        id: Number(row.id),
        courseId: row.course_id,
        time: row.created_at,
        type: row.event_type,
        moduleId: typeof row.payload.moduleId === 'string' ? row.payload.moduleId : null,
        payload: { ...row.payload },
      }))
    },
  }
}
