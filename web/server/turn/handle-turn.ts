import { forLoopTopic } from '../content/for-loop'
import { knowledgeMap } from '../content/knowledge-map'
import type { RedrawState } from '../../shared/turn'

export function handleTurn(input: unknown): RedrawState {
  if (!isOpenEvent(input)) {
    throw new Error('The turn endpoint only accepts an open event.')
  }

  return {
    knowledgeMap: knowledgeMap.map(topic => ({ ...topic })),
    workingArea: {
      mode: 'learn',
      topicId: forLoopTopic.id,
      topicName: forLoopTopic.name,
      materials: { ...forLoopTopic.materials },
    },
    conversation: [],
  }
}

function isOpenEvent(input: unknown): input is { event: 'open' } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'open'
}
