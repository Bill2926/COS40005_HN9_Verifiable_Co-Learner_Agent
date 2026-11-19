import type { ActivityRecorder } from '../activity-recorder'
import type { Course } from '../course'
import type { DecisionLogStore } from '../storage/decision-log'
import type { QuizAnswerStore } from '../storage/quiz-answer-store'
import type { SubmissionStore } from '../storage/submission-store'
import type { EvidenceStore } from '../student-model'
import { learningPattern, type LearningPattern } from './index'

// The stores the pattern is read through. One a caller does not have
// contributes nothing.
export interface LearningPatternSources {
  evidence?: EvidenceStore
  submissions?: SubmissionStore
  activity?: ActivityRecorder
  decisions?: DecisionLogStore
  quizAnswers?: QuizAnswerStore
}

// One student's learning pattern in one course, read from the stores. The turn
// and the staff review both use it, so they always show the same pattern.
export async function gatherLearningPattern(
  sources: LearningPatternSources,
  studentId: string,
  course: Pick<Course, 'studyModules'>,
): Promise<LearningPattern> {
  const [observations, submissions, activity, decisions, quizAnswers] = await Promise.all([
    sources.evidence?.forStudent(studentId) ?? [],
    sources.submissions?.forStudent(studentId) ?? [],
    sources.activity?.forStudent(studentId) ?? [],
    sources.decisions?.list({ studentId }) ?? [],
    wrongQuizSightings(studentId, course, sources.quizAnswers),
  ])
  return learningPattern({
    evidence: observations.flatMap(observation =>
      observation.kind === 'submission'
        ? [{ time: observation.time, exerciseId: observation.exerciseId, allPassed: observation.allPassed }]
        : []),
    submissions: submissions.map(row => ({
      time: row.createdAt,
      moduleId: row.moduleId,
      exerciseId: row.exerciseId,
      outcome: row.outcome,
      findings: row.findings,
    })),
    quizAnswers,
    activity,
    decisions: decisions.map(({ moduleId, ruledMove }) => ({ moduleId: moduleId ?? null, ruledMove })),
  })
}

// Every wrong quiz answer in the course that names a misconception, for the
// pattern. A wrong answer with no misconception named is a weak spot of nothing.
async function wrongQuizSightings(
  studentId: string,
  course: Pick<Course, 'studyModules'>,
  quizStore: QuizAnswerStore | undefined,
): Promise<{ time: string, moduleId: string, misconceptionId: string }[]> {
  if (!quizStore) return []
  const sightings = await Promise.all(course.studyModules.map(async (module) => {
    const rows = await quizStore.forStudentModule(studentId, module.id)
    return rows
      .filter(row => !row.correct)
      .flatMap((row) => {
        const question = module.quiz.find(item => item.id === row.questionId)
        const misconceptionId = question?.misconceptions?.[row.choice as 0 | 1 | 2 | 3]
        return misconceptionId ? [{ time: row.time, moduleId: module.id, misconceptionId }] : []
      })
  }))
  return sightings.flat()
}
