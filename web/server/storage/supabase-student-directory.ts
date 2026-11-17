import { createClient } from '@supabase/supabase-js'
import type { StudentDirectoryStore, StudentNumberChangeResult } from './student-directory'

export function createSupabaseStudentDirectoryStore({ url, secretKey }: {
  url: string
  secretKey: string
}): StudentDirectoryStore {
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async list() {
      const result = await supabase.from('student_directory')
        .select('id, display_name, student_number, email')
        .order('student_number')
      if (result.error) throw new Error(result.error.message)
      return result.data.map(row => ({
        id: row.id,
        displayName: row.display_name,
        studentNumber: row.student_number,
        email: row.email,
      }))
    },
    async changeNumber({ studentId, studentNumber, actorEmail }) {
      const result = await supabase.rpc('set_student_number', {
        actor_email: actorEmail,
        target: studentId,
        new_number: studentNumber,
      })
      if (result.error) throw new Error(result.error.message)
      return result.data as StudentNumberChangeResult
    },
  }
}
