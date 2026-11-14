import { describe, expect, it } from 'vitest'
import { courseFromSpec, pythonCourseSpec, type CourseSpec, type ModuleContent } from '../server/course'

const someContent: ModuleContent = pythonCourseSpec.modules[0]!.content!

function specWith(overrides: Partial<CourseSpec>): CourseSpec {
  return {
    specVersion: 1,
    courseId: 'tiny',
    title: 'A tiny course',
    masteryThreshold: 0.8,
    parts: ['One'],
    modules: [{ id: 'first', name: 'First', part: 'One', summary: '', keywords: [], content: someContent }],
    outOfCourseKeywords: [],
    ...overrides,
  }
}

describe('a course built from its course spec', () => {
  it('makes the Python course modules 1 to 5 available and 6 to 11 not', () => {
    const course = courseFromSpec(pythonCourseSpec)

    expect(course.modules.map(module => [module.number, module.available])).toEqual([
      [1, true], [2, true], [3, true], [4, true], [5, true],
      [6, false], [7, false], [8, false], [9, false], [10, false], [11, false],
    ])
  })

  it('makes a module available exactly when its spec gives it content', () => {
    const course = courseFromSpec(specWith({
      modules: [
        { id: 'a', name: 'A', part: 'One', summary: '', keywords: [], content: someContent },
        { id: 'b', name: 'B', part: 'One', summary: '', keywords: [] },
        { id: 'c', name: 'C', part: 'One', summary: '', keywords: [], content: someContent },
      ],
    }))

    expect(course.modules.map(module => module.available)).toEqual([true, false, true])
    expect(course.studyModules.map(module => module.id)).toEqual(['a', 'c'])
  })

  it('takes its title and mastery threshold from the spec', () => {
    const course = courseFromSpec(specWith({}))

    expect(course.title).toBe('A tiny course')
    expect(course.masteryThreshold).toBe(0.8)
  })

  it('refuses a module whose part the spec does not list', () => {
    expect(() => courseFromSpec(specWith({
      modules: [{ id: 'a', name: 'A', part: 'Two', summary: '', keywords: [], content: someContent }],
    }))).toThrow(/part/i)
  })

  it('refuses modules that leave a part and come back to it', () => {
    expect(() => courseFromSpec(specWith({
      parts: ['One', 'Two'],
      modules: [
        { id: 'a', name: 'A', part: 'One', summary: '', keywords: [], content: someContent },
        { id: 'b', name: 'B', part: 'Two', summary: '', keywords: [] },
        { id: 'c', name: 'C', part: 'One', summary: '', keywords: [] },
      ],
    }))).toThrow(/order/i)
  })

  it('refuses a course with no modules', () => {
    expect(() => courseFromSpec(specWith({ modules: [] }))).toThrow(/module/i)
  })

  it('refuses a course whose first module has no content', () => {
    expect(() => courseFromSpec(specWith({
      modules: [{ id: 'a', name: 'A', part: 'One', summary: '', keywords: [] }],
    }))).toThrow(/first module/i)
  })

  it('refuses two modules with the same id', () => {
    expect(() => courseFromSpec(specWith({
      modules: [
        { id: 'a', name: 'A', part: 'One', summary: '', keywords: [], content: someContent },
        { id: 'a', name: 'B', part: 'One', summary: '', keywords: [] },
      ],
    }))).toThrow(/same id/i)
  })

  it.each([0, 1.1, 90])('refuses a mastery threshold of %s', (masteryThreshold) => {
    expect(() => courseFromSpec(specWith({ masteryThreshold }))).toThrow(/threshold/i)
  })
})

