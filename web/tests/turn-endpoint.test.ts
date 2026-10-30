import { describe, expect, it } from 'vitest'
import { handleTurn } from '../server/turn/handle-turn'

describe('turn endpoint', () => {
  it('open returns the topic states, the closed reason, and Learn mode', () => {
    const state = handleTurn({ event: 'open' })

    expect(state.knowledgeMap).toEqual([
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
    ])
    expect(state.workingArea).toEqual({
      mode: 'learn',
      topicId: 'for_loop',
      topicName: 'For loops',
      materials: {
        heading: 'Accumulating a total',
        body: 'A running total needs a variable that survives every pass of the loop.',
        example: 's = 0\nfor x in ds:\n    s = s + x',
        scopeNote: 'These materials belong to this topic alone.',
      },
    })
    expect(state.conversation).toEqual([])
  })
})
