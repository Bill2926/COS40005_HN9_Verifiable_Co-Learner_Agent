import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDailyTurnAllowance } from '../server/storage/daily-turn-allowance'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { createMemoryQuizAnswerStore } from '../server/storage/quiz-answer-store'
import { createFakeSandbox } from '../server/sandbox'
import { handleTurn, type TurnOptions, type TurnRequest } from '../server/turn/handle-turn'

const an = '6f1b0c1e-1111-4111-8111-111111111111'
const binh = '6f1b0c1e-2222-4222-8222-222222222222'

// 10:00 in Hanoi on 19 November 2026.
const hanoiMorning = new Date('2026-11-19T03:00:00.000Z')
// 23:59:59 in Hanoi on 19 November, then 00:00:00 on 20 November.
const hanoiDayEnd = new Date('2026-11-19T16:59:59.000Z')
const hanoiNextDay = new Date('2026-11-19T17:00:00.000Z')
const dailyTurnNotice = 'You have used your 60 turns for today. The agents will answer again tomorrow.'

function agents() {
  return createFakeAgents(
    { proposal: { type: 'explain_concept', scope: 'getting_started' }, text: 'Teacher says hi.' },
    { proposal: { type: 'peer_question' }, text: 'Mai wonders.' },
  )
}

function harness(names: Readonly<Record<string, string>> = { [an]: 'An' }) {
  let now = hanoiMorning
  const store = createMemoryConversationStore(names)
  const decisions = createMemoryDecisionLogStore()
  const allowance = createMemoryDailyTurnAllowance()
  const options: TurnOptions = {
    decisions,
    dailyTurns: allowance,
    quizAnswers: createMemoryQuizAnswerStore(),
    now: () => now,
  }
  return {
    store,
    decisions,
    allowance,
    options,
    at(time: Date) {
      now = time
    },
  }
}

function message(studentId: string, text: string, addressedAgent?: 'teacher' | 'deskmate'): TurnRequest {
  return {
    sessionStudentId: studentId,
    body: { event: 'message', text, ...(addressedAgent ? { addressedAgent } : {}) },
  }
}

async function sendMessages(
  count: number,
  studentId: string,
  store: ReturnType<typeof harness>['store'],
  options: TurnOptions,
  addressedAgent?: 'teacher' | 'deskmate',
): Promise<void> {
  for (let number = 1; number <= count; number++) {
    await handleTurn(message(studentId, `Turn ${number}`, addressedAgent), store, agents(), options)
  }
}

describe('daily proposing turns', () => {
  it('refuses the 61st proposing turn of a Hanoi day before any agent is called, and records no decision', async () => {
    const { store, decisions, options } = harness()

    for (let number = 1; number <= 59; number++) {
      await handleTurn(
        { sessionStudentId: an, body: { event: 'message', text: `Turn ${number}` } },
        store,
        agents(),
        options,
      )
    }

    const sixtieth = agents()
    const allowed = await handleTurn(
      { sessionStudentId: an, body: { event: 'message', text: 'Turn 60' } },
      store,
      sixtieth,
      options,
    )
    expect(sixtieth.exchanges.map(exchange => `${exchange.agent} ${exchange.phase}`).sort()).toEqual([
      'deskmate propose',
      'deskmate render',
      'teacher propose',
      'teacher render',
    ])
    expect(allowed.notice).toBeUndefined()
    expect(allowed.conversation.at(-1)).toMatchObject({ author: 'deskmate', text: 'Mai wonders.' })

    const before = (await decisions.list()).map(record => record.turnId)
    const refusedAgents = agents()
    const refused = await handleTurn(
      { sessionStudentId: an, body: { event: 'message', text: 'One more' } },
      store,
      refusedAgents,
      options,
    )

    expect(refusedAgents.exchanges).toEqual([])
    expect(refused.notice).toBe(dailyTurnNotice)
    expect(refused.conversation.at(-1)).toMatchObject({ author: 'student', text: 'One more' })
    expect(refused.conversation.filter(message => message.author === 'teacher')).toHaveLength(60)
    expect(refused.conversation.filter(message => message.author === 'deskmate')).toHaveLength(60)
    expect((await decisions.list()).map(record => record.turnId)).toEqual(before)

    const again = agents()
    const repeated = await handleTurn(message(an, 'And another'), store, again, options)
    expect(again.exchanges).toEqual([])
    expect(repeated.notice).toBe(dailyTurnNotice)
  })

  it('counts a turn addressed only to Mai as one turn', async () => {
    const { store, options } = harness()
    await sendMessages(59, an, store, options, 'deskmate')

    const sixtieth = agents()
    const allowed = await handleTurn(message(an, 'Mai?', 'deskmate'), store, sixtieth, options)
    expect(sixtieth.exchanges.map(exchange => exchange.agent)).toEqual(['deskmate', 'deskmate'])
    expect(allowed.notice).toBeUndefined()

    const refusedAgents = agents()
    const refused = await handleTurn(message(an, 'Mai again?', 'deskmate'), store, refusedAgents, options)
    expect(refusedAgents.exchanges).toEqual([])
    expect(refused.notice).toBe(dailyTurnNotice)
  })

  it('counts a first visit, a wrong quiz answer and a submission, and ignores turns that ask no agent', async () => {
    const { store, decisions, options } = harness()
    const opening = agents()
    const opened = await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, store, opening, options)
    expect(opening.exchanges.some(exchange => exchange.agent === 'teacher' && exchange.phase === 'propose')).toBe(true)
    expect(opened.notice).toBeUndefined()

    const wrong = agents()
    await handleTurn({
      sessionStudentId: an,
      body: { event: 'quiz_answer', moduleId: 'getting_started', questionId: 'print-text', choice: 0 },
    }, store, wrong, options)
    expect(wrong.exchanges.some(exchange => exchange.phase === 'propose')).toBe(true)

    const submitting = agents()
    const submitted = await handleTurn({
      sessionStudentId: an,
      body: {
        event: 'submission',
        code: 'print("hi")',
        results: [{ name: 'greeting', passed: false, expected: 'Hello', actual: '' }],
      },
    }, store, submitting, {
      ...options,
      sandbox: createFakeSandbox({
        outcome: 'checked',
        results: [{ name: 'greeting', passed: false, expected: 'Hello', actual: '' }],
      }),
    })
    expect(submitting.exchanges.some(exchange => exchange.phase === 'propose')).toBe(true)
    expect(submitted.conversation.some(entry => entry.text === '0/1 tests passed')).toBe(true)

    // These ask no agent: a later visit, a right answer, a repeat of an answered question,
    // choosing an exercise, and switching Mai off.
    const quiet = agents()
    await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, store, quiet, options)
    await handleTurn({
      sessionStudentId: an,
      body: { event: 'quiz_answer', moduleId: 'getting_started', questionId: 'comment-line', choice: 3 },
    }, store, quiet, options)
    await handleTurn({
      sessionStudentId: an,
      body: { event: 'quiz_answer', moduleId: 'getting_started', questionId: 'print-text', choice: 1 },
    }, store, quiet, options)
    await handleTurn({ sessionStudentId: an, body: { event: 'select_exercise', exerciseId: 'join_words' } }, store, quiet, options)
    await handleTurn({ sessionStudentId: an, body: { event: 'deskmate_switch', on: false } }, store, quiet, options)
    expect(quiet.exchanges).toEqual([])

    // The three proposing turns above plus 56 messages make 59.
    await sendMessages(56, an, store, options)
    const sixtieth = agents()
    const allowed = await handleTurn(message(an, 'Turn 60'), store, sixtieth, options)
    expect(sixtieth.exchanges.some(exchange => exchange.phase === 'propose')).toBe(true)
    expect(allowed.notice).toBeUndefined()

    const before = (await decisions.list()).map(record => record.turnId)
    const refusedAgents = agents()
    const refused = await handleTurn(message(an, 'One more'), store, refusedAgents, options)
    expect(refusedAgents.exchanges).toEqual([])
    expect(refused.notice).toBe(dailyTurnNotice)
    expect((await decisions.list()).map(record => record.turnId)).toEqual(before)
  })

  it('keeps a submission and a quiz answer that arrive after the limit, and still refuses the agents', async () => {
    const { store, decisions, options } = harness()
    await sendMessages(60, an, store, options)
    const beforeMastery = (await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, store, agents(), options))
      .courseRoadmap.find(module => module.id === 'getting_started')?.mastery
    const before = (await decisions.list()).map(record => record.turnId)

    const submitting = agents()
    const submitted = await handleTurn({
      sessionStudentId: an,
      body: {
        event: 'submission',
        code: 'return "Hello, An"',
        results: [{ name: 'greeting', passed: true, expected: 'Hello, An', actual: 'Hello, An' }],
      },
    }, store, submitting, {
      ...options,
      sandbox: createFakeSandbox({
        outcome: 'checked',
        results: [{ name: 'greeting', passed: true, expected: 'Hello, An', actual: 'Hello, An' }],
      }),
    })
    expect(submitting.exchanges).toEqual([])
    expect(submitted.notice).toBe(dailyTurnNotice)
    expect(submitted.conversation.some(entry => entry.text === '1/1 tests passed')).toBe(true)
    expect(submitted.courseRoadmap.find(module => module.id === 'getting_started')?.mastery).toBeGreaterThan(beforeMastery ?? 1)
    expect((await decisions.list()).map(record => record.turnId)).toEqual(before)

    const answering = agents()
    const answered = await handleTurn({
      sessionStudentId: an,
      body: { event: 'quiz_answer', moduleId: 'getting_started', questionId: 'program-steps', choice: 1 },
    }, store, answering, options)
    expect(answering.exchanges).toEqual([])
    expect(answered.notice).toBe(dailyTurnNotice)
    expect(answered.workingArea.quiz.find(question => question.id === 'program-steps')?.result).toMatchObject({
      choice: 1,
      correct: false,
    })
    expect((await decisions.list()).map(record => record.turnId)).toEqual(before)

    const visiting = agents()
    const opened = await handleTurn({ sessionStudentId: an, body: { event: 'select_exercise', exerciseId: 'sign_the_program' } }, store, visiting, options)
    expect(visiting.exchanges).toEqual([])
    expect(opened.notice).toBeUndefined()
    expect(opened.workingArea.exercise.id).toBe('sign_the_program')
  })

  it('refuses a first visit once the day is full, before the teacher is asked', async () => {
    const { store, decisions, allowance, options } = harness()
    for (let taken = 0; taken < 60; taken++) {
      expect(await allowance.take(an, '2026-11-19')).toBe(true)
    }
    expect(await allowance.take(an, '2026-11-19')).toBe(false)

    const visiting = agents()
    const opened = await handleTurn({ sessionStudentId: an, body: { event: 'open' } }, store, visiting, options)
    expect(visiting.exchanges).toEqual([])
    expect(opened.notice).toBe(dailyTurnNotice)
    expect(opened.conversation).toEqual([])
    expect(opened.workingArea.mode).toBe('learn')
    expect(await decisions.list()).toEqual([])
  })

  it('allows turns again on the next Hanoi calendar day, including across midnight', async () => {
    const { store, options, at } = harness()
    at(new Date('2026-11-18T17:00:00.000Z'))
    await sendMessages(60, an, store, options)

    at(hanoiDayEnd)
    const late = agents()
    const refused = await handleTurn(message(an, 'Still today'), store, late, options)
    expect(late.exchanges).toEqual([])
    expect(refused.notice).toBe(dailyTurnNotice)

    at(hanoiNextDay)
    const morning = agents()
    const allowed = await handleTurn(message(an, 'A new day'), store, morning, options)
    expect(morning.exchanges.some(exchange => exchange.phase === 'propose')).toBe(true)
    expect(allowed.notice).toBeUndefined()
    expect(allowed.conversation.at(-1)).toMatchObject({ author: 'deskmate', text: 'Mai wonders.' })
  })

  it('leaves another student able to take a turn when this student is at the limit', async () => {
    const { store, options } = harness({ [an]: 'An', [binh]: 'Bình' })
    await sendMessages(60, an, store, options)

    const anAgents = agents()
    const refused = await handleTurn(message(an, 'One more'), store, anAgents, options)
    expect(anAgents.exchanges).toEqual([])
    expect(refused.notice).toBe(dailyTurnNotice)

    const binhAgents = agents()
    const allowed = await handleTurn(message(binh, 'Hello'), store, binhAgents, options)
    expect(binhAgents.exchanges.some(exchange => exchange.phase === 'propose')).toBe(true)
    expect(allowed.notice).toBeUndefined()
    expect(allowed.displayName).toBe('Bình')
    expect(allowed.conversation.at(-1)).toMatchObject({ author: 'deskmate' })

    const anAgain = agents()
    const stillRefused = await handleTurn(message(an, 'Still me'), store, anAgain, options)
    expect(anAgain.exchanges).toEqual([])
    expect(stillRefused.notice).toBe(dailyTurnNotice)
  })
})
