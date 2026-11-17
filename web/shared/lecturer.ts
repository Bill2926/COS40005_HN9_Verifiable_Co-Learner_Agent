export interface CourseHistoryEntry {
  action: string
  actorEmail: string
  time: string
  previousThreshold?: number
  masteryThreshold?: number
}

export interface LecturerStudent {
  displayName: string
  studentNumber: string
  email: string
  enrolledAt: string
}

export interface LecturerCourse {
  id: string
  title: string
  enrolledCount: number
  masteryThreshold: number
  history: CourseHistoryEntry[]
  students: LecturerStudent[]
}

export interface LecturerResponse {
  courses: LecturerCourse[]
}
