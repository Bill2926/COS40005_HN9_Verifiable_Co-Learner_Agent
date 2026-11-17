// The VerifyShield component's interface. Code outside this folder imports from here only,
// so the files behind it can move without touching the turn handler, the routes or the admin handler.
export { decide } from './decide'
export type {
  CourseModule,
  CourseScope,
  ModuleMastery,
  Proposal,
  RuleCheck,
  TurnSnapshot,
  Verdict,
} from './decide'
export {
  createMemoryVerifyShieldStore,
  verifyShieldEnabled,
  verifyShieldForTurn,
} from './verify-shield-store'
export type { VerifyShieldStore } from './verify-shield-store'
