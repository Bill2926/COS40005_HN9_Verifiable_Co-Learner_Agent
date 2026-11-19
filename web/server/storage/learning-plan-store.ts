import type { LearningPlan, PlanStep } from '../learning-plan'

// The Teacher's plans, one per student and module, append-only: every
// proposal and every agreement is a new revision, and the latest revision is
// the plan in force.
export interface LearningPlanStore {
  latest: (studentId: string, moduleId: string) => Promise<LearningPlan | null>
  // The store stamps `createdAt`, as the database clock does for a stored row.
  append: (studentId: string, plan: NewLearningPlan) => Promise<void>
}

export type NewLearningPlan = Omit<LearningPlan, 'createdAt'>

export function createMemoryLearningPlanStore(now: () => Date = () => new Date()): LearningPlanStore {
  const plans = new Map<string, LearningPlan[]>()
  const keyOf = (studentId: string, moduleId: string) => `${studentId}\n${moduleId}`
  return {
    async latest(studentId, moduleId) {
      const revisions = plans.get(keyOf(studentId, moduleId)) ?? []
      return revisions.at(-1) ?? null
    },
    async append(studentId, plan) {
      const key = keyOf(studentId, plan.moduleId)
      plans.set(key, [...(plans.get(key) ?? []), copyPlan({ ...plan, createdAt: now().toISOString() })])
    },
  }
}

function copyPlan(plan: LearningPlan): LearningPlan {
  return {
    ...plan,
    steps: plan.steps.map((step): PlanStep => ({ ...step })),
  }
}
