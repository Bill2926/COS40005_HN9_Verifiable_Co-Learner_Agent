import type { AgentTrace, ConversationMessage, CurrentExercise, PracticeTestResult, QuizQuestionView, RedrawState, RunOutput, TurnEvent, TurnTrace } from '../../shared/turn'
import { moveKey, roleTable, type Agents, type AnsweredQuizResult, type DeskmateContext, type Move, type SubmissionCheck, type TeacherContext } from '../agents'
import { canonicalModuleId, defaultCourseId, presentedRoadmap, redirectText, roadmapForStanding, studyModule, type Course, type Exercise, type StudyModule } from '../course'
import { createMemoryCourseStore, type CourseStore } from '../storage/course-store'
import type { ConversationStore, ResumePoint, StoredMessage } from '../storage/conversation-store'
import { createMemoryQuizAnswerStore, type QuizAnswerRow, type QuizAnswerStore } from '../storage/quiz-answer-store'
import { createMemoryEvidenceStore, estimateCourse, furthestUnlockedModuleId, standingFor, type CourseEstimate, type CourseStanding, type EvidenceStore, type UnlockStore } from '../student-model'
import type { DecisionLogStore } from '../storage/decision-log'
import { decide, type Proposal, type TurnSnapshot, type Verdict } from '../verify-shield'

const teacherFallback = 'The Teacher could not answer just now. Please try again.'
const deskmateFallback = 'Mai could not answer just now. Please try again.'

// A failed call to the provider used to be swallowed whole, so a wrong model
// name or an unsupported request shape reached the student as "could not
// answer" and left no trace anywhere. The student still sees only the
// fallback; the server log says why.
function logModelFailure(what: string, cause: unknown): void {
  const message = cause instanceof Error ? cause.message : String(cause)
  console.error(`Language model failed (${what}): ${message}`)
}

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

// Where the student is: a module and an exercise in one course. The course is the one read for
// this turn, so every helper that has the placement reads the same course.
interface Placement {
  course: Course
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
  quizAnswers?: QuizAnswerStore
  unlocks?: UnlockStore
  // Where the course is read from, once a turn, and which course. Without them the turn is about
  // the Python course held in memory.
  courses?: CourseStore
  courseId?: string
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
  agents?: Agents,
  options?: TurnOptions,
): Promise<RedrawState> {
  studentIdForTurn(request)
  return collectTurn(request, store, agents, options)
}

export function streamTurn(
  request: TurnRequest,
  store: ConversationStore,
  agents?: Agents,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  studentIdForTurn(request)
  return streamTurnBody(request, store, agents, options)
}

async function collectTurn(
  request: TurnRequest,
  store: ConversationStore,
  agents?: Agents,
  options?: TurnOptions,
): Promise<RedrawState> {
  let state: RedrawState | undefined
  for await (const event of streamTurnBody(request, store, agents, options)) {
    if (event.type === 'state') state = event.state
  }
  if (!state) throw new Error('The turn did not finish.')
  return state
}

async function* streamTurnBody(
  request: TurnRequest,
  store: ConversationStore,
  agents?: Agents,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  const studentId = studentIdForTurn(request)
  const body = request.body
  // The ledger is read once a turn. A submission appends to it below and the
  // estimate is taken again, so the roadmap the student gets back already
  // counts the submission they just made.
  const quizStore = options?.quizAnswers ?? createMemoryQuizAnswerStore()
  const ledger = options?.evidence ?? createMemoryEvidenceStore(quizStore.observationsForStudent)
  const courses = options?.courses ?? createMemoryCourseStore()
  const [course, rows, knownPoint] = await Promise.all([
    courses.course(options?.courseId ?? defaultCourseId),
    ledger.forStudent(studentId),
    store.resumePoint(studentId),
  ])
  const unlocks = options?.unlocks
  let recordedUnlocks = await unlocks?.forStudent(studentId) ?? []
  let legacyUnlocks: readonly string[] = []
  if (course.legacyUnlocks) {
    const { before, threshold } = course.legacyUnlocks
    const legacyEvidence = rows.filter(row => Date.parse(row.time) < Date.parse(before))
    const legacy = estimateCourse({ ...course, masteryThreshold: threshold }, legacyEvidence)
    legacyUnlocks = legacy.unlockedModuleIds
  }
  async function refreshEstimate(evidence: typeof rows): Promise<CourseEstimate> {
    const estimate = estimateCourse(course, evidence, [...recordedUnlocks, ...legacyUnlocks])
    const newlyUnlocked = estimate.unlockedModuleIds.filter(id => !recordedUnlocks.includes(id))
    if (unlocks && newlyUnlocked.length) {
      recordedUnlocks = await unlocks.record(studentId, newlyUnlocked)
      return estimateCourse(course, evidence, recordedUnlocks)
    }
    return estimate
  }
  let estimate = await refreshEstimate(rows)
  const settled = await viewPlacement(course, studentId, store, estimate, knownPoint)
  let placement = settled.placement
  const openedPoint = settled.point
  let standing = standingFor(estimate, placement.module.id)

  if (isOpenEvent(body)) {
    const existing = await store.messages(studentId, placement.module.id)
    if (existing.length === 0 && agents) {
      yield* introduceModule(studentId, placement, standing, store, quizStore, agents, options)
      return
    }
    const mode = existing.length === 0 ? 'learn' : null
    yield { type: 'state', state: await redraw(studentId, placement, standing, store, quizStore, mode) }
    return
  }

  if (isSelectModule(body) || isPreviewModule(body)) {
    const chosen = studyModule(course, canonicalModuleId(body.moduleId))
    // Choosing a closed module changes nothing. A preview never writes the resume point.
    if (!chosen || !standing.unlockedModuleIds.includes(chosen.id)) {
      yield { type: 'state', state: await redraw(studentId, placement, standing, store, quizStore, null) }
      return
    }
    const point = openedPoint
    const sameModule = point !== null && canonicalModuleId(point.moduleId) === chosen.id
    const exercise = sameModule
      ? chosen.exercises.find(item => item.id === point.exerciseId) ?? chosen.exercises[0]
      : chosen.exercises[0]
    const next = { course, module: chosen, exercise }
    const [existing, displayName, quizAnswers] = await Promise.all([
      store.messages(studentId, chosen.id),
      store.displayName(studentId),
      quizStore.forStudentModule(studentId, chosen.id),
      isPreviewModule(body) ? Promise.resolve() : adoptPlacement(studentId, store, next),
    ])
    yield {
      type: 'state',
      state: composeState(next, standingFor(estimate, next.module.id), existing, displayName, existing.length === 0 ? 'learn' : null, quizAnswers),
    }
    return
  }

  if (isSelectExercise(body)) {
    const exercise = placement.module.exercises.find(choice => choice.id === body.exerciseId)
    if (!exercise) throw new UnknownExerciseError()
    const next = { ...placement, exercise }
    await adoptPlacement(studentId, store, next)
    await store.appendMessage(studentId, next.module.id, {
      author: 'event',
      approvedMove: null,
      text: exercise.title,
      exerciseId: exercise.id,
    })
    yield { type: 'state', state: await redraw(studentId, next, standing, store, quizStore, null) }
    return
  }

  if (isQuizAnswer(body)) {
    const marked = await recordQuizAnswer(studentId, placement, store, quizStore, body)
    // Only a stored answer feeds the ledger (through the quiz store), so mastery
    // is taken again only then; an invalid or repeat answer leaves it untouched.
    if (marked.stored) {
      standing = standingFor(await refreshEstimate(await ledger.forStudent(studentId)), placement.module.id)
    }
    // A wrong answer brings the agents in, as a failed submission does; a right
    // answer, and a repeat of an answered question, does not.
    if (marked.stored && !marked.correct && agents) {
      yield* answerMessage(studentId, placement, standing, {
        draft: null,
        runOutput: null,
        submission: null,
      }, store, quizStore, agents, '', options)
      return
    }
    yield { type: 'state', state: await redraw(studentId, placement, standing, store, quizStore, null) }
    return
  }

  if (isSubmission(body)) {
    if (!agents) throw new Error('The agents have no language model.')
    await adoptPlacement(studentId, store, placement)
    // Record the submission before refreshing mastery.
    await ledger.append({
      studentId,
      moduleId: placement.module.id,
      exerciseId: placement.exercise.id,
      testsPassed: body.results.filter(result => result.passed).length,
      testsTotal: body.results.length,
    })
    estimate = await refreshEstimate(await ledger.forStudent(studentId))
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
    }, store, quizStore, agents, '', options)
    return
  }

  if (isMessage(body)) {
    if (!agents) throw new Error('The agents have no language model.')
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
    }, store, quizStore, agents, body.text.trim(), options)
    return
  }

  throw new Error('The turn endpoint does not accept that event.')
}

async function* introduceModule(
  studentId: string,
  placement: Placement,
  standing: CourseStanding,
  store: ConversationStore,
  quizStore: QuizAnswerStore,
  agents: Agents,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  const context = await teacherContext(studentId, placement, standing, store, quizStore, {
    draft: null,
    runOutput: null,
    submission: null,
  })

  const snapshot = turnSnapshot(placement, standing, '', highestHintRung(context.conversation), options)
  let proposal: Move | null = null
  try {
    proposal = await agents.teacher.propose(context)
  }
  catch (cause) {
    logModelFailure('teacher propose', cause)
    yield {
      type: 'state',
      state: await redrawWithTrace(studentId, placement, standing, store, quizStore, 'learn', verifyShieldTrace(null, null, [], snapshot)),
    }
    return
  }
  const proposed = proposal ? { agent: 'teacher' as const, move: proposal } : null
  const proposedVerdict = proposed
    ? decide([proposed], snapshot, roleTable, placement.course.scope)[0]
    : undefined
  const trace = verifyShieldTrace(proposal, null, proposedVerdict ? [proposedVerdict] : [], snapshot)
  const teaching = Boolean(proposal && isTeachingMove(proposal))
  const introduction = teaching
    ? null
    : { agent: 'teacher' as const, move: { type: 'explain_concept' as const, scope: placement.module.id } }
  const introductionVerdict = introduction
    ? decide([introduction], snapshot, roleTable, placement.course.scope)[0]
    : undefined
  await recordDecisions(studentId, [
    ...(proposed && proposedVerdict ? [{ proposal: proposed, verdict: proposedVerdict }] : []),
    ...(introduction && introductionVerdict ? [{ proposal: introduction, verdict: introductionVerdict }] : []),
  ], snapshot, placement.course.masteryThreshold, options?.decisions)
  const verdict = teaching ? proposedVerdict : introductionVerdict

  if (verdict?.move?.type === 'redirect_to_module') {
    const text = redirectText(placement.course, verdict.move.scope, snapshot.moduleId)
    yield { type: 'text', author: 'teacher', delta: text }
    await speakRedirect(studentId, placement, store, text)
  }
  else if (verdict?.decision === 'allow' && verdict.move && isTeachingMove(verdict.move)) {
    const text = yield* streamTeacherReply(agents, context, verdict.move)
    if (text) {
      await store.appendMessage(studentId, placement.module.id, {
        author: 'teacher',
        approvedMove: moveKey(verdict.move),
        text,
        exerciseId: placement.exercise.id,
      })
    }
  }

  yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, quizStore, 'learn', trace) }
}

// Marks a quiz answer and reports whether this call stored it and whether it was
// correct. The resume point is already settled on this module by viewPlacement,
// so a quiz answer writes nothing beyond its own ledger row and event message.
async function recordQuizAnswer(
  studentId: string,
  placement: Placement,
  store: ConversationStore,
  quizStore: QuizAnswerStore,
  event: QuizAnswerEvent,
): Promise<{ stored: boolean, correct: boolean }> {
  const module = placement.module
  const index = canonicalModuleId(event.moduleId) === module.id
    ? module.quiz.findIndex(question => question.id === event.questionId)
    : -1
  const question = index >= 0 ? module.quiz[index] : undefined
  // A stray module id, an unknown question or an out-of-range choice marks
  // nothing and leaves the state as it was.
  if (!question || !isChoiceIndex(event.choice)) {
    return { stored: false, correct: false }
  }
  const correct = event.choice === question.correctIndex
  const recorded = await quizStore.record({
    studentId,
    moduleId: module.id,
    questionId: question.id,
    choice: event.choice,
    correct,
  })
  // The ledger row and the event message are written for the first answer only;
  // later choices the student makes to explore change neither.
  if (recorded.stored) {
    await store.appendMessage(studentId, module.id, {
      author: 'event',
      approvedMove: null,
      text: quizEventText(index + 1, event.choice, correct),
      exerciseId: placement.exercise.id,
    })
  }
  return { stored: recorded.stored, correct: recorded.row.correct }
}

// e.g. "Quiz 2: chose C, wrong". The number is the question's place in the
// module's quiz; the letter is the choice.
function quizEventText(number: number, choice: number, correct: boolean): string {
  return `Quiz ${number}: chose ${'ABCD'[choice]}, ${correct ? 'right' : 'wrong'}`
}

function turnSnapshot(
  placement: Placement,
  standing: CourseStanding,
  studentMessage: string,
  highestHintRung: number,
  options?: TurnOptions,
): TurnSnapshot {
  return {
    moduleId: placement.module.id,
    exerciseId: placement.exercise.id,
    masteries: standing.masteries,
    unlockedModuleIds: standing.unlockedModuleIds,
    studentMessage,
    verifyShieldOn: options?.verifyShieldOn !== false,
    highestHintRung,
    misconceptionIds: placement.module.misconceptionResponses.map(response => response.id),
  }
}

// The highest hint rung already approved in this module's conversation, 0 if
// none. The rung is read back from the move stored with each teacher message;
// only the teacher climbs the ladder, so other authors are not counted.
function highestHintRung(
  conversation: readonly { author: string, approvedMove: string | null }[],
): number {
  let highest = 0
  for (const message of conversation) {
    if (message.author !== 'teacher') continue
    const match = /^hint_level_(\d+)$/.exec(message.approvedMove ?? '')
    if (match) {
      const rung = Number(match[1])
      if (rung > highest) highest = rung
    }
  }
  return highest
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
  agents: Agents,
  context: TeacherContext,
  move: Move,
): AsyncGenerator<TurnEvent, string | null> {
  let text = ''
  try {
    for await (const delta of agents.teacher.render(context, move)) {
      text += delta
      yield { type: 'text', author: 'teacher', delta }
    }
  }
  catch (cause) {
    logModelFailure('teacher render', cause)
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
  quizStore: QuizAnswerStore,
  agents: Agents,
  studentMessage: string,
  options?: TurnOptions,
): AsyncGenerator<TurnEvent> {
  const context = await teacherContext(studentId, placement, standing, store, quizStore, seen)
  const deskmate = deskmateContext(context)
  // Mai's proposal runs while the Teacher is already writing, so the first
  // words are not held back for the second model call.
  const teacherTask = settleCall(agents.teacher.propose(context))
  const deskmateTask = settleCall(agents.deskmate.propose(deskmate))
  const teacherSettled = await teacherTask

  const teacherMove = teacherSettled.status === 'fulfilled' ? teacherSettled.value : null
  const snapshot = turnSnapshot(placement, standing, studentMessage, highestHintRung(context.conversation), options)
  const turnId = crypto.randomUUID()
  const recordedAt = new Date().toISOString()
  const teacherProposals = teacherMove ? [{ agent: 'teacher' as const, move: teacherMove }] : []
  const teacherVerdicts = decide(teacherProposals, snapshot, roleTable, placement.course.scope)
  await recordDecisions(studentId, ruledPairs(teacherProposals, teacherVerdicts), snapshot, placement.course.masteryThreshold, options?.decisions, turnId, recordedAt)
  const teacherVerdict = teacherVerdicts.find(verdict => verdict.agent === 'teacher')

  let teacherFailed = false
  if (teacherSettled.status === 'rejected') {
    logModelFailure('teacher propose', teacherSettled.reason)
    await rememberTeacherCouldNotAnswer(studentId, placement, store)
    teacherFailed = true
  }
  else if (teacherVerdict?.move?.type === 'redirect_to_module') {
    const text = redirectText(placement.course, teacherVerdict.move.scope, snapshot.moduleId)
    yield { type: 'text', author: 'teacher', delta: text }
    await speakRedirect(studentId, placement, store, text)
  }
  // A downgrade whose move is not a redirect (the hint ladder lowering a rung,
  // or an unknown misconception becoming a plain answer) is still spoken by
  // the Teacher, as the ruled move.
  else if ((teacherVerdict?.decision === 'allow' || teacherVerdict?.decision === 'downgrade') && teacherVerdict.move) {
    const text = yield* streamTeacherReply(agents, context, teacherVerdict.move)
    if (!text) {
      await rememberTeacherCouldNotAnswer(studentId, placement, store)
      teacherFailed = true
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

  const deskmateSettled = await deskmateTask
  const deskmateMove = deskmateSettled.status === 'fulfilled' ? deskmateSettled.value : null
  const deskmateProposals = deskmateMove ? [{ agent: 'deskmate' as const, move: deskmateMove }] : []
  const deskmateVerdicts = decide(deskmateProposals, snapshot, roleTable, placement.course.scope)
  await recordDecisions(studentId, ruledPairs(deskmateProposals, deskmateVerdicts), snapshot, placement.course.masteryThreshold, options?.decisions, turnId, recordedAt)
  const trace = verifyShieldTrace(teacherMove, deskmateMove, [...teacherVerdicts, ...deskmateVerdicts], snapshot)
  const deskmateVerdict = deskmateVerdicts.find(verdict => verdict.agent === 'deskmate')

  if (teacherFailed) {
    yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, quizStore, null, trace) }
  }

  if (deskmateSettled.status === 'rejected') {
    logModelFailure('deskmate propose', deskmateSettled.reason)
    await rememberDeskmateCouldNotAnswer(studentId, placement, store)
  }
  else if (deskmateVerdict?.decision === 'allow' && deskmateVerdict.move) {
    const renderContext = await deskmateContextWithConversation(studentId, placement, deskmate, store)
    let text = ''
    let failed = false
    try {
      for await (const delta of agents.deskmate.render(renderContext, deskmateVerdict.move)) {
        text += delta
        yield { type: 'text', author: 'deskmate' as const, delta }
      }
    }
    catch (cause) {
      logModelFailure('deskmate render', cause)
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

  yield { type: 'state', state: await redrawWithTrace(studentId, placement, standing, store, quizStore, null, trace) }
}

async function redrawWithTrace(
  studentId: string,
  placement: Placement,
  standing: CourseStanding,
  store: ConversationStore,
  quizStore: QuizAnswerStore,
  mode: 'learn' | null,
  trace: TurnTrace,
): Promise<RedrawState> {
  return {
    ...await redraw(studentId, placement, standing, store, quizStore, mode),
    trace,
  }
}

function settleCall<T>(work: Promise<T>): Promise<PromiseSettledResult<T>> {
  return work.then(
    value => ({ status: 'fulfilled', value }),
    (reason: unknown) => ({ status: 'rejected', reason }),
  )
}

function ruledPairs(
  proposals: readonly Proposal[],
  verdicts: readonly Verdict[],
): { proposal: Proposal, verdict: Verdict }[] {
  return verdicts.flatMap((verdict) => {
    const proposed = proposals.find(item => item.agent === verdict.agent)
    return proposed ? [{ proposal: proposed, verdict }] : []
  })
}

async function recordDecisions(
  studentId: string,
  ruled: readonly { proposal: Proposal, verdict: Verdict }[],
  snapshot: TurnSnapshot,
  masteryThreshold: number,
  decisions: DecisionLogStore | undefined,
  turnId = crypto.randomUUID(),
  time = new Date().toISOString(),
): Promise<void> {
  if (!decisions || ruled.length === 0) return
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
      masteries: snapshot.masteries.map(item => ({ ...item })),
      unlockedModuleIds: [...snapshot.unlockedModuleIds],
      verifyShieldOn: snapshot.verifyShieldOn,
      masteryThreshold,
      ruleChecks: verdict.ruleChecks.map(check => ({ ...check })),
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
    verifyShieldOn: snapshot.verifyShieldOn,
    masteries: snapshot.masteries.map(item => ({ ...item })),
    unlockedModuleIds: [...snapshot.unlockedModuleIds],
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
  quizStore: QuizAnswerStore,
  seen: SeenWork,
): Promise<TeacherContext> {
  const [messages, quizAnswers] = await Promise.all([
    store.messages(studentId, placement.module.id),
    quizStore.forStudentModule(studentId, placement.module.id),
  ])
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
    roadmap: roadmapForStanding(placement.course, standing),
    answeredQuiz: answeredQuiz(placement.module, quizAnswers),
  }
}

// The answered quiz questions, in the module's quiz order. An unanswered
// question yields nothing, so its correct choice never leaves the server.
function answeredQuiz(
  module: StudyModule,
  quizAnswers: readonly QuizAnswerRow[],
): AnsweredQuizResult[] {
  return module.quiz.flatMap((question) => {
    const row = quizAnswers.find(answer => answer.questionId === question.id)
    if (!row) return []
    return [{
      prompt: question.prompt,
      choice: row.choice,
      correctIndex: question.correctIndex,
      correct: row.correct,
      explanation: question.explanation,
      misconceptionId: question.misconceptions?.[row.choice as 0 | 1 | 2 | 3] ?? null,
    }]
  })
}

function deskmateContext(context: TeacherContext): DeskmateContext {
  return {
    exerciseStatement: context.exercise.statement,
    draft: context.draft,
    runOutput: context.runOutput,
    submission: copySubmission(context.submission),
    conversation: context.conversation.map(message => ({ ...message })),
    // The Deskmate never sees a question's explanation. Destructuring it out
    // (rather than copying the rest by hand) keeps this in step with
    // DeskmateQuizResult if the result ever grows a field.
    answeredQuiz: context.answeredQuiz.map(({ explanation: _explanation, ...rest }) => rest),
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
  course: Course,
  studentId: string,
  store: ConversationStore,
  estimate: CourseEstimate,
  knownPoint: ResumePoint | null,
): Promise<{ placement: Placement, point: ResumePoint | null }> {
  // With no resume point the student starts on the furthest module their
  // evidence has unlocked, which is Module 1 when they have no evidence.
  const opening = studyModule(course, furthestUnlockedModuleId(course, estimate))
  if (!opening) throw new Error('The first module of the course is missing.')
  let point = knownPoint
  const moduleId = point ? canonicalModuleId(point.moduleId) : opening.id
  const module = studyModule(course, moduleId)
  if (module && estimate.unlockedModuleIds.includes(module.id)) {
    const exercise = module.exercises.find(item => item.id === point?.exerciseId) ?? module.exercises[0]
    if (!point || point.moduleId !== module.id || point.exerciseId !== exercise.id) {
      point = { moduleId: module.id, exerciseId: exercise.id }
      await store.saveResumePoint(studentId, point)
    }
    return { placement: { course, module, exercise }, point }
  }

  const exercise = opening.exercises[0]
  if (!point) {
    point = { moduleId: opening.id, exerciseId: exercise.id }
    await store.saveResumePoint(studentId, point)
  }
  return { placement: { course, module: opening, exercise }, point }
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
  quizStore: QuizAnswerStore,
  mode: 'learn' | null = null,
): Promise<RedrawState> {
  const [messages, displayName, quizAnswers] = await Promise.all([
    store.messages(studentId, placement.module.id),
    store.displayName(studentId),
    quizStore.forStudentModule(studentId, placement.module.id),
  ])
  return composeState(placement, standing, messages, displayName, mode, quizAnswers)
}

function composeState(
  placement: Placement,
  standing: CourseStanding,
  messages: readonly StoredMessage[],
  displayName: string,
  mode: 'learn' | null,
  quizAnswers: readonly QuizAnswerRow[],
): RedrawState {
  return {
    displayName,
    course: placement.course.title,
    courseRoadmap: presentedRoadmap(placement.course, standing),
    masteryThreshold: placement.course.masteryThreshold,
    workingArea: {
      mode,
      moduleId: placement.module.id,
      moduleName: nameOfModule(placement.course, placement.module.id),
      materials: { ...placement.module.materials },
      exercise: presentExercise(placement.exercise),
      exercises: placement.module.exercises.map(choice => ({
        id: choice.id,
        title: choice.title,
      })),
      quiz: presentQuiz(placement.module, quizAnswers),
    },
    conversation: messages.map(message => presentMessage(message, displayName)),
  }
}

function presentQuiz(
  module: StudyModule,
  quizAnswers: readonly QuizAnswerRow[],
): QuizQuestionView[] {
  return module.quiz.map((question) => {
    const answered = quizAnswers.find(row => row.questionId === question.id)
    return {
      id: question.id,
      prompt: question.prompt,
      choices: question.choices,
      // The correct choice and the explanation are attached only once the
      // student has answered, so an unanswered question never reveals them.
      result: answered
        ? {
            choice: answered.choice,
            correctIndex: question.correctIndex,
            correct: answered.correct,
            explanation: question.explanation,
          }
        : null,
    }
  })
}

function presentMessage(message: StoredMessage, displayName: string): ConversationMessage {
  const speaker = message.author === 'event' && isSubmissionSummary(message.text)
    ? { name: 'Practice check', role: 'Result' }
    : message.author === 'event' && isQuizSummary(message.text)
      ? { name: 'Quiz', role: 'Result' }
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
  if (approvedMove?.startsWith('advance_to_module:')) return 'Next module'
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

function isQuizSummary(text: string): boolean {
  return /^Quiz \d+: chose [A-D], (right|wrong)$/.test(text)
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

interface QuizAnswerEvent {
  event: 'quiz_answer'
  moduleId: string
  questionId: string
  choice: number
}

function isQuizAnswer(input: unknown): input is QuizAnswerEvent {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'quiz_answer'
    && 'moduleId' in input
    && typeof input.moduleId === 'string'
    && input.moduleId.length > 0
    && 'questionId' in input
    && typeof input.questionId === 'string'
    && input.questionId.length > 0
    && 'choice' in input
    && typeof input.choice === 'number'
}

function isChoiceIndex(choice: number): boolean {
  return Number.isInteger(choice) && choice >= 0 && choice <= 3
}

function isOpenEvent(input: unknown): input is { event: 'open' } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === 'open'
}

function isSelectModule(input: unknown): input is { event: 'select_module', moduleId: string } {
  return isModuleEvent(input, 'select_module')
}

function isPreviewModule(input: unknown): input is { event: 'preview_module', moduleId: string } {
  return isModuleEvent(input, 'preview_module')
}

function isModuleEvent(
  input: unknown,
  event: 'select_module' | 'preview_module',
): input is { event: 'select_module' | 'preview_module', moduleId: string } {
  return typeof input === 'object'
    && input !== null
    && 'event' in input
    && input.event === event
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

function nameOfModule(course: Course, id: string): string {
  const named = course.modules.find(item => item.id === id)
  if (!named) throw new Error(`Study module ${id} is missing from the course module list.`)
  return named.name
}
