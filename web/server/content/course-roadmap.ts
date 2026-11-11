import type { RoadmapModule } from '../../shared/turn'

export const course = 'CS 101: Introduction to Python · Semester 1'

// Static for this slice. States and reasons only: mastery is not estimated yet.
// Listed in course order.
export const courseRoadmap: RoadmapModule[] = [
  { id: 'variable', name: 'Variables', summary: 'Foundation', state: 'mastered', current: false },
  { id: 'if_else', name: 'If / else', summary: 'Branching logic', state: 'mastered', current: false },
  { id: 'for_loop', name: 'For loops', summary: 'Repeating with a running total', state: 'open', current: true },
  {
    id: 'nested_loop',
    name: 'Nested loops',
    summary: 'Loops inside loops',
    state: 'closed',
    current: false,
    closedReason: 'Needs For loops.',
  },
]
