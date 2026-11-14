import { pythonCourse, type Course } from '../course'

// Where the server reads a course from. The Supabase version reads the stored course spec; this
// in-memory version serves tests and holds the Python course unless it is given others.
export interface CourseStore {
  // Throws when there is no course with that id: every caller names a course that exists.
  course(courseId: string): Promise<Course>
}

export function createMemoryCourseStore(courses: readonly Course[] = [pythonCourse]): CourseStore {
  return {
    async course(courseId) {
      const found = courses.find(course => course.id === courseId)
      if (!found) throw new Error(`There is no course ${courseId}.`)
      return found
    },
  }
}
