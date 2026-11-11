import type { AgentTrace, ConversationMessage, CurrentExercise, PracticeTestResult, RedrawState, RunOutput, TurnEvent, TurnTrace } from '../../shared/turn'
import { courseScope, courseTitle, estimateCourse, furthestUnlockedModuleId, masteryThreshold, presentedRoadmap, redirectText, roadmapForStanding, standingFor, type CourseEstimate, type CourseStanding } from '../content/course'
import { canonicalModuleId, studyModule, type Exercise, type StudyModule } from '../content/study-module'
import { roleTable } from '../content/role-table'
import type { DeskmateContext, LanguageModel, SubmissionCheck, TeacherContext } from '../model/language-model'
import { moveKey, type Move } from '../model/moves'
import type { ConversationStore, StoredMessage } from '../storage/conversation-store'
import { createMemoryEvidenceStore, type EvidenceStore } from '../storage/evidence-store'
import type { DecisionLogStore } from '../storage/decision-log'
import { decide, type Proposal, type TurnSnapshot, type Verdict } from '../verdict/decide'

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
    super('That exercise is not part of this module.')
    this.name = 'UnknownExerciseError'
  }
}

interface Placement {
  module: StudyModule
  exercise: Exercise
}

export interface TurnRequest {
  sessionStudentId: string | null
  body: unknown
}

export interface TurnOptions {
  verifyShieldOn?: boolean
  decisions?: DecisionLogStore
  evidence?: EvidenceStore
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
  options?: TurnOptions,
): Promise<RedrawState> {
  studentIdForTurn(request)
  return collectTurn(request, store, model, options)
}

export function streamTurn(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  studentIdForTurn(request)
  return streamTurnBody(request, store, model, options)
}

async function collectTurn(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
  options?: TurnOptions,
): Promise<RedrawState> {
  let state: RedrawState | undefined
  for await (const event of streamTurnBody(request, store, model, options)) {
    if (event.type === 'state') state = event.state
  }
  if (!state) throw new Error('The turn did not finish.')
  return state
}

async function* streamTurnBody(
  request: TurnRequest,
  store: ConversationStore,
  model?: LanguageModel,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  const studentId = studentIdForTurn(request)
  const body = request.body
  // The ledger is read once a turn. A submission appends to it below and the
  // estimate is taken again, so the roadmap the student gets back already
  // counts the submission they just made.
  const ledger = options?.evidence ?? createMemoryEvidenceStore()
  let estimate = estimateCourse(await ledger.forStudent(studentId))
  const placement = await viewPlacement(studentId, store, estimate)
  let standing = standingFor(estimate, placement.module.id)

  if (isOpenEvent(body)) {
    const existing = await store.messages(studentId, placement.module.id)
    if (existing.length === 0 && model) {
      yield* introduceModule(studentId, placement, standing, store, model, options)
      return
    }
    const mode = existing.length === 0 ? 'learn' : null
    yield { type: 'state', state: await redraw(studentId, placement, standing, store, mode) }
    return
  }

  if (isSelectModule(body)) {
    const chosen = studyModule(canonicalModuleId(body.moduleId))
    // Choosing a closed module changes nothing.
    if (!chosen || !standing.unlockedModuleIds.includes(chosen.id)) {
      yield { type: 'state', state: await redraw(studentId, placement, standing, store, null) }
      return
    }
    const point = await store.resumePoint(studentId)
    const sameModule = point !== null && canonicalModuleId(point.moduleId) === chosen.id
    const exercise = sameModule
      ? chosen.exercises.find(item => item.id === point.exerciseId) ?? chosen.exercises[0]
      : chosen.exercises[0]
    const next = { module: chosen, exercise }
    await adoptPlacement(studentId, store, next)
    const existing = await store.messages(studentId, chosen.id)
    yield {
      type: 'state',
      state: await redraw(studentId, next, standingFor(estimate, next.module.id), store, existing.length === 0 ? 'learn' : null),
    }
    return
  }

  if (isSelectExercise(body)) {
    const exercise = placement.module.exercises.find(choice => choice.id === body.exerciseId)
    if (!exercise) throw new UnknownExerciseError()
    const next = { module: placement.module, exercise }
    await adoptPlacement(studentId, store, next)
    await store.appendMessage(studentId, next.module.id, {
      author: 'event',
      approvedMove: null,
      text: exercise.title,
      exerciseId: exercise.id,
    })
    yield { type: 'state', state: await redraw(studentId, next, standing, store, null) }
    return
  }

  if (isSubmission(body)) {
    if (!model) throw new Error('The agents have no language model.')
    await adoptPlacement(studentId, store, placement)
    // A submission is the only thing that produces evidence.
    await ledger.append({
      studentId,
      moduleId: placement.module.id,
      exerciseId: placement.exercise.id,
      testsPassed: body.results.filter(result => result.passed).length,
      testsTotal: body.results.length,
    })
    estimate = estimateCourse(await ledger.forStudent(studentId))
    standing = standingFor(estimate, placement.module.id)
    await store.appendMessage(studentId, placement.module.id, {
      author: 'event',
      approvedMove: null,
      text: submissionSummary(body.results),
      exerciseId: placement.exercise.id,
    })
    yield* answerMessage(studentId, placement, standing, {
      draft: null,
      runOutput: null,
      submission: { code: body.code, results: body.results },
    }, store, model, '', options)
    return
  }

  if (isMessage(body)) {
    if (!model) throw new Error('The agents have no language model.')
    await adoptPlacement(studentId, store, placement)
    await store.appendMessage(studentId, placement.module.id, {
      author: 'student',
      approvedMove: null,
      text: body.text.trim(),
      exerciseId: placement.exercise.id,
    })
    yield* answerMessage(studentId, placement, standing, {
      draft: messageDraft(body),
      runOutput: messageRun(body),
      submission: null,
    }, store, model, body.text.trim(), options)
    return
  }

  throw new Error('The turn endpoint does not accept that event.')
}

async function* introduceModule(
  studentId: string,
  placement: Placement,
  standing: CourseStanding,
  store: ConversationStore,
  model: LanguageModel,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  const context = await teacherContext(studentId, placement, standing, store, {
    draft: null,
    runOutput: null,
    submission: null,
  })

  const snapshot = turnSnapshot(placement, standing, '', options)
  let proposal: Move | null = null
  try {
    proposal = await model.teacher.propose(context)
  }
  catch {
    yield {
      type: 'state',
      state: await redrawWithTrace(studentId, placement, standing, store, 'learn', verifyShieldTrace(null, null, [], snapshot)),
    }
    return
  }
  const proposed = proposal ? { agent: 'teacher' as const, move: proposal } : null
  const proposedVerdict = proposed
    ? decide([proposed], snapshot, roleTable, courseScope)[0]
    : undefined
  const trace = verifyShieldTrace(proposal, null, proposedVerdict ? [proposedVerdict] : [], snapshot)
  const teaching = Boolean(proposal && isTeachingMove(proposal))
  const introduction = teaching
    ? null
    : { agent: 'teacher' as const, move: { type: 'explain_concept' as const } }
  const introductionVerdict = introduction
    ? decide([introduction], snapshot, roleTable, courseScope)[0]
    : undefined
  await recordDecisions(studentId, [
    ...(proposed && proposedVerdict ? [{ proposal: proposed, verdict: proposedVerdict }] : []),
    ...(introduction && introductionVerdict ? [{ proposal: introduction, verdict: introductionVerdict }] : []),
  ], snapshot, options?.decisions)
  const verdict = teaching ? proposedVerdict : introductionVerdict

  if (verdict?.move?.type === 'redirect_to_module') {
    const text = redirectText(verdict.move.scope, snapshot.currentModuleId ?? placement.module.id)
    yield { type: 'text', author: 'teacher', delta: text }
    await speakRedirect(studentId, placement, store, text)
  }
  else if (verdict?.decision === 'allow' && verdict.move && isTeachingMove(verdict.move)) {
    const text = yield* streamTeacherReply(model, context, verdict.move)
    if (text) {
      await store.appendMessage(studentId, placement.module.id, {
        author: 'teacher',
        approvedMove: moveKey(verdict.move),
        text,
        exerciseId: placement.exercise.id,
      })
    }
  }

  yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, 'learn', trace) }
}

function turnSnapshot(
  placement: Placement,
  standing: CourseStanding,
  studentMessage: string,
  options?: TurnOptions,
): TurnSnapshot {
  return {
    moduleId: placement.module.id,
    exerciseId: placement.exercise.id,
    currentModuleId: standing.currentModuleId,
    masteries: standing.masteries,
    unlockedModuleIds: standing.unlockedModuleIds,
    studentMessage,
    verifyShieldOn: options?.verifyShieldOn !== false,
  }
}

async function speakRedirect(
  studentId: string,
  placement: Placement,
  store: ConversationStore,
  text: string,
): Promise<void> {
  await store.appendMessage(studentId, placement.module.id, {
    author: 'teacher',
    approvedMove: 'redirect_to_module',
    text,
    exerciseId: placement.exercise.id,
  })
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
  placement: Placement,
  standing: CourseStanding,
  seen: SeenWork,
  store: ConversationStore,
  model: LanguageModel,
  studentMessage: string,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  const context = await teacherContext(studentId, placement, standing, store, seen)
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
  const snapshot = turnSnapshot(placement, standing, studentMessage, options)
  const verdicts = decide(proposals, snapshot, roleTable, courseScope)
  await recordDecisions(studentId, verdicts.flatMap((verdict) => {
    const proposed = proposals.find(item => item.agent === verdict.agent)
    return proposed ? [{ proposal: proposed, verdict }] : []
  }), snapshot, options?.decisions)
  const trace = verifyShieldTrace(teacherMove, deskmateMove, verdicts, snapshot)
  const teacherVerdict = verdicts.find(verdict => verdict.agent === 'teacher')
  const deskmateVerdict = verdicts.find(verdict => verdict.agent === 'deskmate')

  if (teacherSettled.status === 'rejected') {
    await rememberTeacherCouldNotAnswer(studentId, placement, store)
    yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, null, trace) }
  }
  else if (teacherVerdict?.move?.type === 'redirect_to_module') {
    const text = redirectText(teacherVerdict.move.scope, snapshot.currentModuleId ?? placement.module.id)
    yield { type: 'text', author: 'teacher', delta: text }
    await speakRedirect(studentId, placement, store, text)
  }
  else if (teacherVerdict?.decision === 'allow' && teacherVerdict.move) {
    const text = yield* streamTeacherReply(model, context, teacherVerdict.move)
    if (!text) {
      await rememberTeacherCouldNotAnswer(studentId, placement, store)
      yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, null, trace) }
    }
    else {
      await store.appendMessage(studentId, placement.module.id, {
        author: 'teacher',
        approvedMove: moveKey(teacherVerdict.move),
        text,
        exerciseId: placement.exercise.id,
      })
    }
  }

  if (deskmateSettled.status === 'rejected') {
    await rememberDeskmateCouldNotAnswer(studentId, placement, store)
  }
  else if (deskmateVerdict?.decision === 'allow' && deskmateVerdict.move) {
    const renderContext = await deskmateContextWithConversation(studentId, placement, deskmate, store)
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
      await rememberDeskmateCouldNotAnswer(studentId, placement, store)
    }
    else {
      await store.appendMessage(studentId, placement.module.id, {
        author: 'deskmate',
        approvedMove: moveKey(deskmateVerdict.move),
        text,
        exerciseId: placement.exercise.id,
      })
    }
  }

  yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, null, trace) }
}

async function redrawWithTrace(
  studentId: string,
  placement: Placement,
  standing: CourseStanding,
  store: ConversationStore,
  mode: 'learn' | null,
  trace: TurnTrace,
): Promise<RedrawState> {
  return {
    ...await redraw(studentId, placement, standing, store, mode),
    trace,
  }
}

async function recordDecisions(
  studentId: string,
  ruled: readonly { proposal: Proposal, verdict: Verdict }[],
  snapshot: TurnSnapshot,
  decisions: DecisionLogStore | undefined,
): Promise<void> {
  if (!decisions || ruled.length === 0) return
  const time = new Date().toISOString()
  const turnId = crypto.randomUUID()
  for (const { proposal, verdict } of ruled) {
    await decisions.append({
      time,
      studentId,
      turnId,
      agent: verdict.agent,
      proposedMove: moveKey(proposal.move),
      proposedScope: proposedScope(proposal.move),
      verdict: verdict.decision,
      ruledMove: verdict.move ? moveKey(verdict.move) : null,
      ruledScope: verdict.move ? proposedScope(verdict.move) : null,
      ruleId: verdict.ruleId,
      reasonCode: verdict.reasonCode,
      masteries: (snapshot.masteries ?? []).map(item => ({ ...item })),
      unlockedModuleIds: [...(snapshot.unlockedModuleIds ?? [])],
      verifyShieldOn: snapshot.verifyShieldOn !== false,
    })
  }
}

function verifyShieldTrace(
  teacherMove: Move | null,
  deskmateMove: Move | null,
  verdicts: readonly Verdict[],
  snapshot: TurnSnapshot,
): TurnTrace {
  return {
    active: false,
    verifyShieldOn: snapshot.verifyShieldOn !== false,
    masteries: (snapshot.masteries ?? []).map(item => ({ ...item })),
    unlockedModuleIds: [...(snapshot.unlockedModuleIds ?? [])],
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
  if (!move) return { agent, proposal: null, scope: null, verdict: null }
  const verdict = verdicts.find(item => item.agent === agent)
  if (!verdict) return { agent, proposal: moveKey(move), scope: proposedScope(move), verdict: null }
  return {
    agent,
    proposal: moveKey(move),
    scope: proposedScope(move),
    verdict: {
      decision: verdict.decision,
      ruleId: verdict.ruleId,
      reasonCode: verdict.reasonCode,
    },
  }
}

function proposedScope(move: Move): string | null {
  if (
    move.type === 'explain_concept'
    || move.type === 'answer_question'
    || move.type === 'hint_level_N'
    || move.type === 'address_misconception'
    || move.type === 'redirect_to_module'
  ) {
    return move.scope ?? null
  }
  return null
}

async function teacherContext(
  studentId: string,
  placement: Placement,
  standing: CourseStanding,
  store: ConversationStore,
  seen: SeenWork,
): Promise<TeacherContext> {
  const messages = await store.messages(studentId, placement.module.id)
  return {
    materials: { ...placement.module.materials },
    hintLadder: [...placement.module.hintLadder],
    misconceptionResponses: placement.module.misconceptionResponses.map(response => ({ ...response })),
    exercise: {
      id: placement.exercise.id,
      title: placement.exercise.title,
      statement: placement.exercise.statement,
      starterCode: placement.exercise.starterCode,
    },
    draft: seen.draft,
    runOutput: seen.runOutput,
    submission: copySubmission(seen.submission),
    conversation: messages.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    })),
    roadmap: roadmapForStanding(standing),
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
  placement: Placement,
  context: DeskmateContext,
  store: ConversationStore,
): Promise<DeskmateContext> {
  const messages = await store.messages(studentId, placement.module.id)
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
  placement: Placement,
  store: ConversationStore,
): Promise<void> {
  await store.appendMessage(studentId, placement.module.id, {
    author: 'teacher',
    approvedMove: null,
    text: teacherFallback,
    exerciseId: placement.exercise.id,
  })
}

async function rememberDeskmateCouldNotAnswer(
  studentId: string,
  placement: Placement,
  store: ConversationStore,
): Promise<void> {
  await store.appendMessage(studentId, placement.module.id, {
    author: 'deskmate',
    approvedMove: null,
    text: deskmateFallback,
    exerciseId: placement.exercise.id,
  })
}

async function viewPlacement(
  studentId: string,
  store: ConversationStore,
  estimate: CourseEstimate,
): Promise<Placement> {
  // With no resume point the student starts on the furthest module their
  // evidence has unlocked, which is Module 1 when they have no evidence.
  const opening = studyModule(furthestUnlockedModuleId(estimate))
  if (!opening) throw new Error('The first module of the course is missing.')
  const point = await store.resumePoint(studentId)
  const moduleId = point ? canonicalModuleId(point.moduleId) : opening.id
  const module = studyModule(moduleId)
  if (module && estimate.unlockedModuleIds.includes(module.id)) {
    const exercise = module.exercises.find(item => item.id === point?.exerciseId) ?? module.exercises[0]
    if (!point || point.moduleId !== module.id || point.exerciseId !== exercise.id) {
      await store.saveResumePoint(studentId, { moduleId: module.id, exerciseId: exercise.id })
    }
    return { module, exercise }
  }

  const exercise = opening.exercises[0]
  if (!point) {
    await store.saveResumePoint(studentId, { moduleId: opening.id, exerciseId: exercise.id })
  }
  return { module: opening, exercise }
}

async function adoptPlacement(
  studentId: string,
  store: ConversationStore,
  placement: Placement,
): Promise<void> {
  await store.saveResumePoint(studentId, {
    moduleId: placement.module.id,
    exerciseId: placement.exercise.id,
  })
}

async function redraw(
  studentId: string,
  placement: Placement,
  standing: CourseStanding,
  store: ConversationStore,
  mode: 'learn' | null = null,
): Promise<RedrawState> {
  const messages = await store.messages(studentId, placement.module.id)
  const displayName = await store.displayName(studentId)

  return {
    displayName,
    course: courseTitle,
    courseRoadmap: presentedRoadmap(standing),
    masteryThreshold,
    workingArea: {
      mode,
      moduleId: placement.module.id,
      moduleName: placement.module.name,
      materials: { ...placement.module.materials },
      exercise: presentExercise(placement.exercise),
      exercises: placement.module.exercises.map(choice => ({
        id: choice.id,
        title: choice.title,
      })),
    },
    conversation: messages.map(message => presentMessage(message, displayName)),
  }
}

function presentMessage(message: StoredMessage, displayName: string): ConversationMessage {
  const speaker = message.author === 'event' && isSubmissionSummary(message.text)
    ? { name: 'Practice check', role: 'Result' }
    : {
        student: { name: displayName, role: 'Student' },
        teacher: { name: 'Teacher', role: 'Teacher' },
        deskmate: { name: 'Mai', role: 'Deskmate' },
        event: { name: 'Exercise', role: 'Marker' },
      }[message.author]

  return {
    id: message.id,
    author: message.author,
    name: speaker.name,
    role: message.author === 'teacher' ? teacherMoveLabel(message.approvedMove) : speaker.role,
    text: message.text,
    exerciseId: message.exerciseId,
    approvedMove: message.approvedMove,
    openInLearn: message.author === 'teacher'
      && (message.approvedMove === 'explain_concept' || message.approvedMove === 'answer_question'),
  }
}

function teacherMoveLabel(approvedMove: string | null): string {
  if (approvedMove === 'redirect_to_module') return 'Not yet'
  if (approvedMove === 'explain_concept') return 'Explanation'
  if (approvedMove === 'answer_question') return 'Answer'
  if (approvedMove?.startsWith('hint_level_')) return 'Hint'
  if (approvedMove?.startsWith('address_misconception')) return 'Misconception'
  if (approvedMove === 'reveal_answer') return 'Answer revealed'
  if (approvedMove?.startsWith('advance_to_item')) return 'Next module'
  if (approvedMove === 'stay_and_practise') return 'Keep practising'
  return ''
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

function isSelectModule(input: unknown): input is { event: 'select_module', moduleId: string } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'select_module'
    && 'moduleId' in input
    && typeof input.moduleId === 'string'
    && input.moduleId.length > 0
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
