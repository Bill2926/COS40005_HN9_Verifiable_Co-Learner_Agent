import { describe, expectTypeOf, it } from 'vitest'
import { decide, type CourseScope, type TurnSnapshot } from '../server/verify-shield'

// Leaving a snapshot field or the course scope out would silently skip a rule
// (or leave a gap in the decision log),
// so the type checker refuses it instead.
describe('VerifyShield snapshot contract', () => {
  it('requires every field the VerifyShield knows', () => {
    expectTypeOf<TurnSnapshot>().toEqualTypeOf<{
      moduleId: string
      exerciseId: string
      masteries: readonly { moduleId: string, mastery: number }[]
      unlockedModuleIds: readonly string[]
      studentMessage: string
      verifyShieldOn: boolean
      highestHintRung: number
      shownMisconceptionIds: readonly string[]
    }>()
  })

  it('requires the course scope', () => {
    expectTypeOf(decide).parameter(3).toEqualTypeOf<CourseScope>()
  })
})
