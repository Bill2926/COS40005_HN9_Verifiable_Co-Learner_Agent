export interface CourseHistoryEntry {
  action: string
  actorEmail: string
  time: string
}

export interface LecturerCourse {
  id: string
  title: string
  enrolledCount: number
  history: CourseHistoryEntry[]
}

export interface LecturerResponse {
  courses: LecturerCourse[]
}
