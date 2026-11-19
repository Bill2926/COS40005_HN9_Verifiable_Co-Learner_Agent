import { createClient } from '@supabase/supabase-js'
import type { LearningPlan, PlanStep, PlanStepKind } from '../learning-plan'
import type { LearningPlanStore } from './learning-plan-store'

const studentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const kinds: readonly PlanStepKind[] = ['materials', 'quiz', 'exercise', 'misconception', 'approach', 'try']

// Scoped to one course: it reads and writes only that course's rows.
export function createSupabaseLearningPlanStore(options: {
  url: string
  secretKey: string
  courseId: string
}): LearningPlanStore {
  const supabase = createClient(options.url, options.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    async latest(studentId, moduleId) {
      if (!studentIdPattern.test(studentId)) return null
      const result = await supabase
        .from('learning_plans')
        .select('module_id, revision, steps, current_step, agreed_at, created_at, trigger, decision_turn_id')
        .eq('course_id', options.courseId)
        .eq('student_id', studentId)
        .eq('module_id', moduleId)
        .order('revision', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (result.error) throw new Error(result.error.message)
      return result.data ? presentPlan(result.data) : null
    },
    async append(studentId, plan) {
      const result = await supabase.from('learning_plans').insert({
        student_id: studentId,
        course_id: options.courseId,
        module_id: plan.moduleId,
        revision: plan.revision,
        steps: plan.steps.map(step => ({ kind: step.kind, ref: step.ref })),
        current_step: plan.currentStep,
        agreed_at: plan.agreedAt,
        trigger: plan.trigger,
        decision_turn_id: plan.decisionTurnId,
      })
      if (result.error) throw new Error(result.error.message)
    },
  }
}

interface LearningPlanRow {
  module_id: string
  revision: number
  steps: unknown
  current_step: number
  agreed_at: string | null
  created_at: string
  trigger: string | null
  decision_turn_id: string | null
}

function presentPlan(row: LearningPlanRow): LearningPlan {
  return {
    moduleId: row.module_id,
    revision: Number(row.revision),
    steps: stepsFrom(row.steps),
    currentStep: Number(row.current_step),
    agreedAt: row.agreed_at,
    createdAt: row.created_at,
    trigger: row.trigger,
    decisionTurnId: row.decision_turn_id,
  }
}

function stepsFrom(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) throw new Error('A learning plan row has steps that are not a list.')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('A learning plan row has a step that is not a record.')
    if (!('kind' in item) || typeof item.kind !== 'string' || !kinds.includes(item.kind as PlanStepKind)) {
      throw new Error('A learning plan row has a step with an unexpected kind.')
    }
    if (!('ref' in item) || typeof item.ref !== 'string') {
      throw new Error('A learning plan row has a step without its ref.')
    }
    return { kind: item.kind as PlanStepKind, ref: item.ref }
  })
}
