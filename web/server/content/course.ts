import type { CourseScope } from '../verdict/decide'

export interface CourseModule {
  id: string
  number: number
  name: string
  part: string
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
    available: true,
    keywords: ['Getting Started with Programming and Python'],
  },
  {
    id: 'variables',
    number: 2,
    name: 'Variables, Data Types, and Operators',
    part: 'Foundations',
    available: true,
    keywords: ['Variables, Data Types, and Operators'],
  },
  {
    id: 'strings',
    number: 3,
    name: 'Working with Strings',
    part: 'Foundations',
    available: true,
    keywords: ['Working with Strings'],
  },
  {
    id: 'conditionals',
    number: 4,
    name: 'Conditional Statements',
    part: 'Control Flow',
    available: true,
    keywords: ['Conditional Statements'],
  },
  {
    id: 'loops',
    number: 5,
    name: 'Loops',
    part: 'Control Flow',
    available: true,
    keywords: ['Loops'],
  },
  {
    id: 'lists_and_tuples',
    number: 6,
    name: 'Lists and Tuples',
    part: 'Built-in Data Structures',
    available: false,
    keywords: ['Lists and Tuples'],
  },
  {
    id: 'dictionaries_and_sets',
    number: 7,
    name: 'Dictionaries and Sets',
    part: 'Built-in Data Structures',
    available: false,
    keywords: ['Dictionaries and Sets'],
  },
  {
    id: 'functions',
    number: 8,
    name: 'Functions',
    part: 'Organizing Code',
    available: false,
    keywords: ['Functions'],
  },
  {
    id: 'modules_and_library',
    number: 9,
    name: 'Modules and the Standard Library',
    part: 'Organizing Code',
    available: false,
    keywords: ['Modules and the Standard Library'],
  },
  {
    id: 'file_handling',
    number: 10,
    name: 'File Handling',
    part: 'Working with the Real World',
    available: false,
    keywords: ['File Handling'],
  },
  {
    id: 'error_handling',
    number: 11,
    name: 'Error Handling and Debugging',
    part: 'Working with the Real World',
    available: false,
    keywords: ['Error Handling and Debugging'],
  },
]

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

export const masteryThreshold = 0.9

export interface CourseStanding {
  currentModuleId: string
  masteries: readonly { moduleId: string, mastery: number }[]
  unlockedModuleIds: readonly string[]
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
    const mastery = standing.masteries.find(item => item.moduleId === module.id)?.mastery ?? 0
    const unlocked = standing.unlockedModuleIds.includes(module.id)
    let state: RoadmapModule['state'] = 'closed'
    if (unlocked && mastery >= masteryThreshold) state = 'mastered'
    else if (unlocked) state = 'open'
    return {
      id: module.id,
      number: module.number,
      name: module.name,
      part: module.part,
      state,
      mastery,
      current: module.id === standing.currentModuleId,
    }
  })
}

// Mastery is not estimated yet. The only materials are Loops, so that module
// is current, and Modules 1–5 count as unlocked until evidence decides.
export function standingForCurrentCourse(): CourseStanding {
  return {
    currentModuleId: 'loops',
    masteries: courseModules.map(module => ({ moduleId: module.id, mastery: 0 })),
    unlockedModuleIds: courseModules.filter(module => module.number <= 5).map(module => module.id),
  }
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
