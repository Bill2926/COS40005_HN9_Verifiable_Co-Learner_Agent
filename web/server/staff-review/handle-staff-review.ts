import type { ReviewEvent, ReviewPlan, StaffReview } from '../../shared/staff-review'
import type { StaffAccessLog, StaffAccessRole } from '../storage/staff-access-log'
import type { StaffReviewStore } from '../storage/staff-review-store'
import { defaultCourseId, type Course } from '../course'
import { gatherLearningPattern, type LearningPatternSources } from '../learning-pattern/gather'
import { planStepTitle, type LearningPlan } from '../learning-plan'
import type { CourseStore } from '../storage/course-store'
import { staffRole } from '../staff/staff-role'
import { reviewSignals } from './review-signals'

// The most recent activity the page lists. The signals are worked out from all of it.
export const latestActivityShown = 100

export class StaffReviewError extends Error {
  constructor(readonly statusCode: 401 | 403 | 404, message: string) {
    super(message)
    this.name = 'StaffReviewError'
  }
}

export interface StaffReviewRequest {
  email: string | null
  adminEmails: string
  lecturerEmails: string
  studentNumber: string
  store: StaffReviewStore
  accessLog: StaffAccessLog
  courses: CourseStore
  // The stores the learning pattern is read through, scoped to the course being reviewed.
  patternSources: (courseId: string) => LearningPatternSources
}

// One student's records for a member of staff. An administrator may open any
// student; a lecturer only a student enrolled in a course they own; a student
// or a caller with no session none. The opening is written to the staff access
// log before any record is read, so a record is never handed over unlogged.
export async function handleStaffReview(request: StaffReviewRequest): Promise<StaffReview> {
  const email = request.email?.trim().toLowerCase() ?? ''
  if (email === '') throw new StaffReviewError(401, 'Sign in required')
  const role = staffRole({ email, adminEmails: request.adminEmails, lecturerEmails: request.lecturerEmails })
  if (!role.productOwner && !role.lecturer) throw new StaffReviewError(403, 'Staff access required')

  const student = await request.store.studentByNumber(request.studentNumber.trim())
  let actorRole: StaffAccessRole
  let courseId: string
  if (role.productOwner) {
    if (!student) throw new StaffReviewError(404, 'Student not found')
    actorRole = 'administrator'
    // The Python course is the only course in sprint 2.
    courseId = defaultCourseId
  }
  else {
    // A student who does not exist and one who is not theirs are refused alike.
    const owned = student ? await request.store.ownedCourseOf(email, student.id) : null
    if (!student || owned === null) throw new StaffReviewError(403, 'That student is not enrolled in a course you own')
    actorRole = 'lecturer'
    courseId = owned
  }

  await request.accessLog.record({ actorEmail: email, actorRole, studentId: student.id, courseId, opened: 'student_review' })

  const course = await request.courses.course(courseId)
  const [events, submissions, conversations, plans, learningPattern] = await Promise.all([
    request.store.activity(student.id, courseId),
    request.store.submissions(student.id, courseId),
    request.store.conversations(student.id, courseId),
    request.store.learningPlans(student.id, courseId),
    gatherLearningPattern(request.patternSources(courseId), student.id, course),
  ])
  const signals = reviewSignals(events)
  return {
    student: { displayName: student.displayName, studentNumber: student.studentNumber, campus: student.campus, email: student.email },
    courseId,
    activity: listedActivity(events, signals.flatMap(signal => signal.eventIds)),
    submissions,
    conversations,
    signals,
    plans: reviewPlans(plans, course),
    learningPattern,
  }
}

// The plans by module, every revision of each, oldest first, with each step in words.
function reviewPlans(revisions: readonly LearningPlan[], course: Course): ReviewPlan[] {
  const byModule = new Map<string, ReviewPlan>()
  for (const plan of [...revisions].sort((left, right) => left.revision - right.revision)) {
    const module = course.studyModules.find(candidate => candidate.id === plan.moduleId)
    const entry = byModule.get(plan.moduleId) ?? { moduleId: plan.moduleId, revisions: [] }
    entry.revisions.push({
      revision: plan.revision,
      steps: plan.steps.map(step => ({
        kind: step.kind,
        title: (module ? planStepTitle(step, module) : '') || (step.ref === '' ? step.kind : `${step.kind} ${step.ref}`),
      })),
      currentStep: plan.currentStep,
      agreedAt: plan.agreedAt,
      time: plan.createdAt,
      trigger: plan.trigger,
    })
    byModule.set(plan.moduleId, entry)
  }
  return [...byModule.values()].sort((left, right) => left.moduleId < right.moduleId ? -1 : 1)
}

// The latest events, newest first, and any older event a signal links to, so each link lands somewhere.
function listedActivity(events: readonly ReviewEvent[], linked: readonly number[]): ReviewEvent[] {
  const newestFirst = [...events].sort((left, right) => right.id - left.id)
  const latest = new Set(newestFirst.slice(0, latestActivityShown).map(event => event.id))
  const wanted = new Set(linked)
  return newestFirst.filter(event => latest.has(event.id) || wanted.has(event.id))
}
