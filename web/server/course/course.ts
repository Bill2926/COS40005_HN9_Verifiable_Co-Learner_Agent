import type { RoadmapModule as StudentRoadmapModule } from '../../shared/turn'
import { masteryThreshold, type CourseStanding } from '../student-model'
import type { CourseScope } from '../verify-shield'

export const courseTitle = 'Introduction to Programming with Python'

export interface CourseModule {
  id: string
  number: number
  name: string
  part: string
  summary: string
  available: boolean
  keywords: readonly string[]
}

// Modules 1–5 are the ones a student can study today. Modules 6–11 stay
// closed as not available, which is what the VerifyShield reads.
export const courseModules: readonly CourseModule[] = [
  {
    id: 'getting_started',
    number: 1,
    name: 'Getting Started with Programming and Python',
    part: 'Foundations',
    summary: 'What programming is, algorithms as steps, and a first program with print() and comments',
    available: true,
    keywords: ['Getting Started with Programming and Python'],
  },
  {
    id: 'variables',
    number: 2,
    name: 'Variables, Data Types, and Operators',
    part: 'Foundations',
    summary: 'Variables, data types, operators, input(), and type casting',
    available: true,
    keywords: ['Variables, Data Types, and Operators'],
  },
  {
    id: 'strings',
    number: 3,
    name: 'Working with Strings',
    part: 'Foundations',
    summary: 'Indexing, slicing, string methods, and f-strings',
    available: true,
    keywords: ['Working with Strings'],
  },
  {
    id: 'conditionals',
    number: 4,
    name: 'Conditional Statements',
    part: 'Control Flow',
    summary: 'if, elif, else, nested conditions, and logical operators',
    available: true,
    keywords: ['Conditional Statements'],
  },
  {
    id: 'loops',
    number: 5,
    name: 'Loops',
    part: 'Control Flow',
    summary: 'for, range(), while, break, continue, and nested loops',
    available: true,
    keywords: ['Loops'],
  },
  {
    id: 'lists_and_tuples',
    number: 6,
    name: 'Lists and Tuples',
    part: 'Built-in Data Structures',
    summary: 'Creating, changing, and looping over lists and tuples',
    available: false,
    keywords: ['Lists and Tuples'],
  },
  {
    id: 'dictionaries_and_sets',
    number: 7,
    name: 'Dictionaries and Sets',
    part: 'Built-in Data Structures',
    summary: 'Dictionaries, sets, and basic list comprehensions',
    available: false,
    keywords: ['Dictionaries and Sets'],
  },
  {
    id: 'functions',
    number: 8,
    name: 'Functions',
    part: 'Organizing Code',
    summary: 'Defining functions, parameters, return values, and scope',
    available: false,
    keywords: ['Functions'],
  },
  {
    id: 'modules_and_library',
    number: 9,
    name: 'Modules and the Standard Library',
    part: 'Organizing Code',
    summary: 'import, the standard library, pip, and virtual environments',
    available: false,
    keywords: ['Modules and the Standard Library'],
  },
  {
    id: 'file_handling',
    number: 10,
    name: 'File Handling',
    part: 'Working with the Real World',
    summary: 'Reading and writing text, CSV, and JSON files',
    available: false,
    keywords: ['File Handling'],
  },
  {
    id: 'error_handling',
    number: 11,
    name: 'Error Handling and Debugging',
    part: 'Working with the Real World',
    summary: 'Errors, try / except / finally, tracebacks, and simple tests',
    available: false,
    keywords: ['Error Handling and Debugging'],
  },
]

export const outOfScope = [
  'OOP: classes, inheritance, and polymorphism',
  'DSA: complexity, stacks, queues, linked lists, trees, graphs, and hand-written sorting and searching',
  'decorators, generators, async, and multithreading',
  'NumPy, pandas, matplotlib, Flask, Django, and machine learning',
] as const

export const outOfCourseKeywords = [
  'classes',
  'inheritance',
  'polymorphism',
  'algorithm complexity',
  'stacks',
  'queues',
  'linked lists',
  'trees',
  'graphs',
  'hand-written sorting and searching',
  'decorators',
  'generators',
  'async',
  'multithreading',
  'numpy',
  'pandas',
  'matplotlib',
  'flask',
  'django',
  'machine learning',
] as const

export const courseScope: CourseScope = {
  modules: courseModules,
  outOfCourseKeywords,
}

export interface RoadmapModule {
  id: string
  number: number
  name: string
  part: string
  state: 'mastered' | 'open' | 'closed'
  mastery: number
  current: boolean
}

export function roadmapForStanding(standing: CourseStanding): RoadmapModule[] {
  return courseModules.map((module) => {
    const placed = placeOnRoadmap(module, standing)
    return {
      id: module.id,
      number: module.number,
      name: module.name,
      part: module.part,
      state: placed.state,
      mastery: placed.mastery,
      current: placed.current,
    }
  })
}

interface RoadmapPlace {
  state: 'mastered' | 'open' | 'closed'
  mastery: number
  current: boolean
}

function placeOnRoadmap(module: CourseModule, standing: CourseStanding): RoadmapPlace {
  const mastery = standing.masteries.find(item => item.moduleId === module.id)?.mastery ?? 0
  const unlocked = standing.unlockedModuleIds.includes(module.id)
  const state = !unlocked ? 'closed' : mastery >= masteryThreshold ? 'mastered' : 'open'
  return { state, mastery, current: module.id === standing.currentModuleId }
}

// The mastery a student is shown, in whole percentage points because that is
// how it is read off the bar. It rounds down, so the bar never reaches the mark
// at the threshold on a module that is still open. The unrounded estimate stays
// in the VerifyShield trace and the decision log, where the exact number counts.
function shownMastery(mastery: number): number {
  return Math.floor(mastery * 100) / 100
}

export function closedReasonFor(module: CourseModule): string {
  if (!module.available) return 'Not available yet'
  const previous = courseModules.find(item => item.number === module.number - 1)
  if (!previous) return 'Not available yet'
  return `Needs Module ${previous.number}: ${previous.name} mastered`
}

export function presentedRoadmap(standing: CourseStanding): StudentRoadmapModule[] {
  return courseModules.map((module) => {
    const placed = placeOnRoadmap(module, standing)
    const named = {
      id: module.id,
      name: module.name,
      part: module.part,
      summary: module.summary,
      current: placed.current,
    }
    // A closed module shows the lock and the reason, and no mastery: a number
    // is only shown where it means something.
    if (placed.state === 'closed') {
      return { ...named, state: 'closed', closedReason: closedReasonFor(module) }
    }
    return { ...named, state: placed.state, mastery: shownMastery(placed.mastery) }
  })
}

export function redirectText(scope: string, currentModuleId: string): string {
  const current = courseModules.find(module => module.id === currentModuleId)
  const currentName = current?.name ?? 'this module'
  if (scope === 'out_of_course') {
    return `That's outside this course. Let's stay with ${currentName}.`
  }

  const target = courseModules.find(module => module.id === scope)
  if (!target) return `That's outside this course. Let's stay with ${currentName}.`

  const previous = courseModules.find(module => module.number === target.number - 1)
  const where = target.available
    ? `which opens after you master ${previous?.name ?? 'the previous module'}`
    : 'which is not available yet'
  return `That's part of Module ${target.number}: ${target.name}, ${where}. Let's stay with ${currentName}.`
}
