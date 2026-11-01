import { forLoopTopic, type Exercise } from '../content/for-loop'
import { knowledgeMap } from '../content/knowledge-map'
import type { ConversationStore, StoredMessage } from '../storage/conversation-store'
import type { ConversationMessage, CurrentExercise, RedrawState } from '../../shared/turn'

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

export function handleTurn(request: TurnRequest, store: ConversationStore): Promise<RedrawState> {
  const studentId = studentIdForTurn(request)
  return redrawTurn(studentId, request.body, store)
}

async function redrawTurn(studentId: string, body: unknown, store: ConversationStore): Promise<RedrawState> {
  if (isOpenEvent(body)) {
    return redraw(studentId, await currentExerciseId(studentId, store), store)
  }

  if (isSelectExercise(body)) {
    const exercise = forLoopTopic.exercises.find(choice => choice.id === body.exerciseId)
    if (!exercise) throw new UnknownExerciseError()
    await store.saveResumePoint(studentId, {
      topicId: forLoopTopic.id,
      exerciseId: exercise.id,
    })
    await store.appendMessage(studentId, forLoopTopic.id, {
      author: 'event',
      approvedMove: null,
      text: exercise.title,
      exerciseId: exercise.id,
    })
    return redraw(studentId, exercise.id, store)
  }

  if (isMessage(body)) {
    const exerciseId = await currentExerciseId(studentId, store)
    await store.appendMessage(studentId, forLoopTopic.id, {
      author: 'student',
      approvedMove: null,
      text: body.text.trim(),
      exerciseId,
    })
    return redraw(studentId, exerciseId, store)
  }

  throw new Error('The turn endpoint does not accept that event.')
}

async function currentExerciseId(studentId: string, store: ConversationStore): Promise<string> {
  const point = await store.resumePoint(studentId)
  const resumeExercise = point && forLoopTopic.exercises.find(choice => choice.id === point.exerciseId)
  if (resumeExercise) return resumeExercise.id

  const exerciseId = forLoopTopic.exercises[0].id
  await store.saveResumePoint(studentId, { topicId: forLoopTopic.id, exerciseId })
  return exerciseId
}

async function redraw(studentId: string, exerciseId: string, store: ConversationStore): Promise<RedrawState> {
  const exercise = forLoopTopic.exercises.find(choice => choice.id === exerciseId)
  if (!exercise) throw new UnknownExerciseError()
  const messages = await store.messages(studentId, forLoopTopic.id)

  return {
    knowledgeMap: knowledgeMap.map(topic => ({ ...topic })),
    workingArea: {
      mode: 'learn',
      topicId: forLoopTopic.id,
      topicName: forLoopTopic.name,
      materials: { ...forLoopTopic.materials },
      exercise: presentExercise(exercise),
      exercises: forLoopTopic.exercises.map(choice => ({
        id: choice.id,
        title: choice.title,
      })),
    },
    conversation: messages.map(presentMessage),
  }
}

function presentMessage(message: StoredMessage): ConversationMessage {
  const speaker = {
    student: { name: 'You', role: 'Student' },
    teacher: { name: 'Teacher', role: 'Teacher' },
    deskmate: { name: 'Mai', role: 'Deskmate' },
    event: { name: 'Exercise', role: 'Marker' },
  }[message.author]

  return {
    id: message.id,
    author: message.author,
    name: speaker.name,
    role: speaker.role,
    text: message.text,
    exerciseId: message.exerciseId,
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

function isMessage(input: unknown): input is { event: 'message', text: string } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'message'
    && 'text' in input
    && typeof input.text === 'string'
    && input.text.trim().length > 0
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
