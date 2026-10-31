import type { MapTopic } from '../../shared/turn'

// Static for this slice. States and reasons only: mastery is not estimated yet.
export const knowledgeMap: MapTopic[] = [
  { id: 'variable', name: 'Variables', state: 'mastered', current: false },
  { id: 'if_else', name: 'If / else', state: 'mastered', current: false },
  { id: 'for_loop', name: 'For loops', state: 'open', current: true },
  {
    id: 'nested_loop',
    name: 'Nested loops',
    state: 'closed',
    current: false,
    closedReason: 'needs for_loop',
  },
]
