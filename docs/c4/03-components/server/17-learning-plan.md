# Component: learning plan

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

`web/server/learning-plan/index.ts`, the Teacher's learning plan for one module: the steps, their wording,
and the view the student sees. A plan is one to five steps, in the order the student should do them, each
pointing at the module's own materials, one of its quiz questions, one of its exercises, or a misconception
the learning pattern calls a weak spot. The student agrees before it starts, and agreeing is recorded as a
new revision, so a plan is never rewritten. Part of [server/00-overview.md](00-overview.md).

Legend: solid = runtime import, dashed = type-only import. Blue = this component, grey = other components.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  turn["<b>turn/handle-turn.ts</b>"]:::near
  decide["<b>verify-shield/decide.ts</b>"]:::near
  planStore["<b>storage/learning-plan-store.ts</b>"]:::near
  supabasePlanStore["<b>storage/supabase-learning-plan-store.ts</b>"]:::near
  turnTypes["<b>shared/turn.ts</b>"]:::near

  plan["<b>learning-plan/index.ts</b><br/>planStepLimit, planStepKey,<br/>planStepTitle, planView,<br/>LearningPlan, PlanStep"]:::comp

  turn -->|"planView"| plan
  turn -.->|"type: LearningPlan"| plan
  decide -->|"planStepKey, planStepLimit"| plan
  planStore -.->|"types: LearningPlan, PlanStep"| plan
  supabasePlanStore -.->|"types: LearningPlan, PlanStep,<br/>PlanStepKind"| plan
  plan -.->|"types: LearningPlanView,<br/>LearningPlanStepView"| turnTypes
```

## What a plan is

| Part | Shape | Notes |
|---|---|---|
| Step kind | `materials`, `quiz`, `exercise` or `misconception` | A `materials` step points at all of the module's materials and carries an empty ref |
| Step ref | A question, exercise or misconception id | Only ids of the module the student opened |
| Plan | Module id, revision, steps, current step, agreed time | The highest revision for a student and module is the plan in force |
| Agreement | `agreedAt` | Null while the plan is only proposed; pressing Start appends a new revision with the time instead of updating the row |

`planStepKey` is the step's stable id in its plan (`materials`, else `kind:ref`). `planStepTitle` reads the
step's words from the module content, so they always match what the step points at; a step whose target the
module no longer has has no title. `planView` is what the student sees: `steps` (each with its id, title and
whether it is the current one), `revision`, `agreed` and `currentStep`. A step that no longer matches the
module is left out of the view rather than shown with no words.

## How it is used

- The [turn](02-turn.md) asks the Teacher for a plan (`Teacher.plan`) when the student opens or selects a
  module with no plan in force, and only when a plan store is wired. The proposal goes through the
  [VerifyShield](03-verify-shield.md) like any other move; only an allowed or downgraded `propose_plan`
  whose steps survive the rules is stored, as revision 1. A preview never proposes a plan and writes
  nothing.
- A `plan_start` turn reads the latest plan and, while it is unagreed, appends the next revision with
  `agreedAt` set to the turn's clock. Starting a module with no plan, or one already agreed, changes
  nothing.
- Plans never touch mastery or an unlock: proposing and agreeing are a read of the student's records and
  a write of the plan only.
- The returned state carries `learningPlan` (`LearningPlanView | null`); the web app shows it as a
  checklist above the materials, with Start until the plan is agreed.

## Verified imports

- Imports: type only from `shared/turn` (`LearningPlanView`, `LearningPlanStepView`). Pure: no I/O, no
  clock, no package.
- Runtime importers: `turn/handle-turn.ts` (`planView`), `verify-shield/decide.ts` (`planStepKey`,
  `planStepLimit`). `turn/handle-turn.ts` also type-imports `LearningPlan`.
- Type-only importers: `storage/learning-plan-store.ts` and `storage/supabase-learning-plan-store.ts`
  (`LearningPlan`, `PlanStep`, `PlanStepKind`).
- Tests: `learning-plan.test.ts` (titles, keys, the view, a stale step left out), `learning-plan-turn.test.ts`
  (propose once, agree as a new revision, survive reload, mastery untouched, previews never propose),
  `learning-plans-migration.test.ts` (the table, the revision constraint and its grants, on PGlite).
