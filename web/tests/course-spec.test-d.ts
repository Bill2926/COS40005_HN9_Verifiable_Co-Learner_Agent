import { describe, it } from 'vitest'
import { pythonCourseSpec, type ModuleContent } from '../server/course'

const someContent: ModuleContent = pythonCourseSpec.modules[0]!.content!

// The course spec's shape enforces the counts every course keeps, so a spec that breaks one does
// not compile.
describe('course spec shape', () => {
  it('refuses a quiz without exactly three questions', () => {
    // @ts-expect-error a quiz has exactly three questions
    const twoQuestions: ModuleContent = { ...someContent, quiz: [someContent.quiz[0], someContent.quiz[1]] }
    void twoQuestions
  })

  it('refuses a quiz question without exactly four choices', () => {
    const [first, second, third] = someContent.quiz
    // @ts-expect-error a quiz question has exactly four choices
    const threeChoices: ModuleContent = { ...someContent, quiz: [{ ...first, choices: ['a', 'b', 'c'] }, second, third] }
    void threeChoices
  })

  it('refuses an exercise without exactly three tests', () => {
    const [first, ...rest] = someContent.exercises
    // @ts-expect-error an exercise has exactly three tests
    const twoTests: ModuleContent = { ...someContent, exercises: [{ ...first, tests: [first.tests[0], first.tests[1]] }, ...rest] }
    void twoTests
  })

  it('refuses fewer than three exercises', () => {
    // @ts-expect-error a module with content has at least three exercises
    const twoExercises: ModuleContent = { ...someContent, exercises: [someContent.exercises[0], someContent.exercises[1]] }
    void twoExercises
  })

  it('refuses a hint ladder without exactly three rungs', () => {
    // @ts-expect-error a hint ladder has exactly three rungs
    const twoRungs: ModuleContent = { ...someContent, hintLadder: ['one', 'two'] }
    void twoRungs
  })
})
