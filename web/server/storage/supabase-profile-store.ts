import { createClient } from '@supabase/supabase-js'
import type { ProfileStore, StoredProfile } from './profile-store'

export function createSupabaseProfileStore(options: { url: string, secretKey: string }): ProfileStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function readRow(studentId: string): Promise<StoredProfile> {
    const result = await supabase.from('students')
      .select('display_name, student_number, campus, picture_path')
      .eq('id', studentId)
      .maybeSingle()
    if (result.error) throw new Error(result.error.message)
    if (!result.data?.student_number) throw new Error('That student has no profile.')
    return {
      displayName: result.data.display_name,
      studentNumber: result.data.student_number,
      campus: result.data.campus,
      picturePath: result.data.picture_path,
    }
  }

  return {
    read: readRow,
    async chooseCampus(studentId, campus) {
      const result = await supabase.rpc('choose_student_campus', { target: studentId, new_campus: campus })
      if (result.error) throw new Error(result.error.message)
      return result.data === 'chosen' ? 'chosen' : 'already-chosen'
    },
    async save(studentId, change) {
      const patch: { display_name?: string, picture_path?: string | null } = {}
      if (change.displayName !== undefined) patch.display_name = change.displayName
      if (change.picturePath !== undefined) patch.picture_path = change.picturePath
      const result = await supabase.from('students').update(patch).eq('id', studentId)
      if (result.error) throw new Error(result.error.message)
      return readRow(studentId)
    },
  }
}
