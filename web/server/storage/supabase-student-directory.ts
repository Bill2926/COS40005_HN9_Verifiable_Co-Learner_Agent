import { createClient } from '@supabase/supabase-js'
import type { CampusChangeResult, DeleteStudentResult, StudentDirectoryStore, StudentNumberChangeResult } from './student-directory'

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
        .select('id, display_name, student_number, email, campus')
        .order('student_number')
      if (result.error) throw new Error(result.error.message)
      return result.data.map(row => ({
        id: row.id,
        displayName: row.display_name,
        studentNumber: row.student_number,
        email: row.email,
        campus: row.campus,
      }))
    },
    async deleteStudent(studentId) {
      // The files go first: the records name nothing that could find them afterwards.
      const files = supabase.storage.from('student-files')
      const paths: string[] = []
      for (const folder of [studentId, `${studentId}/notes`]) {
        const listed = await files.list(folder, { limit: 1000 })
        if (listed.error) throw new Error(listed.error.message)
        // A folder entry has no id; its files are listed on their own.
        paths.push(...listed.data.filter(entry => entry.id !== null).map(entry => `${folder}/${entry.name}`))
      }
      if (paths.length > 0) {
        const removed = await files.remove(paths)
        if (removed.error) throw new Error(removed.error.message)
      }
      const result = await supabase.rpc('delete_student_records', { target: studentId })
      if (result.error) throw new Error(result.error.message)
      return result.data as DeleteStudentResult
    },
    async changeCampus({ studentId, campus, actorEmail }) {
      const result = await supabase.rpc('set_student_campus', {
        actor_email: actorEmail,
        target: studentId,
        new_campus: campus,
      })
      if (result.error) throw new Error(result.error.message)
      return result.data as CampusChangeResult
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
