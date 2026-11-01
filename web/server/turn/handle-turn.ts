import { forLoopTopic } from '../content/for-loop'
import { knowledgeMap } from '../content/knowledge-map'
import type { RedrawState } from '../../shared/turn'

export class SignInRequiredError extends Error {
  readonly statusCode = 401

  constructor() {
    super('Sign in required')
    this.name = 'SignInRequiredError'
  }
}

export interface TurnRequest {
  sessionStudentId: string | null
  body: unknown
}

export function studentIdForTurn(request: TurnRequest): string {
  if (typeof request.sessionStudentId !== 'string' || request.sessionStudentId.length === 0) {
    throw new SignInRequiredError()
  }

  return request.sessionStudentId
}

export function handleTurn(request: TurnRequest): RedrawState {
  studentIdForTurn(request)

  if (!isOpenEvent(request.body)) {
    throw new Error('The turn endpoint only accepts an open event.')
  }

  return openWorkspace()
}

function openWorkspace(): RedrawState {
  const exercise = forLoopTopic.exercises[0]

  return {
    knowledgeMap: knowledgeMap.map(topic => ({ ...topic })),
    workingArea: {
      mode: 'learn',
      topicId: forLoopTopic.id,
      topicName: forLoopTopic.name,
      materials: { ...forLoopTopic.materials },
      exercise: {
        id: exercise.id,
        title: exercise.title,
        statement: exercise.statement,
        starterCode: exercise.starterCode,
      },
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
