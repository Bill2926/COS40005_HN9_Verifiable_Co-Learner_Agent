import { describe, expect, it } from 'vitest'
import { courseFromSpec, parseCourseSpec, pythonCourseSpec, type CourseSpec, type ModuleContent } from '../server/course'

const someContent: ModuleContent = pythonCourseSpec.modules[0]!.content!

function specWith(overrides: Partial<CourseSpec>): CourseSpec {
  return {
    specVersion: 2,
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

describe('course spec parser', () => {
  it('parses every block type', () => {
    const spec = structuredClone(pythonCourseSpec)
    const materials = [
      { type: 'text' as const, markdown: 'Hello' },
      { type: 'code' as const, code: 'print(1)' },
      { type: 'image' as const, url: 'https://example.com/a.png', alt: 'A sketch of a variable' },
      { type: 'video' as const, url: 'https://vimeo.com/76979871', title: 'A short clip' },
    ]
    spec.modules[0]!.content!.materials = materials
    expect(parseCourseSpec(JSON.stringify(spec)).modules[0]?.content?.materials).toEqual(materials)
  })

  it('converts the old materials shape into blocks', () => {
    const legacy = {
      ...pythonCourseSpec,
      specVersion: 1,
      modules: pythonCourseSpec.modules.map((module, index) => index === 0
        ? {
            ...module,
            content: {
              ...module.content!,
              materials: {
                heading: 'A first program',
                body: 'A program is a list of steps.',
                example: 'print(1)',
                keyPoint: 'Quotes hold text.',
                scopeNote: 'This module only.',
              },
            },
          }
        : module),
    }
    const parsed = parseCourseSpec(JSON.stringify(legacy))
    expect(parsed.specVersion).toBe(2)
    expect(parsed.modules[0]?.content?.materials).toEqual([
      { type: 'text', markdown: '## A first program\n\nA program is a list of steps.' },
      { type: 'code', code: 'print(1)' },
      { type: 'text', markdown: '**Key point.** Quotes hold text.\n\nThis module only.' },
    ])
  })

  it('rejects a block that is missing a field and names the module and block', () => {
    const spec = structuredClone(pythonCourseSpec)
    spec.modules[0]!.content!.materials = [{ type: 'image', url: '/a.png', alt: '' }]
    expect(() => parseCourseSpec(JSON.stringify(spec))).toThrow('Module getting_started, block 1: alt is missing.')
  })

  it('refuses a spec that still has a diagram block', () => {
    const spec = structuredClone(pythonCourseSpec) as unknown as { modules: { content: { materials: unknown[] } }[] }
    spec.modules[0]!.content.materials = [{ type: 'diagram', mermaid: 'flowchart LR\n  a --> b' }]
    expect(() => parseCourseSpec(JSON.stringify(spec))).toThrow('Module getting_started, block 1: type is not a materials block.')
  })

  it.each([
    ['markdown', { type: 'text', markdown: ' ' }],
    ['code', { type: 'code', code: '' }],
    ['url', { type: 'image', url: ' ', alt: 'A sketch of a variable' }],
    ['alt', { type: 'image', url: 'https://example.com/a.png', alt: '' }],
    ['title', { type: 'video', url: 'https://example.com/clip', title: ' ' }],
  ])('rejects a block missing %s and names the module and block', (field, block) => {
    const raw = JSON.parse(JSON.stringify(pythonCourseSpec)) as { modules: { content: { materials: unknown } }[] }
    raw.modules[0]!.content.materials = [block]
    expect(() => parseCourseSpec(JSON.stringify(raw))).toThrow(`Module getting_started, block 1: ${field} is missing.`)
  })

  it('names the module and the block by their place when a later block is malformed', () => {
    const raw = JSON.parse(JSON.stringify(pythonCourseSpec)) as { modules: { id: string, content?: { materials: unknown } }[] }
    raw.modules[1]!.content!.materials = [
      { type: 'text', markdown: 'Kept' },
      { type: 'code', code: '' },
    ]
    expect(() => parseCourseSpec(JSON.stringify(raw))).toThrow('Module variables, block 2: code is missing.')
  })

  it('rejects a block whose type is not a materials block and names the module and block', () => {
    const raw = JSON.parse(JSON.stringify(pythonCourseSpec)) as { modules: { content: { materials: unknown } }[] }
    raw.modules[0]!.content.materials = [{ type: 'audio', url: 'https://example.com/a.mp3' }]
    expect(() => parseCourseSpec(JSON.stringify(raw))).toThrow('Module getting_started, block 1: type is not a materials block.')
  })

  it('parses the seeded Python spec', () => {
    expect(parseCourseSpec(JSON.stringify(pythonCourseSpec))).toEqual(pythonCourseSpec)
  })

  it('includes an image with alt text and a video in the seeded Python spec', () => {
    const blocks = pythonCourseSpec.modules.flatMap(module => module.content?.materials ?? [])
    expect(blocks).toContainEqual({
      type: 'image',
      url: '/course-images/first-program.png',
      alt: 'Diagram: A program leads to print().',
    })
    expect(blocks).toContainEqual({
      type: 'video',
      url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8',
      title: 'A first Python program',
    })
  })
})

