import type { Move, RoleTable } from '../agents'

export interface ModuleMastery {
  moduleId: string
  mastery: number
}

// Every field is required: a rule that read an optional field would be
// skipped, without a word, whenever a caller left it out.
export interface TurnSnapshot {
  // The module the student is placed on; it is also the current module.
  moduleId: string
  exerciseId: string
  masteries: readonly ModuleMastery[]
  unlockedModuleIds: readonly string[]
  studentMessage: string
  verifyShieldOn: boolean
}

export interface CourseModule {
  id: string
  keywords: readonly string[]
}

export interface CourseScope {
  modules: readonly CourseModule[]
  outOfCourseKeywords: readonly string[]
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

const teachingMoves = new Set<Move['type']>([
  'explain_concept',
  'answer_question',
  'hint_level_N',
  'address_misconception',
])

export function decide(
  proposals: readonly Proposal[],
  snapshot: TurnSnapshot,
  roleTable: RoleTable,
  course: CourseScope,
): Verdict[] {
  if (!snapshot.verifyShieldOn) {
    return proposals.map(proposal => ({
      agent: proposal.agent,
      decision: 'allow',
      ruleId: 'verify_shield',
      reasonCode: 'VERIFYSHELD_OFF',
      move: proposal.move,
    }))
  }

  if (snapshot.moduleId.length === 0 || snapshot.exerciseId.length === 0) {
    return proposals.map(proposal => ({
      agent: proposal.agent,
      decision: 'block',
      ruleId: 'turn_placement',
      reasonCode: 'NO_PLACEMENT',
      move: null,
    }))
  }

  return proposals.map((proposal) => {
    const permitted = roleTable[proposal.agent].includes(proposal.move.type)
    if (!permitted) {
      return {
        agent: proposal.agent,
        decision: 'block',
        ruleId: 'role_table',
        reasonCode: 'ROLE_FORBIDDEN',
        move: null,
      }
    }

    const scoped = scopeDowngrade(proposal, snapshot, course)
    if (scoped) return scoped

    const advance = advanceDowngrade(proposal, snapshot, course)
    if (advance) return advance

    return {
      agent: proposal.agent,
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: proposal.move,
    }
  })
}

function scopeDowngrade(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  course: CourseScope,
): Verdict | null {
  if (proposal.agent !== 'teacher') return null
  if (!teachingMoves.has(proposal.move.type)) return null
  const scope = moveScope(proposal.move) ?? snapshot.moduleId

  const inScope = scope !== 'out_of_course' && snapshot.unlockedModuleIds.includes(scope)
  if (inScope) {
    const keyword = keywordHit(snapshot.studentMessage, snapshot.unlockedModuleIds, course)
    if (keyword) {
      return {
        agent: 'teacher',
        decision: 'downgrade',
        ruleId: 'scope_keyword',
        reasonCode: keyword.reasonCode,
        move: { type: 'redirect_to_module', scope: keyword.scope },
      }
    }
  }

  if (scope === 'out_of_course') {
    return {
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_in_course',
      reasonCode: 'OUT_OF_COURSE',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }
  }
  if (snapshot.unlockedModuleIds.includes(scope)) return null

  return {
    agent: 'teacher',
    decision: 'downgrade',
    ruleId: 'scope_requires_unlocked_module',
    reasonCode: 'MODULE_CLOSED',
    move: { type: 'redirect_to_module', scope },
  }
}

function advanceDowngrade(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  course: CourseScope,
): Verdict | null {
  if (proposal.agent !== 'teacher' || proposal.move.type !== 'advance_to_item') return null
  const target = proposal.move.moduleId
  const known = course.modules.some(module => module.id === target)
  if (!known || snapshot.unlockedModuleIds.includes(target)) return null

  return {
    agent: 'teacher',
    decision: 'downgrade',
    ruleId: 'scope_requires_unlocked_module',
    reasonCode: 'MODULE_CLOSED',
    move: { type: 'redirect_to_module', scope: target },
  }
}

function keywordHit(
  message: string,
  unlockedModuleIds: readonly string[],
  course: CourseScope,
): { reasonCode: 'OUT_OF_COURSE_KEYWORD' | 'MODULE_CLOSED_KEYWORD', scope: string } | null {
  for (const phrase of course.outOfCourseKeywords) {
    if (mentionsPhrase(message, phrase)) {
      return { reasonCode: 'OUT_OF_COURSE_KEYWORD', scope: 'out_of_course' }
    }
  }

  for (const module of course.modules) {
    if (unlockedModuleIds.includes(module.id)) continue
    for (const phrase of module.keywords) {
      if (mentionsPhrase(message, phrase)) {
        return { reasonCode: 'MODULE_CLOSED_KEYWORD', scope: module.id }
      }
    }
  }

  return null
}

function mentionsPhrase(message: string, phrase: string): boolean {
  const haystack = message.toLowerCase()
  const needle = phrase.toLowerCase()
  if (needle.length === 0) return false
  let from = 0
  while (from <= haystack.length - needle.length) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return false
    const before = at === 0 ? '' : haystack[at - 1] ?? ''
    const after = at + needle.length >= haystack.length ? '' : haystack[at + needle.length] ?? ''
    if (isBoundary(before) && isBoundary(after)) return true
    from = at + 1
  }
  return false
}

function isBoundary(char: string): boolean {
  return char === '' || !/[a-z0-9]/i.test(char)
}

function moveScope(move: Move): string | undefined {
  if (move.type === 'explain_concept' || move.type === 'answer_question' || move.type === 'hint_level_N' || move.type === 'address_misconception') {
    return move.scope
  }
  return undefined
}
