// The student-model component's interface: where this student stands on the course. The evidence
// ledger holds what the student submitted; the estimate turns it into one mastery per module and the
// set of modules that are open. Nothing else decides whether a student moves on.
// Where the student left off (the resume point) is not here; the conversation store keeps it.
// The Supabase version of the ledger stays in the storage component.
export { estimateMastery, unlockedModuleIds } from './estimate'
export type { MasteryParameters, ModuleMastery, Observation, UnlockableModule } from './estimate'
export { learningParameters, masteryParametersFor } from './mastery-parameters'
export { estimateCourse, furthestUnlockedModuleId, standingFor } from './course-standing'
export type { CourseEstimate, CourseStanding, StudiedCourse, StudiedModule } from './course-standing'
export { createMemoryEvidenceStore, mergeObservations } from './evidence-store'
export type { EvidenceRow, EvidenceStore, NewEvidence, TimedObservation } from './evidence-store'
