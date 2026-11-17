import type { CourseSpec } from './course-spec'
import { conditionalsModule } from './modules/conditionals'
import { gettingStartedModule } from './modules/getting-started'
import { loopsModule } from './modules/loops'
import { stringsModule } from './modules/strings'
import { variablesModule } from './modules/variables'

// Introduction to Programming with Python, as one course spec. Modules 1–5 have content and can be
// studied; modules 6–11 are listed without content, so they stay closed as not available.
export const pythonCourseSpec: CourseSpec = {
  specVersion: 2,
  courseId: 'intro_python',
  title: 'Introduction to Programming with Python',
  masteryThreshold: 0.9,
  parts: [
    'Foundations',
    'Control Flow',
    'Built-in Data Structures',
    'Organizing Code',
    'Working with the Real World',
  ],
  modules: [
    {
      id: 'getting_started',
      name: 'Getting Started with Programming and Python',
      part: 'Foundations',
      summary: 'What programming is, algorithms as steps, and a first program with print() and comments',
      keywords: ['Getting Started with Programming and Python'],
      content: gettingStartedModule,
    },
    {
      id: 'variables',
      name: 'Variables, Data Types, and Operators',
      part: 'Foundations',
      summary: 'Variables, data types, operators, input(), and type casting',
      keywords: ['Variables, Data Types, and Operators'],
      content: variablesModule,
    },
    {
      id: 'strings',
      name: 'Working with Strings',
      part: 'Foundations',
      summary: 'Indexing, slicing, string methods, and f-strings',
      keywords: ['Working with Strings'],
      content: stringsModule,
    },
    {
      id: 'conditionals',
      name: 'Conditional Statements',
      part: 'Control Flow',
      summary: 'if, elif, else, nested conditions, and logical operators',
      keywords: ['Conditional Statements'],
      content: conditionalsModule,
    },
    {
      id: 'loops',
      name: 'Loops',
      part: 'Control Flow',
      summary: 'for, range(), while, break, continue, and nested loops',
      keywords: ['Loops'],
      content: loopsModule,
    },
    {
      id: 'lists_and_tuples',
      name: 'Lists and Tuples',
      part: 'Built-in Data Structures',
      summary: 'Creating, changing, and looping over lists and tuples',
      keywords: ['Lists and Tuples'],
    },
    {
      id: 'dictionaries_and_sets',
      name: 'Dictionaries and Sets',
      part: 'Built-in Data Structures',
      summary: 'Dictionaries, sets, and basic list comprehensions',
      keywords: ['Dictionaries and Sets'],
    },
    {
      id: 'functions',
      name: 'Functions',
      part: 'Organizing Code',
      summary: 'Defining functions, parameters, return values, and scope',
      keywords: ['Functions'],
    },
    {
      id: 'modules_and_library',
      name: 'Modules and the Standard Library',
      part: 'Organizing Code',
      summary: 'import, the standard library, pip, and virtual environments',
      keywords: ['Modules and the Standard Library'],
    },
    {
      id: 'file_handling',
      name: 'File Handling',
      part: 'Working with the Real World',
      summary: 'Reading and writing text, CSV, and JSON files',
      keywords: ['File Handling'],
    },
    {
      id: 'error_handling',
      name: 'Error Handling and Debugging',
      part: 'Working with the Real World',
      summary: 'Errors, try / except / finally, tracebacks, and simple tests',
      keywords: ['Error Handling and Debugging'],
    },
  ],
  outOfCourseKeywords: [
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
  ],
}
