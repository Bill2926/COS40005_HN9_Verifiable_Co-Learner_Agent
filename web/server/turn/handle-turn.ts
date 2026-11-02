import type { AgentTrace, ConversationMessage, CurrentExercise, PracticeTestResult, RedrawState, RunOutput, TurnEvent, TurnTrace } from '../../shared/turn'
import { forLoopTopic, type Exercise } from '../content/for-loop'
import { knowledgeMap } from '../content/knowledge-map'
import { roleTable } from '../content/role-table'
import type { DeskmateContext, LanguageModel, SubmissionCheck, TeacherContext } from '../model/language-model'
import { moveKey, type Move } from '../model/moves'
import type { ConversationStore, StoredMessage } from '../storage/conversation-store'
import { decide, type Verdict } from '../verdict/decide'

const teacherFallback = 'The Teacher could not answer just now. Please try again.'
const deskmateFallback = 'Mai could not answer just now. Please try again.'

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
    const exerciseId = await currentExerciseId(studentId, store)
    const existing = await store.messages(studentId, forLoopTopic.id)
    if (existing.length === 0 && model) {
      yield* introduceTopic(studentId, exerciseId, store, model)
      return
    }
    const mode = existing.length === 0 ? 'learn' : null
    yield { type: 'state', state: await redraw(studentId, exerciseId, store, mode) }
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
    yield { type: 'state', state: await redraw(studentId, exercise.id, store, null) }
    return
  }

  if (isSubmission(body)) {
    if (!model) throw new Error('The agents have no language model.')
    const exerciseId = await currentExerciseId(studentId, store)
    await store.appendMessage(studentId, forLoopTopic.id, {
      author: 'event',
      approvedMove: null,
      text: submissionSummary(body.results),
      exerciseId,
    })
    yield* answerMessage(studentId, exerciseId, {
      draft: null,
      runOutput: null,
      submission: { code: body.code, results: body.results },
    }, store, model)
    return
  }

  if (isMessage(body)) {
    if (!model) throw new Error('The agents have no language model.')
    const exerciseId = await currentExerciseId(studentId, store)
    await store.appendMessage(studentId, forLoopTopic.id, {
      author: 'student',
      approvedMove: null,
      text: body.text.trim(),
      exerciseId,
    })
    yield* answerMessage(studentId, exerciseId, {
      draft: messageDraft(body),
      runOutput: messageRun(body),
      submission: null,
    }, store, model)
    return
  }

  throw new Error('The turn endpoint does not accept that event.')
}

async function* introduceTopic(
  studentId: string,
  exerciseId: string,
  store: ConversationStore,
  model: LanguageModel,
): AsyncGenerator<TurnEvent> {
  const context = await teacherContext(studentId, exerciseById(exerciseId), store, {
    draft: null,
    runOutput: null,
    submission: null,
  })

  let proposal: Move | null = null
  try {
    proposal = await model.teacher.propose(context)
  }
  catch {
    yield { type: 'state', state: await redraw(studentId, exerciseId, store, 'learn') }
    return
  }

  const move = proposal && isTeachingMove(proposal) ? proposal : { type: 'explain_concept' as const }
  const verdicts = decide(
    [{ agent: 'teacher', move }],
    { topicId: forLoopTopic.id, exerciseId },
    roleTable,
  )
  const verdict = verdicts.find(item => item.agent === 'teacher')
  const trace = shieldTrace(move, null, verdicts)

  if (verdict?.decision === 'allow' && verdict.move && isTeachingMove(verdict.move)) {
    const text = yield* streamTeacherReply(model, context, verdict.move)
    if (text) {
      await store.appendMessage(studentId, forLoopTopic.id, {
        author: 'teacher',
        approvedMove: moveKey(verdict.move),
        text,
        exerciseId,
      })
    }
  }

  yield { type: 'state', state: { ...await redraw(studentId, exerciseId, store, 'learn'), trace } }
}

function isTeachingMove(move: Move): boolean {
  return move.type === 'explain_concept' || move.type === 'answer_question'
}

async function* streamTeacherReply(
  model: LanguageModel,
  context: TeacherContext,
  move: Move,
): AsyncGenerator<TurnEvent, string | null> {
  let text = ''
  try {
    for await (const delta of model.teacher.render(context, move)) {
      text += delta
      yield { type: 'text', author: 'teacher', delta }
    }
  }
  catch {
    return null
  }
  return text.trim().length > 0 ? text : null
}

async function* answerMessage(
  studentId: string,
  exerciseId: string,
  seen: SeenWork,
  store: ConversationStore,
  model: LanguageModel,
): AsyncGenerator<TurnEvent> {
  const exercise = exerciseById(exerciseId)
  const context = await teacherContext(studentId, exercise, store, seen)
  const deskmate = deskmateContext(context)
  const [teacherSettled, deskmateSettled] = await Promise.allSettled([
    model.teacher.propose(context),
    model.deskmate.propose(deskmate),
  ])

  const teacherMove = teacherSettled.status === 'fulfilled' ? teacherSettled.value : null
  const deskmateMove = deskmateSettled.status === 'fulfilled' ? deskmateSettled.value : null
  const proposals = [
    ...(teacherMove ? [{ agent: 'teacher' as const, move: teacherMove }] : []),
    ...(deskmateMove ? [{ agent: 'deskmate' as const, move: deskmateMove }] : []),
  ]
  const verdicts = decide(proposals, { topicId: forLoopTopic.id, exerciseId }, roleTable)
  const trace = shieldTrace(teacherMove, deskmateMove, verdicts)
  const teacherVerdict = verdicts.find(verdict => verdict.agent === 'teacher')
  const deskmateVerdict = verdicts.find(verdict => verdict.agent === 'deskmate')

  const answered = async (): Promise<RedrawState> => ({
    ...await redraw(studentId, exerciseId, store, null),
    trace,
  })

  if (teacherSettled.status === 'rejected') {
    await rememberTeacherCouldNotAnswer(studentId, exerciseId, store)
    yield { type: 'state', state: await answered() }
  }
  else if (teacherVerdict?.decision === 'allow' && teacherVerdict.move) {
    const text = yield* streamTeacherReply(model, context, teacherVerdict.move)
    if (!text) {
      await rememberTeacherCouldNotAnswer(studentId, exerciseId, store)
      yield { type: 'state', state: await answered() }
    }
    else {
      await store.appendMessage(studentId, forLoopTopic.id, {
        author: 'teacher',
        approvedMove: moveKey(teacherVerdict.move),
        text,
        exerciseId,
      })
    }
  }

  if (deskmateSettled.status === 'rejected') {
    await rememberDeskmateCouldNotAnswer(studentId, exerciseId, store)
  }
  else if (deskmateVerdict?.decision === 'allow' && deskmateVerdict.move) {
    const renderContext = await deskmateContextWithConversation(studentId, deskmate, store)
    let text = ''
    let failed = false
    try {
      for await (const delta of model.deskmate.render(renderContext, deskmateVerdict.move)) {
        text += delta
        yield { type: 'text', author: 'deskmate' as const, delta }
      }
    }
    catch {
      failed = true
    }

    if (failed || text.trim().length === 0) {
      await rememberDeskmateCouldNotAnswer(studentId, exerciseId, store)
    }
    else {
      await store.appendMessage(studentId, forLoopTopic.id, {
        author: 'deskmate',
        approvedMove: moveKey(deskmateVerdict.move),
        text,
        exerciseId,
      })
    }
  }

  yield { type: 'state', state: await answered() }
}

function shieldTrace(
  teacherMove: Move | null,
  deskmateMove: Move | null,
  verdicts: readonly Verdict[],
): TurnTrace {
  return {
    active: false,
    agents: [
      tracedAgent('teacher', teacherMove, verdicts),
      tracedAgent('deskmate', deskmateMove, verdicts),
    ],
  }
}

function tracedAgent(
  agent: 'teacher' | 'deskmate',
  move: Move | null,
  verdicts: readonly Verdict[],
): AgentTrace {
  if (!move) return { agent, proposal: null, verdict: null }
  const verdict = verdicts.find(item => item.agent === agent)
  if (!verdict) return { agent, proposal: moveKey(move), verdict: null }
  return {
    agent,
    proposal: moveKey(move),
    verdict: {
      decision: verdict.decision,
      ruleId: verdict.ruleId,
      reasonCode: verdict.reasonCode,
    },
  }
}

async function teacherContext(
  studentId: string,
  exercise: Exercise,
  store: ConversationStore,
  seen: SeenWork,
): Promise<TeacherContext> {
  const messages = await store.messages(studentId, forLoopTopic.id)
  return {
    materials: { ...forLoopTopic.materials },
    hintLadder: [...forLoopTopic.hintLadder],
    misconceptionResponses: forLoopTopic.misconceptionResponses.map(response => ({ ...response })),
    exercise: {
      id: exercise.id,
      title: exercise.title,
      statement: exercise.statement,
      starterCode: exercise.starterCode,
    },
    draft: seen.draft,
    runOutput: seen.runOutput,
    submission: copySubmission(seen.submission),
    conversation: messages.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    })),
  }
}

function deskmateContext(context: TeacherContext): DeskmateContext {
  return {
    misconceptionResponses: context.misconceptionResponses.map(response => ({ ...response })),
    exerciseStatement: context.exercise.statement,
    draft: context.draft,
    runOutput: context.runOutput,
    submission: copySubmission(context.submission),
    conversation: context.conversation.map(message => ({ ...message })),
  }
}

async function deskmateContextWithConversation(
  studentId: string,
  context: DeskmateContext,
  store: ConversationStore,
): Promise<DeskmateContext> {
  const messages = await store.messages(studentId, forLoopTopic.id)
  return {
    ...context,
    conversation: messages.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    })),
  }
}

async function rememberTeacherCouldNotAnswer(
  studentId: string,
  exerciseId: string,
  store: ConversationStore,
): Promise<void> {
  await store.appendMessage(studentId, forLoopTopic.id, {
    author: 'teacher',
    approvedMove: null,
    text: teacherFallback,
    exerciseId,
  })
}

async function rememberDeskmateCouldNotAnswer(
  studentId: string,
  exerciseId: string,
  store: ConversationStore,
): Promise<void> {
  await store.appendMessage(studentId, forLoopTopic.id, {
    author: 'deskmate',
    approvedMove: null,
    text: deskmateFallback,
    exerciseId,
  })
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

async function redraw(
  studentId: string,
  exerciseId: string,
  store: ConversationStore,
  mode: 'learn' | null = null,
): Promise<RedrawState> {
  const exercise = forLoopTopic.exercises.find(choice => choice.id === exerciseId)
  if (!exercise) throw new UnknownExerciseError()
  const messages = await store.messages(studentId, forLoopTopic.id)

  return {
    knowledgeMap: knowledgeMap.map(topic => ({ ...topic })),
    workingArea: {
      mode,
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
  const speaker = message.author === 'event' && isSubmissionSummary(message.text)
    ? { name: 'Practice check', role: 'Result' }
    : {
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
    openInLearn: message.author === 'teacher'
      && (message.approvedMove === 'explain_concept' || message.approvedMove === 'answer_question'),
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

interface SeenWork {
  draft: string | null
  runOutput: RunOutput | null
  submission: SubmissionCheck | null
}

interface MessageEvent {
  event: 'message'
  text: string
  draft?: unknown
  run?: unknown
}

function copySubmission(submission: SubmissionCheck | null): SubmissionCheck | null {
  if (!submission) return null
  return {
    code: submission.code,
    results: submission.results.map(result => ({ ...result })),
  }
}

interface SubmissionEvent {
  event: 'submission'
  code: string
  results: PracticeTestResult[]
}

function submissionSummary(results: readonly { passed: boolean }[]): string {
  const passed = results.filter(result => result.passed).length
  return `${passed}/${results.length} tests passed`
}

function isSubmissionSummary(text: string): boolean {
  return /^\d+\/\d+ tests passed$/.test(text)
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

function isSubmission(input: unknown): input is SubmissionEvent {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'submission'
    && 'code' in input
    && typeof input.code === 'string'
    && 'results' in input
    && Array.isArray(input.results)
    && input.results.length > 0
    && input.results.every(isPracticeResult)
}

function isPracticeResult(input: unknown): input is PracticeTestResult {
  return typeof input === 'object'
    && input !== null
    && 'name' in input
    && typeof input.name === 'string'
    && input.name.length > 0
    && 'passed' in input
    && typeof input.passed === 'boolean'
    && 'expected' in input
    && typeof input.expected === 'string'
    && 'actual' in input
    && typeof input.actual === 'string'
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
