import type { RoleTable } from '../content/role-table'
import type { Move } from '../model/moves'

export interface TurnSnapshot {
  topicId: string
  exerciseId: string
}

export interface Proposal {
  agent: 'teacher' | 'deskmate'
  move: Move
}

export interface Verdict {
  agent: 'teacher' | 'deskmate'
  decision: 'allow' | 'block' | 'downgrade'
  ruleId: string
  reasonCode: string
  move: Move | null
}

export function decide(
  proposals: readonly Proposal[],
  snapshot: TurnSnapshot,
  spec: RoleTable,
): Verdict[] {
  if (snapshot.topicId.length === 0 || snapshot.exerciseId.length === 0) {
    return proposals.map(proposal => ({
      agent: proposal.agent,
      decision: 'block',
      ruleId: 'role_table',
      reasonCode: 'ROLE_FORBIDDEN',
      move: null,
    }))
  }

  return proposals.map((proposal) => {
    const permitted = spec[proposal.agent].includes(proposal.move.type)
    if (!permitted) {
      return {
        agent: proposal.agent,
        decision: 'block',
        ruleId: 'role_table',
        reasonCode: 'ROLE_FORBIDDEN',
        move: null,
      }
    }

    return {
      agent: proposal.agent,
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: proposal.move,
    }
  })
}
