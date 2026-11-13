import { describe, expect, it } from 'vitest'
import { courseModules, presentedRoadmap } from '../server/course'
import { estimateCourse, standingFor, type Observation } from '../server/student-model'

const moduleId = 'getting_started'

// Three correct answers that are not exercise submissions: they raise the first
// module to the threshold, but pass no exercise.
const quizPasses: Observation[] = Array.from({ length: 3 }, () => ({
  moduleId,
  exerciseId: null,
  allPassed: true,
}))

// A passing submission on each of the first module's three exercises.
const exercisePasses: Observation[] = ['say_hello', 'join_words', 'sign_the_program']
  .map(exerciseId => ({ moduleId, exerciseId, allPassed: true }))

function roadmapFor(evidence: readonly Observation[]) {
  const standing = standingFor(estimateCourse(courseModules, evidence), moduleId)
  return presentedRoadmap(standing)
}

describe('presented roadmap', () => {
  it('shows a module at the threshold with no passed exercise as open with a reason', () => {
    const module = roadmapFor(quizPasses).find(item => item.id === moduleId)

    expect(module?.state).toBe('open')
    expect(module && 'masteryReason' in module ? module.masteryReason : undefined)
      .toMatch(/pass an exercise/i)
  })

  it('shows a module mastered once an exercise is passed on top of the threshold', () => {
    const module = roadmapFor(exercisePasses).find(item => item.id === moduleId)

    expect(module?.state).toBe('mastered')
  })

  it('gives an ordinary open module no mastery reason', () => {
    const module = roadmapFor([{ moduleId, exerciseId: 'say_hello', allPassed: true }])
      .find(item => item.id === moduleId)

    expect(module?.state).toBe('open')
    expect(module && 'masteryReason' in module ? module.masteryReason : undefined)
      .toBeUndefined()
  })
})
