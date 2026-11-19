import type { LearningPlanStepView, LearningPlanView } from '../../shared/turn'
import type { PlanProgress } from './progress'

export * from './progress'
export * from './types'
import type { LearningPlan, PlanStep } from './types'

// The Teacher's learning plan for one module: what the two of them will do
// there, in order. A plan is a list of one to five steps that point at the
// module's own materials, quiz, exercises or misconceptions, agreed by the
// student before it starts. Revisions are append-only: the latest revision is
// the plan in force, and agreeing is a new revision.



// The most steps a plan may have.
export const planStepLimit = 5


// What the learning plan needs to know about a module to name its steps. The
// course's StudyModule satisfies it.
export interface PlanModule {
  materials: readonly unknown[]
  quiz: readonly { id: string, prompt: string }[]
  exercises: readonly { id: string, title: string }[]
  misconceptionResponses: readonly { id: string, response: string }[]
}

// A step's stable id within its plan.
export function planStepKey(step: PlanStep): string {
  return step.kind === 'materials' ? step.kind : `${step.kind}:${step.ref}`
}

// The step in the student's words, read from the module content so the title
// always matches what the step points at.
export function planStepTitle(step: PlanStep, module: PlanModule): string {
  if (step.kind === 'materials') return 'Read the module materials'
  if (step.kind === 'quiz') {
    const question = module.quiz.find(item => item.id === step.ref)
    return question ? `Answer the quiz question: ${question.prompt}` : ''
  }
  if (step.kind === 'exercise' || step.kind === 'approach' || step.kind === 'try') {
    const exercise = module.exercises.find(item => item.id === step.ref)
    if (!exercise) return ''
    if (step.kind === 'approach') return `Write your approach in your own words: ${exercise.title}`
    if (step.kind === 'try') return `Try your approach: ${exercise.title}`
    return `Practise: ${exercise.title}`
  }
  const response = module.misconceptionResponses.find(item => item.id === step.ref)
  return response ? `Work on: ${response.response}` : ''
}

// The plan as the student sees it. A step that no longer matches the module is
// left out rather than shown with no words.
export function planView(plan: LearningPlan, module: PlanModule, progress?: PlanProgress): LearningPlanView {
  const currentStep = progress?.currentStep ?? plan.currentStep
  const steps: LearningPlanStepView[] = plan.steps.flatMap((step, index) => {
    const title = planStepTitle(step, module)
    if (title.length === 0) return []
    return [{ id: planStepKey(step), title, current: index === currentStep, done: progress?.done[index] ?? false }]
  })
  return {
    moduleId: plan.moduleId,
    revision: plan.revision,
    agreed: plan.agreedAt !== null,
    steps,
    currentStep,
  }
}
