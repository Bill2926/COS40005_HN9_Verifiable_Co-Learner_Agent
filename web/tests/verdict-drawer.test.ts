import { describe, expect, it } from 'vitest'
import { drawerChecks, reasonText } from '../app/admin/decisions'

const base = {
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

  it('falls back to the reason code for a code it does not know', () => {
    expect(reasonText('SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })
})
