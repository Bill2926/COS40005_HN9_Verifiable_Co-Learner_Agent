import { createClient } from '@supabase/supabase-js'
import type { LecturerStore } from './lecturer-store'

export function createSupabaseLecturerStore({ url, secretKey }: {
  url: string
  secretKey: string
}): LecturerStore {
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async forLecturer(email) {
      const courses = await supabase.from('courses').select('id, title')
        .eq('owner_email', email).order('title').order('id')
      if (courses.error) throw new Error(courses.error.message)

      return Promise.all(courses.data.map(async ({ id, title }) => {
        const [enrollments, history] = await Promise.all([
          supabase.from('enrollments').select('course_id', { count: 'exact', head: true }).eq('course_id', id),
          supabase.from('course_history').select('action, actor_email, recorded_at')
            .eq('course_id', id).order('recorded_at', { ascending: false }).order('id', { ascending: false }),
        ])
        if (enrollments.error) throw new Error(enrollments.error.message)
        if (history.error) throw new Error(history.error.message)
        if (enrollments.count === null) throw new Error('Enrollment count is unavailable.')
        return {
          id,
          title,
          enrolledCount: enrollments.count,
          history: history.data.map(row => ({ action: row.action, actorEmail: row.actor_email, time: row.recorded_at })),
        }
      }))
    },
  }
}
