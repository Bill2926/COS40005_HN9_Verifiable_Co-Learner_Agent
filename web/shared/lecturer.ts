export interface CourseHistoryEntry {
  action: string
  actorEmail: string
  time: string
  previousThreshold?: number
  masteryThreshold?: number
}

export interface LecturerCourse {
  id: string
  title: string
  enrolledCount: number
  masteryThreshold: number
  history: CourseHistoryEntry[]
}

export interface LecturerResponse {
  courses: LecturerCourse[]
}
