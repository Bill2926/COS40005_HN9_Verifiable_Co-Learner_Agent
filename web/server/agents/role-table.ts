import type { MoveType } from './moves'

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
    'advance_to_module',
    'stay_and_practise',
    'propose_plan',
    'revise_plan',
    'continue_plan',
  ],
  deskmate: [
    'peer_question',
    'share_confusion',
  ],
}
