import type { AddressedAgent, RuleCheck } from '../../shared/turn'
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
  // The highest hint rung already given in this module's conversation, 0 if none.
  highestHintRung: number
  // The misconceptions the current module can name; the teacher may address no other.
  misconceptionIds: readonly string[]
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
  agent: AddressedAgent
  move: Move
}

export type { RuleCheck }

export interface Verdict {
  agent: AddressedAgent
  decision: 'allow' | 'block' | 'downgrade'
  ruleId: string
  reasonCode: string
  move: Move | null
  // Ends with the check that decided the verdict; empty when the VerifyShield is off.
  // Rules after the deciding one are not evaluated and do not appear.
  ruleChecks: RuleCheck[]
}

// The deciding check of an allow: every rule above it passed.
const allowedCheck: RuleCheck = { ruleId: 'all_rules', passed: true, reasonCode: 'ALL_RULES_PASSED' }

type Ruling = Omit<Verdict, 'agent' | 'ruleChecks'>

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
      reasonCode: 'VERIFYSHIELD_OFF',
      move: proposal.move,
      ruleChecks: [],
    }))
  }

  if (snapshot.moduleId.length === 0 || snapshot.exerciseId.length === 0) {
    return proposals.map(proposal => ({
      agent: proposal.agent,
      decision: 'block',
      ruleId: 'turn_placement',
      reasonCode: 'NO_PLACEMENT',
      move: null,
      ruleChecks: [{ ruleId: 'turn_placement', passed: false, reasonCode: 'NO_PLACEMENT' }],
    }))
  }

  return proposals.map((proposal) => {
    const checks: RuleCheck[] = []
    const ruling = rule(proposal, snapshot, roleTable, course, checks)
    if (ruling.decision !== 'allow') {
      checks.push({ ruleId: ruling.ruleId, passed: false, reasonCode: ruling.reasonCode })
    }
    else {
      // An allow is decided by every rule passing, so that ends the list.
      checks.push(allowedCheck)
    }
    return { agent: proposal.agent, ...ruling, ruleChecks: checks }
  })
}

// Applies the rules in order and records each one passed in `checks`. The
// failing rule, if any, is returned as the ruling and not recorded here.
function rule(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  roleTable: RoleTable,
  course: CourseScope,
  checks: RuleCheck[],
): Ruling {
  const permitted = roleTable[proposal.agent].includes(proposal.move.type)
  if (!permitted) {
    return { decision: 'block', ruleId: 'role_table', reasonCode: 'ROLE_FORBIDDEN', move: null }
  }
  checks.push({ ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' })

  return scopeDowngrade(proposal, snapshot, course, checks)
    ?? advanceDowngrade(proposal, snapshot, course, checks)
    ?? misconceptionDowngrade(proposal, snapshot, checks)
    ?? hintLadderDowngrade(proposal, snapshot, checks)
    ?? { decision: 'allow', ruleId: 'role_table', reasonCode: 'ROLE_PERMITTED', move: proposal.move }
}

function scopeDowngrade(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  course: CourseScope,
  checks: RuleCheck[],
): Ruling | null {
  if (proposal.agent !== 'teacher') return null
  if (!teachingMoves.has(proposal.move.type)) return null
  const scope = moveScope(proposal.move) ?? snapshot.moduleId

  const inScope = scope !== 'out_of_course' && snapshot.unlockedModuleIds.includes(scope)
  if (inScope) {
    const keyword = keywordHit(snapshot.studentMessage, snapshot.unlockedModuleIds, course)
    if (keyword) {
      return {
        decision: 'downgrade',
        ruleId: 'scope_keyword',
        reasonCode: keyword.reasonCode,
        move: { type: 'redirect_to_module', scope: keyword.scope },
      }
    }
    checks.push({ ruleId: 'scope_keyword', passed: true, reasonCode: 'NO_CLOSED_KEYWORD' })
  }

  if (scope === 'out_of_course') {
    return {
      decision: 'downgrade',
      ruleId: 'scope_in_course',
      reasonCode: 'OUT_OF_COURSE',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }
  }
  if (snapshot.unlockedModuleIds.includes(scope)) {
    checks.push({ ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' })
    checks.push({ ruleId: 'scope_requires_unlocked_module', passed: true, reasonCode: 'MODULE_UNLOCKED' })
    return null
  }

  // A scope the model invented is neither a module of the course nor out of
  // course. The student is brought back to their module exactly as for an
  // out-of-course move, so the log says which of the two happened.
  if (!course.modules.some(module => module.id === scope)) {
    return {
      decision: 'downgrade',
      ruleId: 'scope_in_course',
      reasonCode: 'SCOPE_UNKNOWN',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }
  }

  checks.push({ ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' })
  return {
    decision: 'downgrade',
    ruleId: 'scope_requires_unlocked_module',
    reasonCode: 'MODULE_CLOSED',
    move: { type: 'redirect_to_module', scope },
  }
}

// The teacher may suggest only a module the course has and the student is not
// already in. A module the course does not have is blocked, so nothing is said
// about it; the module the student is in becomes a suggestion to keep
// practising; a known but closed module redirects as usual.
function advanceDowngrade(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  course: CourseScope,
  checks: RuleCheck[],
): Ruling | null {
  if (proposal.agent !== 'teacher' || proposal.move.type !== 'advance_to_module') return null
  const target = proposal.move.moduleId

  if (!course.modules.some(module => module.id === target)) {
    return { decision: 'block', ruleId: 'advance_known_module', reasonCode: 'ADVANCE_UNKNOWN_MODULE', move: null }
  }
  checks.push({ ruleId: 'advance_known_module', passed: true, reasonCode: 'MODULE_KNOWN' })

  if (target === snapshot.moduleId) {
    return {
      decision: 'downgrade',
      ruleId: 'advance_not_current_module',
      reasonCode: 'ADVANCE_TO_CURRENT',
      move: { type: 'stay_and_practise' },
    }
  }
  checks.push({ ruleId: 'advance_not_current_module', passed: true, reasonCode: 'NOT_CURRENT_MODULE' })

  if (snapshot.unlockedModuleIds.includes(target)) {
    checks.push({ ruleId: 'scope_requires_unlocked_module', passed: true, reasonCode: 'MODULE_UNLOCKED' })
    return null
  }

  return {
    decision: 'downgrade',
    ruleId: 'scope_requires_unlocked_module',
    reasonCode: 'MODULE_CLOSED',
    move: { type: 'redirect_to_module', scope: target },
  }
}

// The teacher may name only a misconception the current module has. An invented
// one is answered as a plain question on the same scope, not blocked, so the
// teacher does not fall silent while the student is wrong.
function misconceptionDowngrade(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  checks: RuleCheck[],
): Ruling | null {
  if (proposal.agent !== 'teacher') return null
  if (proposal.move.type !== 'address_misconception') return null
  if (snapshot.misconceptionIds.includes(proposal.move.misconceptionId)) {
    checks.push({ ruleId: 'misconception_known', passed: true, reasonCode: 'MISCONCEPTION_KNOWN' })
    return null
  }

  return {
    decision: 'downgrade',
    ruleId: 'misconception_known',
    reasonCode: 'MISCONCEPTION_UNKNOWN',
    move: { type: 'answer_question', scope: proposal.move.scope },
  }
}

// The teacher climbs the hint ladder one rung at a time. A rung above the
// highest already given plus one is downgraded to that next rung; a rung at or
// below the highest given, or exactly one above it, is left alone.
function hintLadderDowngrade(
  proposal: Proposal,
  snapshot: TurnSnapshot,
  checks: RuleCheck[],
): Ruling | null {
  if (proposal.agent !== 'teacher') return null
  if (proposal.move.type !== 'hint_level_N') return null
  const ceiling = snapshot.highestHintRung + 1
  if (proposal.move.level <= ceiling) {
    checks.push({ ruleId: 'hint_ladder', passed: true, reasonCode: 'HINT_IN_ORDER' })
    return null
  }

  return {
    decision: 'downgrade',
    ruleId: 'hint_ladder',
    reasonCode: 'HINT_SKIPPED',
    move: { type: 'hint_level_N', level: ceiling, scope: proposal.move.scope },
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
