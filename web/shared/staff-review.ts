import type { Campus } from './campus'
import type { PracticeTestResult } from './turn'

// What the staff review page shows about one student. Staff read it; a student
// never does. Review signals are worked out when the page opens and are never
// stored (ADR 0009).

export interface ReviewedStudent {
  displayName: string
  studentNumber: string
  campus: Campus | null
  email: string
}

export interface ReviewEvent {
  id: number
  type: string
  time: string
  payload: Record<string, unknown>
}

export interface ReviewSubmission {
  id: string
  moduleId: string
  exerciseId: string
  code: string
  results: PracticeTestResult[]
  outcome: 'passed' | 'failed' | 'refused'
  message: string | null
  time: string
}

export interface ReviewMessage {
  id: string
  sequence: number
  author: 'student' | 'teacher' | 'deskmate' | 'event'
  text: string
  exerciseId: string
  time: string | null
}

export interface ReviewConversation {
  moduleId: string
  messages: ReviewMessage[]
}

export type ReviewSignalKind = 'large_paste_then_pass' | 'pass_without_run'

// Something for a person to look at. It never says what the student meant.
export interface ReviewSignal {
  kind: ReviewSignalKind
  moduleId: string | null
  exerciseId: string
  summary: string
  // The activity events behind it, oldest first, so the page can link to each.
  eventIds: number[]
}

export interface StaffReview {
  student: ReviewedStudent
  courseId: string
  // The most recent activity, newest first.
  activity: ReviewEvent[]
  submissions: ReviewSubmission[]
  conversations: ReviewConversation[]
  signals: ReviewSignal[]
}

export interface StaffAccessEntry {
  id: number
  time: string
  actorEmail: string
  actorRole: 'administrator' | 'lecturer'
  studentId: string
  studentNumber: string | null
  opened: 'student_review'
}
