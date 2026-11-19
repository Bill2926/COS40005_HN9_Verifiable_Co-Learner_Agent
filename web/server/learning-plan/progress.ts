import type { LearningPlan } from './types'

// How far a plan has got, worked out from the student's verified records and
// nothing else: no agent and no browser report ever marks a step done. The
// records are the ones of the plan's module; the caller picks them.

// What the plan reads. Times are ISO strings.
export interface PlanRecords {
  // Each quiz answer the server marked.
  quizAnswers: readonly { questionId: string, correct: boolean, time: string }[]
  // Each submission the sandbox checked; a refused one is not evidence.
  submissions: readonly {
    exerciseId: string
    outcome: 'passed' | 'failed' | 'refused'
    findings: readonly string[]
    time: string
  }[]
  // The activity events of the module: approaches written and runs.
  activity: readonly { type: string, time: string, payload: Record<string, unknown> }[]
  // Seconds the activity log puts on the module's materials.
  materialsSeconds: number
}

// What may make the Teacher revise the plan.
export type PlanTrigger = 'failed_submissions' | 'wrong_quiz_answer' | 'misconception' | 'step_done'

export interface PlanProgress {
  // Whether each step is done.
  done: readonly boolean[]
  // The first step not done, or the number of steps once every one is.
  currentStep: number
  // What happened since the plan's latest revision that a revision could answer.
  triggers: readonly PlanTrigger[]
  // The student wrote their approach and has run or submitted nothing since.
  approachAwaitingTry: boolean
}

// Enough time on the materials for the reading step to count.
export const materialsSecondsNeeded = 60

// The failed submissions of one exercise after which the plan may be revised,
// when the course spec says nothing else.
export const defaultFailureLimit = 3

const isRun = (type: string) => type === 'code_run' || type === 'run_finished'

export function planProgress(plan: LearningPlan, records: PlanRecords, failureLimit: number): PlanProgress {
  const since = Date.parse(plan.createdAt)
  // Strictly after the revision: whatever the revision already answered is behind it.
  const afterRevision = (time: string) => Date.parse(time) > since
  const approaches = records.activity.filter(event => event.type === 'approach_written')
  // An approach belongs to the student's agreement, not to one revision: a revision of
  // the plan does not make them write it again.
  const agreedFrom = Date.parse(plan.agreedAt ?? plan.createdAt)
  const approachOn = (exerciseId: string) => approaches
    .filter(event => event.payload.exerciseId === exerciseId && Date.parse(event.time) > agreedFrom)
    .map(event => Date.parse(event.time))
  const attemptsOn = (exerciseId: string, from: number) =>
    records.activity.some(event => isRun(event.type) && event.payload.exerciseId === exerciseId && Date.parse(event.time) >= from)
    || records.submissions.some(item => item.exerciseId === exerciseId && item.outcome !== 'refused' && Date.parse(item.time) >= from)

  const done = plan.steps.map((step): boolean => {
    if (plan.agreedAt === null) return false
    if (step.kind === 'materials') return records.materialsSeconds >= materialsSecondsNeeded
    if (step.kind === 'quiz') return records.quizAnswers.some(answer => answer.questionId === step.ref && answer.correct)
    if (step.kind === 'exercise') return records.submissions.some(item => item.exerciseId === step.ref && item.outcome === 'passed')
    if (step.kind === 'approach') return approachOn(step.ref).length > 0
    if (step.kind === 'try') return attemptsOn(step.ref, Math.max(agreedFrom, ...approachOn(step.ref)))
    return records.submissions.some(item =>
      item.outcome === 'passed' && afterRevision(item.time) && !item.findings.includes(step.ref))
  })
  const firstOpen = done.indexOf(false)
  const currentStep = firstOpen === -1 ? done.length : firstOpen

  const recent = records.submissions.filter(item => afterRevision(item.time))
  const failures = new Map<string, number>()
  for (const item of recent) {
    if (item.outcome === 'failed') failures.set(item.exerciseId, (failures.get(item.exerciseId) ?? 0) + 1)
  }
  const triggers: PlanTrigger[] = []
  if ([...failures.values()].some(count => count >= failureLimit)) triggers.push('failed_submissions')
  if (records.quizAnswers.some(answer => !answer.correct && afterRevision(answer.time))) triggers.push('wrong_quiz_answer')
  if (recent.some(item => item.outcome !== 'refused' && item.findings.length > 0)) triggers.push('misconception')
  if (currentStep > plan.currentStep) triggers.push('step_done')

  const latest = approaches
    .filter(event => Date.parse(event.time) > agreedFrom && typeof event.payload.exerciseId === 'string')
    .sort((left, right) => Date.parse(right.time) - Date.parse(left.time))[0]
  const approachAwaitingTry = latest !== undefined
    && !attemptsOn(latest.payload.exerciseId as string, Date.parse(latest.time))

  // A plan the student has not agreed to yet is not being worked through, so nothing is a trigger.
  return { done, currentStep, triggers: plan.agreedAt === null ? [] : triggers, approachAwaitingTry }
}
