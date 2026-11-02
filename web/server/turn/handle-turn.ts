import type { ConversationMessage, CurrentExercise, RedrawState, RunOutput, TurnEvent } from '../../shared/turn'
import { forLoopTopic, type Exercise } from '../content/for-loop'
import { knowledgeMap } from '../content/knowledge-map'
import { roleTable } from '../content/role-table'
import type { LanguageModel, TeacherContext } from '../model/language-model'
import { moveKey, type Move } from '../model/moves'
import type { ConversationStore, StoredMessage } from '../storage/conversation-store'
import { decide } from '../verdict/decide'

const teacherFallback = 'The Teacher could not answer just now. Please try again.'

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

export function handleTurn(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
): Promise<RedrawState> {
  studentIdForTurn(request)
  return collectTurn(request, store, model)
}

export function streamTurn(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
): AsyncGenerator<TurnEvent> {
  studentIdForTurn(request)
  return streamTurnBody(request, store, model)
}

async function collectTurn(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
): Promise<RedrawState> {
  let state: RedrawState | undefined
  for await (const event of streamTurnBody(request, store, model)) {
    if (event.type === 'state') state = event.state
  }
  if (!state) throw new Error('The turn did not finish.')
  return state
}

async function* streamTurnBody(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
): AsyncGenerator<TurnEvent> {
  const studentId = studentIdForTurn(request)
  const body = request.body

  if (isOpenEvent(body)) {
    yield { type: 'state', state: await redraw(studentId, await currentExerciseId(studentId, store), store) }
    return
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
    yield { type: 'state', state: await redraw(studentId, exercise.id, store) }
    return
  }

  if (isMessage(body)) {
    if (!model) throw new Error('The Teacher has no language model.')
    const exerciseId = await currentExerciseId(studentId, store)
    await store.appendMessage(studentId, forLoopTopic.id, {
      author: 'student',
      approvedMove: null,
      text: body.text.trim(),
      exerciseId,
    })
    yield* teacherReply(studentId, exerciseId, body, store, model)
    return
  }

  throw new Error('The turn endpoint does not accept that event.')
}

async function* teacherReply(
  studentId: string,
  exerciseId: string,
  body: MessageEvent,
  store: ConversationStore,
  model: LanguageModel,
): AsyncGenerator<TurnEvent> {
  const exercise = exerciseById(exerciseId)
  const context = await teacherContext(studentId, exercise, store, {
    draft: messageDraft(body),
    runOutput: messageRun(body),
  })
  let proposal: Move | null
  try {
    proposal = await model.propose(context)
  }
  catch {
    yield* teacherCouldNotAnswer(studentId, exerciseId, store)
    return
  }
  const verdict = proposal
    ? decide([{ agent: 'teacher', move: proposal }], { topicId: forLoopTopic.id, exerciseId }, roleTable)[0]
    : undefined

  if (!verdict || verdict.decision !== 'allow' || !verdict.move) {
    yield { type: 'state', state: await redraw(studentId, exerciseId, store) }
    return
  }

  let text = ''
  try {
    for await (const delta of model.render(context, verdict.move)) {
      text += delta
      yield { type: 'text', delta }
    }
  }
  catch {
    yield* teacherCouldNotAnswer(studentId, exerciseId, store)
    return
  }

  if (text.trim().length === 0) {
    yield* teacherCouldNotAnswer(studentId, exerciseId, store)
    return
  }

  await store.appendMessage(studentId, forLoopTopic.id, {
    author: 'teacher',
    approvedMove: moveKey(verdict.move),
    text,
    exerciseId,
  })
  yield { type: 'state', state: await redraw(studentId, exerciseId, store) }
}

async function teacherContext(
  studentId: string,
  exercise: Exercise,
  store: ConversationStore,
  seen: { draft: string | null, runOutput: RunOutput | null },
): Promise<TeacherContext> {
  const messages = await store.messages(studentId, forLoopTopic.id)
  return {
    materials: { ...forLoopTopic.materials },
    hintLadder: [...forLoopTopic.hintLadder],
    misconceptionResponses: forLoopTopic.misconceptionResponses.map(item => ({ ...item })),
    exercise: {
      id: exercise.id,
      title: exercise.title,
      statement: exercise.statement,
      starterCode: exercise.starterCode,
    },
    draft: seen.draft,
    runOutput: seen.runOutput,
    conversation: messages.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    })),
  }
}

async function* teacherCouldNotAnswer(
  studentId: string,
  exerciseId: string,
  store: ConversationStore,
): AsyncGenerator<TurnEvent> {
  await store.appendMessage(studentId, forLoopTopic.id, {
    author: 'teacher',
    approvedMove: null,
    text: teacherFallback,
    exerciseId,
  })
  yield { type: 'state', state: await redraw(studentId, exerciseId, store) }
}

function exerciseById(exerciseId: string): Exercise {
  const exercise = forLoopTopic.exercises.find(choice => choice.id === exerciseId)
  if (!exercise) throw new UnknownExerciseError()
  return exercise
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
    approvedMove: message.approvedMove,
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

interface MessageEvent {
  event: 'message'
  text: string
  draft?: unknown
  run?: unknown
}

function messageDraft(body: MessageEvent): string | null {
  return typeof body.draft === 'string' ? body.draft : null
}

function messageRun(body: MessageEvent): RunOutput | null {
  const run = body.run
  if (typeof run !== 'object' || run === null) return null
  if (!('stdout' in run) || !('stderr' in run) || !('error' in run)) return null
  if (typeof run.stdout !== 'string' || typeof run.stderr !== 'string') return null
  if (run.error === null) return { stdout: run.stdout, stderr: run.stderr, error: null }
  if (typeof run.error !== 'object' || run.error === null) return null
  if (!('message' in run.error) || !('line' in run.error)) return null
  if (typeof run.error.message !== 'string' || typeof run.error.line !== 'number') return null
  if (!Number.isInteger(run.error.line) || run.error.line < 1) return null
  return {
    stdout: run.stdout,
    stderr: run.stderr,
    error: { message: run.error.message, line: run.error.line },
  }
}

function isMessage(input: unknown): input is MessageEvent {
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
