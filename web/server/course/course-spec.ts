import type { ExerciseCheck, ModuleMaterials } from '../../shared/turn'

// The course spec: the one value that declares everything a course contains (ADR-0004). The
// tuple types carry the counts every course keeps: a quiz of three questions with four choices
// and one correct, three tests per exercise, at least three exercises, and three hint rungs.

export interface Exercise {
  id: string
  title: string
  statement: string
  starterCode: string
  tests: readonly [ExerciseCheck, ExerciseCheck, ExerciseCheck]
  referenceSolution: string
}

export interface MisconceptionResponse {
  id: string
  response: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  choices: readonly [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  // The misconception a wrong choice shows, by choice index. A wrong choice
  // with no entry shows none.
  misconceptions?: Partial<Record<0 | 1 | 2 | 3, string>>
}

// The source shapes a module's code misconception leaves behind. Each name is
// read by one check in the turn's code findings. The list is the one source of
// the names, so the parser and the checks cannot drift apart from it.
export const codeChecks = [
  'unquoted_text',
  'text_plus_number',
  'separate_branches',
  'accumulator_reset',
  'sum_instead_of_loop',
  'index_from_one',
] as const

export type CodeCheck = (typeof codeChecks)[number]

// The one misconception a module's submitted code can show, and the checks that
// look for it. The id is one of the module's misconception responses.
export interface CodeMisconception {
  id: string
  checks: readonly CodeCheck[]
}

// What a student studies in a module. A module whose spec has none is listed but not available.
export interface ModuleContent {
  materials: ModuleMaterials
  quiz: readonly [QuizQuestion, QuizQuestion, QuizQuestion]
  exercises: readonly [Exercise, Exercise, Exercise, ...Exercise[]]
  hintLadder: readonly [string, string, string]
  misconceptionResponses: readonly MisconceptionResponse[]
  // Absent when no check reads this module's code.
  codeMisconception?: CodeMisconception
}

export interface ModuleSpec {
  id: string
  name: string
  // One of the course spec's parts.
  part: string
  summary: string
  keywords: readonly string[]
  content?: ModuleContent
}

export interface CourseSpec {
  specVersion: 2
  courseId: string
  title: string
  masteryThreshold: number
  parts: readonly string[]
  // In course order: Module 1 first.
  modules: readonly ModuleSpec[]
  outOfCourseKeywords: readonly string[]
}
