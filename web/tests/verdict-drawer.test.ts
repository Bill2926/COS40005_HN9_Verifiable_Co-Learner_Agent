import { describe, expect, it } from 'vitest'
import { addressedText, agentText, drawerChecks, outcomeText, reasonText, toolCallsView } from '../app/admin/decisions'

const base = {
  outcome: 'ruled' as const,
  ruleId: 'scope_requires_unlocked_module',
  reasonCode: 'MODULE_CLOSED',
  verdict: 'downgrade' as const,
  verifyShieldOn: true,
}

describe('verdict drawer checks', () => {
  it('lists recorded checks in order with plain-English reasons and marks the last one deciding', () => {
    expect(drawerChecks({
      ...base,
      ruleChecks: [
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_requires_unlocked_module', passed: false, reasonCode: 'MODULE_CLOSED' },
      ],
    })).toEqual({
      note: null,
      checks: [
        { ruleId: 'role_table', passed: true, reason: 'The role table lets this agent make this move.', deciding: false },
        { ruleId: 'scope_requires_unlocked_module', passed: false, reason: 'The move is about a module the student has not unlocked yet.', deciding: true },
      ],
    })
  })

  it('says no rules were checked when the VerifyShield was off', () => {
    expect(drawerChecks({ ...base, verifyShieldOn: false, ruleChecks: [] })).toEqual({
      note: 'VerifyShield was off, no rules were checked.',
      checks: [],
    })
  })

  it('shows only the deciding rule for a record from before rule checks', () => {
    expect(drawerChecks(base)).toEqual({
      note: 'Earlier rule checks were not recorded for this decision.',
      checks: [
        { ruleId: 'scope_requires_unlocked_module', passed: false, reason: 'The move is about a module the student has not unlocked yet.', deciding: true },
      ],
    })
  })

  it('words the deciding check of an allow', () => {
    expect(drawerChecks({
      ...base,
      verdict: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      ruleChecks: [
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'all_rules', passed: true, reasonCode: 'ALL_RULES_PASSED' },
      ],
    }).checks.at(-1)).toEqual({ ruleId: 'all_rules', passed: true, reason: 'Every rule passed, so the move was allowed.', deciding: true })
  })

  it('falls back to the reason code for a code it does not know', () => {
    expect(reasonText('SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })
})

describe('verdict drawer agent', () => {
  it('names the deskmate agent Mai, as the student sees her', () => {
    expect(agentText('teacher')).toBe('Teacher')
    expect(agentText('deskmate')).toBe('Mai')
  })
})

describe('verdict drawer addressed agent', () => {
  it('names the addressed agent, no one, or a record from before it was kept', () => {
    expect(addressedText('teacher')).toBe('@Teacher')
    expect(addressedText('deskmate')).toBe('@Mai')
    expect(addressedText(null)).toBe('no one')
    expect(addressedText(undefined)).toBe('not recorded')
  })

  it('lists the tools the agent called, or says the trace was not recorded', () => {
    const call = { name: 'get_student_mastery', input: {}, summary: '11 modules, threshold 0.95' }
    expect(toolCallsView({ toolTrace: [call] })).toEqual({ note: null, calls: [{ name: 'get_student_mastery', input: '{}', summary: '11 modules, threshold 0.95' }] })
    expect(toolCallsView({ toolTrace: [] })).toEqual({ note: 'No tools were called.', calls: [] })
    expect(toolCallsView({})).toEqual({ note: 'Tool calls were not recorded for this decision.', calls: [] })
  })

  it('shows a step cap as its own outcome, not as a VerifyShield verdict', () => {
    const stepCap = { outcome: 'step_cap' as const, verdict: null, ruledMove: null, ruledScope: null, ruleId: null, reasonCode: null, verifyShieldOn: true }
    expect(outcomeText(stepCap)).toBe('step cap')
    expect(drawerChecks(stepCap)).toEqual({
      note: 'The Teacher reached its 3-step limit before proposing a move, so it said nothing and the VerifyShield had nothing to rule on.',
      checks: [],
    })
  })

  it('words a ruling as its verdict, with the move a downgrade gave instead', () => {
    expect(outcomeText({ outcome: 'ruled', verdict: 'allow', ruledMove: 'explain_concept', ruledScope: 'loops' })).toBe('allow')
    expect(outcomeText({ outcome: 'ruled', verdict: 'downgrade', ruledMove: 'answer_question', ruledScope: 'loops' })).toBe('downgrade → answer_question · loops')
  })
})
