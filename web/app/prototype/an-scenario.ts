// Mock data for the layout prototype. An is on for_loop.
// Nothing here is loaded from a server.

export type TopicState = 'mastered' | 'open' | 'closed'

export interface MapTopic {
  id: string
  name: string
  state: TopicState
  closedReason?: string
}

export interface ConversationMessage {
  id: string
  author: 'teacher' | 'student' | 'deskmate'
  name: string
  role: string
  text: string
}

export interface TraceEntry {
  agent: string
  move: string
  verdict: string
}

export const knowledgeMap: MapTopic[] = [
  { id: 'variable', name: 'Variables', state: 'mastered' },
  { id: 'if_else', name: 'If / else', state: 'mastered' },
  { id: 'for_loop', name: 'For loops', state: 'open' },
  {
    id: 'nested_loop',
    name: 'Nested loops',
    state: 'closed',
    closedReason: 'needs for_loop',
  },
]

export const currentTopicId = 'for_loop'

export const materials = {
  topicName: 'For loops',
  heading: 'Accumulating a total',
  body: 'A running total needs a variable that survives every pass of the loop.',
  example: `s = 0
for x in ds:
    s = s + x`,
  scopeNote: 'These materials belong to this topic alone.',
}

export const exercise = {
  title: 'Sum of a list',
  statement:
    'Add up every number in a list. Use a for loop. Create the total before the loop so it survives every pass.',
  draft: `def total(ds):
    for x in ds:
        s = 0
        s = s + x
    return s
`,
  latestRun: '0',
}

export const conversation: ConversationMessage[] = [
  {
    id: 'an-1',
    author: 'student',
    name: 'An',
    role: 'Student',
    text: 'Inside the loop, I think.',
  },
  {
    id: 'teacher-1',
    author: 'teacher',
    name: 'Teacher',
    role: 'Teacher',
    text: 'Where does the total live?',
  },
  {
    id: 'mai-1',
    author: 'deskmate',
    name: 'Mai',
    role: 'Deskmate',
    text: 'Mine printed 0 every time too.',
  },
]

export const shieldTrace = {
  heading: 'Shield: not active yet',
  entries: [
    { agent: 'Teacher', move: 'address_misconception', verdict: 'allow' },
    { agent: 'Mai', move: 'share_confusion', verdict: 'allow' },
  ] satisfies TraceEntry[],
}

export function topicStateLabel(state: TopicState): string {
  if (state === 'mastered') return 'Mastered'
  if (state === 'open') return 'Open'
  return 'Closed'
}
