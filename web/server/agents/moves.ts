import { z } from 'zod'

// The move contract, defined once. The move types, the proposal schema the language model is held to,
// and each agent's list of moves in its prompt are all read from here: adding a move is one change.

// The module id a move is about, from the course roadmap, or out_of_course.
const scope = z.string().min(1)

// One step of a proposed learning plan: the kind of module content it points
// at, and the quiz question, exercise or misconception id (empty for the
// materials step). The VerifyShield drops a step the module or the learning
// pattern does not support.
export const planStepSchema = z.object({
  kind: z.enum(['materials', 'quiz', 'exercise', 'misconception', 'approach', 'try']),
  ref: z.string(),
})

// Every move an agent may propose. Which agent may make which is not a matter for the schema: the
// VerifyShield rules on that against the role table (ADR 0003).
export const agentMoveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('explain_concept'), scope }),
  z.object({ type: z.literal('answer_question'), scope }),
  z.object({ type: z.literal('hint_level_N'), level: z.int().min(1).max(3), scope }),
  z.object({ type: z.literal('address_misconception'), misconceptionId: z.string().min(1), scope }),
  z.object({ type: z.literal('peer_question') }),
  z.object({ type: z.literal('share_confusion') }),
  z.object({ type: z.literal('advance_to_module'), moduleId: z.string().min(1) }),
  z.object({ type: z.literal('stay_and_practise') }),
  // The list is not capped here: a plan with no steps or more than five is
  // refused by the VerifyShield, so the log says which rule refused it.
  z.object({ type: z.literal('propose_plan'), steps: z.array(planStepSchema).max(10) }),
  // A new revision of the plan in force; ruled only when something happened since the last revision.
  z.object({ type: z.literal('revise_plan'), steps: z.array(planStepSchema).max(10) }),
  // A check-in on the current step of the plan in force: no payload.
  z.object({ type: z.literal('continue_plan') }),
])

// What either agent returns when asked to propose: one move, or null to stay quiet.
export const proposalSchema = z.object({
  proposal: z.union([z.null(), agentMoveSchema]),
})

export type AgentMove = z.infer<typeof agentMoveSchema>

// The VerifyShield's own move, never proposed by an agent.
export type RedirectMove = { type: 'redirect_to_module', scope: string }

export type Move = AgentMove | RedirectMove

export type MoveType = Move['type']

export const moveTypes: readonly MoveType[] = [
  ...agentMoveSchema.options.map(option => option.shape.type.value),
  'redirect_to_module',
]

// The moves that must say which module they are about.
export const scopedMoveTypes: readonly MoveType[] = agentMoveSchema.options
  .filter(option => 'scope' in option.shape)
  .map(option => option.shape.type.value)

export function moveKey(move: Move): string {
  if (move.type === 'hint_level_N') return `hint_level_${move.level}`
  if (move.type === 'address_misconception') return `address_misconception:${move.misconceptionId}`
  if (move.type === 'advance_to_module') return `advance_to_module:${move.moduleId}`
  return move.type
}
