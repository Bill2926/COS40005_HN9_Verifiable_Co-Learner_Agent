// `approach` is the student writing their approach to an exercise in plain
// words; `try` is running or submitting code on that exercise afterwards.
export type PlanStepKind = 'materials' | 'quiz' | 'exercise' | 'misconception' | 'approach' | 'try'

export interface PlanStep {
  kind: PlanStepKind
  // The module content the step points at: a quiz question, exercise or
  // misconception id. Empty for the materials step.
  ref: string
}

// What a plan step is stored with, beside its steps.
export interface LearningPlan {
  moduleId: string
  revision: number
  steps: readonly PlanStep[]
  currentStep: number
  // ISO time the student pressed Start, or null while the plan is only proposed.
  agreedAt: string | null
  // ISO time this revision was written; the records after it are what a later
  // revision answers.
  createdAt: string
  // What brought this revision about, when something did: the plan triggers the
  // server saw, comma-separated. Null for a first proposal.
  trigger: string | null
  // The turn whose decision-log entry ruled on the move behind this revision, so
  // the verdict can be found. Null on a revision from before it was recorded.
  decisionTurnId: string | null
}
