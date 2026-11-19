import type { LearningPlanStepView, LearningPlanView } from '../../shared/turn'

// The Teacher's learning plan for one module: what the two of them will do
// there, in order. A plan is a list of one to five steps that point at the
// module's own materials, quiz, exercises or misconceptions, agreed by the
// student before it starts. Revisions are append-only: the latest revision is
// the plan in force, and agreeing is a new revision.

export type PlanStepKind = 'materials' | 'quiz' | 'exercise' | 'misconception'

export interface PlanStep {
  kind: PlanStepKind
  // The module content the step points at: a quiz question, exercise or
  // misconception id. Empty for the materials step.
  ref: string
}

// The most steps a plan may have.
export const planStepLimit = 5

// What a plan step is stored with, beside its steps.
export interface LearningPlan {
  moduleId: string
  revision: number
  steps: readonly PlanStep[]
  currentStep: number
  // ISO time the student pressed Start, or null while the plan is only proposed.
  agreedAt: string | null
}

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
  if (step.kind === 'exercise') {
    const exercise = module.exercises.find(item => item.id === step.ref)
    return exercise ? `Practise: ${exercise.title}` : ''
  }
  const response = module.misconceptionResponses.find(item => item.id === step.ref)
  return response ? `Work on: ${response.response}` : ''
}

// The plan as the student sees it. A step that no longer matches the module is
// left out rather than shown with no words.
export function planView(plan: LearningPlan, module: PlanModule): LearningPlanView {
  const steps: LearningPlanStepView[] = plan.steps.flatMap((step, index) => {
    const title = planStepTitle(step, module)
    if (title.length === 0) return []
    return [{ id: planStepKey(step), title, current: index === plan.currentStep }]
  })
  return {
    moduleId: plan.moduleId,
    revision: plan.revision,
    agreed: plan.agreedAt !== null,
    steps,
    currentStep: plan.currentStep,
  }
}
