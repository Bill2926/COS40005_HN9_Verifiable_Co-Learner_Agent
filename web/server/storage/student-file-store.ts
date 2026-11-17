// Profile pictures. The path is relative to the student, so one
// student cannot address another's file by passing a different path.

export interface StudentFile {
  bytes: Uint8Array
  contentType: string
}

export interface StudentFileStore {
  put: (studentId: string, path: string, file: StudentFile) => Promise<void>
  url: (studentId: string, path: string) => Promise<string | null>
}

export function createMemoryStudentFileStore(): StudentFileStore {
  const files = new Map<string, StudentFile>()
  const key = (studentId: string, path: string) => `${studentId}/${path}`
  return {
    async put(studentId, path, file) {
      files.set(key(studentId, path), { bytes: file.bytes, contentType: file.contentType })
    },
    async url(studentId, path) {
      return files.has(key(studentId, path)) ? `memory:${key(studentId, path)}` : null
    },
  }
}
