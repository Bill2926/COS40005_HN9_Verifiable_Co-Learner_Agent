import { describe, expect, it } from 'vitest'
import { courseModules, studyModules } from '../server/course'

describe('study module content', () => {
  it('covers every available course module and nothing else', () => {
    const available = courseModules.filter(module => module.available).map(module => module.id)
    expect(studyModules.map(module => module.id)).toEqual(available)
  })

  for (const module of studyModules) {
    describe(module.id, () => {
      it('has no name of its own', () => {
        expect(module).not.toHaveProperty('name')
      })

      it('has a quiz of three questions with four choices each', () => {
        expect(module.quiz).toHaveLength(3)
        for (const question of module.quiz) {
          expect(question.id).not.toBe('')
          expect(question.prompt).not.toBe('')
          expect(question.choices).toHaveLength(4)
          for (const choice of question.choices) expect(choice).not.toBe('')
        }
      })

      it('has unique question ids', () => {
        const ids = module.quiz.map(question => question.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('points each question at a real correct choice, with an explanation', () => {
        for (const question of module.quiz) {
          expect(Number.isInteger(question.correctIndex)).toBe(true)
          expect(question.correctIndex).toBeGreaterThanOrEqual(0)
          expect(question.correctIndex).toBeLessThan(4)
          expect(question.explanation).not.toBe('')
        }
      })

      it('resolves every misconception id to a misconception response', () => {
        const known = module.misconceptionResponses.map(item => item.id)
        for (const question of module.quiz) {
          const ids = Object.entries(question.misconceptions ?? {})
          for (const [index, id] of ids) {
            expect(['0', '1', '2', '3']).toContain(index)
            expect(Number(index)).not.toBe(question.correctIndex)
            expect(known).toContain(id)
          }
        }
      })
    })
  }
})
