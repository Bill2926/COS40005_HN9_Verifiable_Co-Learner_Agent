import { createClient } from '@supabase/supabase-js'
import type { StudentFileStore } from './student-file-store'

const bucket = 'student-files'
const signedForSeconds = 60 * 60

export function createSupabaseStudentFileStore(options: { url: string, secretKey: string }): StudentFileStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async put(studentId, path, file) {
      const result = await supabase.storage.from(bucket).upload(`${studentId}/${path}`, file.bytes, {
        contentType: file.contentType,
        upsert: true,
      })
      if (result.error) throw new Error(result.error.message)
    },
    async url(studentId, path) {
      const result = await supabase.storage.from(bucket).createSignedUrl(`${studentId}/${path}`, signedForSeconds)
      if (result.error) return null
      return result.data.signedUrl
    },
  }
}
