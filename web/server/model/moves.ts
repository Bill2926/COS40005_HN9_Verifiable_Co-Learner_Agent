export const moveTypes = [
  'explain_concept',
  'answer_question',
  'hint_level_N',
  'address_misconception',
  'reveal_answer',
  'peer_question',
  'share_confusion',
  'advance_to_item',
  'stay_and_practise',
] as const

export type MoveType = typeof moveTypes[number]

export type Move =
  | { type: 'explain_concept' }
  | { type: 'answer_question' }
  | { type: 'hint_level_N', level: number }
  | { type: 'address_misconception', misconceptionId: string }
  | { type: 'reveal_answer' }
  | { type: 'peer_question' }
  | { type: 'share_confusion' }
  | { type: 'advance_to_item', topicId: string }
  | { type: 'stay_and_practise' }

export function moveKey(move: Move): string {
  if (move.type === 'hint_level_N') return `hint_level_${move.level}`
  if (move.type === 'address_misconception') return `address_misconception:${move.misconceptionId}`
  if (move.type === 'advance_to_item') return `advance_to_item:${move.topicId}`
  return move.type
}
