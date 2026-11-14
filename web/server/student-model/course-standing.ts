import { estimateMastery, unlockedModuleIds, type Observation, type UnlockableModule } from './estimate'
import { masteryParametersFor } from './mastery-parameters'

// What the evidence says about the course, before anything is known about
// where the student is sitting right now.
export interface CourseEstimate {
  masteries: readonly { moduleId: string, mastery: number }[]
  unlockedModuleIds: readonly string[]
  // The modules with at least one passed exercise. A module is only mastered,
  // on the roadmap or for unlocking, once it is in this set, so the roadmap can
  // tell a module at the threshold with no passed exercise from a mastered one.
  passedExerciseModuleIds: readonly string[]
}

// What the student model needs of a course: its modules in order, and the mastery threshold its
// course spec sets. The course is passed in, so this component never imports course content.
export interface StudiedCourse {
  modules: readonly UnlockableModule[]
  masteryThreshold: number
}

export interface CourseStanding extends CourseEstimate {
  currentModuleId: string
}

// Mastery and unlocking are derived from the evidence ledger every time the
// course roadmap is drawn; nothing about them is stored.
export function estimateCourse(
  course: StudiedCourse,
  evidence: readonly Observation[],
): CourseEstimate {
  const estimated = estimateMastery(
    evidence,
    course.modules.map(module => module.id),
    masteryParametersFor(course.masteryThreshold),
  )
  return {
    masteries: estimated.map(item => ({ moduleId: item.moduleId, mastery: item.mastery })),
    unlockedModuleIds: unlockedModuleIds(course.modules, estimated),
    passedExerciseModuleIds: estimated.filter(item => item.passedExercise).map(item => item.moduleId),
  }
}

export function standingFor(estimate: CourseEstimate, currentModuleId: string): CourseStanding {
  return { ...estimate, currentModuleId }
}

// Where a student with no resume point starts: the furthest module their
// evidence has unlocked, which is the first module when they have no evidence.
export function furthestUnlockedModuleId(
  course: StudiedCourse,
  estimate: CourseEstimate,
): string {
  return estimate.unlockedModuleIds.at(-1) ?? course.modules[0]!.id
}
