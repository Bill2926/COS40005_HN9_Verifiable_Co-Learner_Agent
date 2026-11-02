import type { MoveType } from '../model/moves'

export interface RoleTable {
  teacher: readonly MoveType[]
  deskmate: readonly MoveType[]
}

export const roleTable: RoleTable = {
  teacher: [
    'explain_concept',
    'answer_question',
    'hint_level_N',
    'address_misconception',
    'reveal_answer',
    'advance_to_item',
    'stay_and_practise',
  ],
  deskmate: [
    'peer_question',
    'share_confusion',
  ],
}
