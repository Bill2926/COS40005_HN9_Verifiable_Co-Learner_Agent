// Images a lecturer uploads into course materials. The path is relative to
// the course, so one course cannot address another's file.

export interface CourseImage {
  bytes: Uint8Array
  contentType: string
}

export interface CourseImageStore {
  // Stores the image and returns the address a student's browser loads it from.
  put: (courseId: string, name: string, image: CourseImage) => Promise<string>
}

export function createMemoryCourseImageStore(): CourseImageStore & { files: Map<string, CourseImage> } {
  const files = new Map<string, CourseImage>()
  return {
    files,
    async put(courseId, name, image) {
      const key = `${courseId}/${name}`
      files.set(key, { bytes: image.bytes, contentType: image.contentType })
      return `memory:${key}`
    },
  }
}
