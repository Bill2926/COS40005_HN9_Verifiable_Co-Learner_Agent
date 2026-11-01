import { forLoopTopic, type Exercise } from '../content/for-loop'
import { knowledgeMap } from '../content/knowledge-map'
import type { CurrentExercise, RedrawState } from '../../shared/turn'

export class SignInRequiredError extends Error {
  readonly statusCode = 401

  constructor() {
    super('Sign in required')
    this.name = 'SignInRequiredError'
  }
}

export class UnknownExerciseError extends Error {
  readonly statusCode = 400

  constructor() {
    super('That exercise is not part of this topic.')
    this.name = 'UnknownExerciseError'
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

  if (isOpenEvent(request.body)) {
    return workspace(forLoopTopic.exercises[0].id)
  }

  if (isSelectExercise(request.body)) {
    return workspace(request.body.exerciseId)
  }

  throw new Error('The turn endpoint does not accept that event.')
}

function workspace(exerciseId: string): RedrawState {
  const exercise = forLoopTopic.exercises.find(item => item.id === exerciseId)
  if (!exercise) throw new UnknownExerciseError()

  return {
    knowledgeMap: knowledgeMap.map(topic => ({ ...topic })),
    workingArea: {
      mode: 'learn',
      topicId: forLoopTopic.id,
      topicName: forLoopTopic.name,
      materials: { ...forLoopTopic.materials },
      exercise: presentExercise(exercise),
      exercises: forLoopTopic.exercises.map(item => ({
        id: item.id,
        title: item.title,
      })),
    },
    conversation: [],
  }
}

function presentExercise(exercise: Exercise): CurrentExercise {
  return {
    id: exercise.id,
    title: exercise.title,
    statement: exercise.statement,
    starterCode: exercise.starterCode,
    tests: exercise.tests,
  }
}

function isOpenEvent(input: unknown): input is { event: 'open' } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'open'
}

function isSelectExercise(input: unknown): input is { event: 'select_exercise', exerciseId: string } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'select_exercise'
    && 'exerciseId' in input
    && typeof input.exerciseId === 'string'
    && input.exerciseId.length > 0
}
