import { z } from 'zod'
import { courseFromSpec } from './course'
import type { CourseSpec } from './course-spec'
import { codeChecks } from './course-spec'
import { normaliseCourseSpec } from './materials'

const exerciseCheck = z.strictObject({ name: z.string(), expression: z.string(), expected: z.string() })
const exercise = z.strictObject({
  id: z.string().min(1),
  title: z.string(),
  statement: z.string(),
  starterCode: z.string(),
  tests: z.tuple([exerciseCheck, exerciseCheck, exerciseCheck]),
  referenceSolution: z.string(),
})
const quizQuestion = z.strictObject({
  id: z.string().min(1),
  prompt: z.string(),
  choices: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string(),
  misconceptions: z.partialRecord(z.enum(['0', '1', '2', '3']), z.string()).optional(),
})
const materialBlock = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), markdown: z.string().min(1) }),
  z.strictObject({ type: z.literal('code'), code: z.string().min(1) }),
  z.strictObject({ type: z.literal('image'), url: z.string().min(1), alt: z.string().min(1) }),
  z.strictObject({ type: z.literal('video'), url: z.string().min(1), title: z.string().min(1) }),
])
const codeCheck = z.enum(codeChecks)
const moduleContent = z.strictObject({
  materials: z.array(materialBlock).min(1),
  quiz: z.tuple([quizQuestion, quizQuestion, quizQuestion]),
  exercises: z.tuple([exercise, exercise, exercise], exercise),
  hintLadder: z.tuple([z.string(), z.string(), z.string()]),
  misconceptionResponses: z.array(z.strictObject({ id: z.string().min(1), response: z.string() })),
  codeMisconception: z.strictObject({
    id: z.string().min(1),
    checks: z.array(codeCheck).min(1),
  }).optional(),
})
const courseSpec = z.strictObject({
  specVersion: z.literal(2),
  courseId: z.string().min(1),
  title: z.string().min(1),
  masteryThreshold: z.number().min(0.5).max(0.99),
  failuresBeforeRevision: z.int().min(1).max(10).optional(),
  parts: z.array(z.string()),
  modules: z.array(z.strictObject({
    id: z.string().min(1),
    name: z.string(),
    part: z.string(),
    summary: z.string(),
    keywords: z.array(z.string()),
    content: moduleContent.optional(),
  })),
  outOfCourseKeywords: z.array(z.string()),
})

export function parseCourseSpec(json: string): CourseSpec {
  const spec = courseSpec.parse(normaliseCourseSpec(JSON.parse(json)))
  courseFromSpec(spec)
  return spec
}
