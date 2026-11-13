import { estimateMastery, unlockedModuleIds, type Observation, type UnlockableModule } from './estimate'
import { masteryParameters } from './mastery-parameters'

// What the evidence says about the course, before anything is known about
// where the student is sitting right now.
export interface CourseEstimate {
  masteries: readonly { moduleId: string, mastery: number }[]
  unlockedModuleIds: readonly string[]
}

export interface CourseStanding extends CourseEstimate {
  currentModuleId: string
}

// Mastery and unlocking are derived from the evidence ledger every time the
// course roadmap is drawn; nothing about them is stored. The course supplies its
// modules, in order, so this component never imports the course content.
export function estimateCourse(
  modules: readonly UnlockableModule[],
  evidence: readonly Observation[],
): CourseEstimate {
  const estimated = estimateMastery(
    evidence,
    modules.map(module => module.id),
    masteryParameters,
  )
  return {
    masteries: estimated.map(item => ({ moduleId: item.moduleId, mastery: item.mastery })),
    unlockedModuleIds: unlockedModuleIds(modules, estimated),
  }
}

export function standingFor(estimate: CourseEstimate, currentModuleId: string): CourseStanding {
  return { ...estimate, currentModuleId }
}

// Where a student with no resume point starts: the furthest module their
// evidence has unlocked, which is the first module when they have no evidence.
export function furthestUnlockedModuleId(
  modules: readonly UnlockableModule[],
  estimate: CourseEstimate,
): string {
  return estimate.unlockedModuleIds.at(-1) ?? modules[0]!.id
}
