import { describe, expect, it } from 'vitest'
import { createConfiguredLanguageModel } from '../server/model/configured-language-model'
import { createFakeLanguageModel } from '../server/model/fake-language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { handleTurn, streamTurn, studentIdForTurn } from '../server/turn/handle-turn'

const signedInStudent = '6f1b0c1e-1111-4111-8111-111111111111'
const otherStudent = '6f1b0c1e-2222-4222-8222-222222222222'
const teacherReply = 'The total has to exist before the loop starts.'

function memoryStore() {
  return createMemoryConversationStore({
    [signedInStudent]: 'An',
    [otherStudent]: 'Bình',
  })
}

function speakingTeacher() {
  return createFakeLanguageModel({
    proposal: { type: 'explain_concept' },
    text: teacherReply,
  })
}

describe('turn endpoint', () => {
  it('rejects a request when there is no session', () => {
    expect(() => handleTurn({
      sessionStudentId: null,
      body: { event: 'open' },
    })).toThrow(expect.objectContaining({
      name: 'SignInRequiredError',
      statusCode: 401,
    }))
  })

  it('ignores a student id in the request body', async () => {
    expect(studentIdForTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open', studentId: otherStudent },
    })).toBe(signedInStudent)

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open', studentId: otherStudent },
    }, memoryStore())

    expect(JSON.stringify(state)).not.toContain(otherStudent)
  })

  it('open returns the topic states, the closed reason, Learn mode, and the current exercise', async () => {
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }))

    expect(state.knowledgeMap).toEqual([
      { id: 'variable', name: 'Variables', state: 'mastered', current: false },
      { id: 'if_else', name: 'If / else', state: 'mastered', current: false },
      { id: 'for_loop', name: 'For loops', state: 'open', current: true },
      {
        id: 'nested_loop',
        name: 'Nested loops',
        state: 'closed',
        current: false,
        closedReason: 'Needs For loops.',
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
      exercise: {
        id: 'sum_of_a_list',
        title: 'Sum of a list',
        statement:
          'Add up every number in a list. Use a for loop, and create the total before the loop so it survives every pass.',
        starterCode: 'def total(ds):\n    pass\n',
        tests: [
          { name: 'three numbers', expression: 'total([1, 2, 3])', expected: '6' },
          { name: 'one number', expression: 'total([10])', expected: '10' },
          { name: 'empty list', expression: 'total([])', expected: '0' },
        ],
      },
      exercises: [
        { id: 'sum_of_a_list', title: 'Sum of a list' },
        { id: 'count_the_even_numbers', title: 'Count the even numbers' },
      ],
    })
    expect(state.conversation).toEqual([])
    expect(state.displayName).toBe('An')
  })

  it('select_exercise redraws the chosen exercise and does not keep a draft', async () => {
    const store = memoryStore()
    const opened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'select_exercise',
        exerciseId: 'count_the_even_numbers',
        draft: 'def count_even(ds):\n    return 999\n',
      },
    }, store)

    expect(state.displayName).toBe('An')
    expect(state.knowledgeMap).toEqual(opened.knowledgeMap)
    expect(state.workingArea.mode).toBeNull()
    expect(state.workingArea.topicId).toBe('for_loop')
    expect(state.workingArea.exercises).toEqual([
      { id: 'sum_of_a_list', title: 'Sum of a list' },
      { id: 'count_the_even_numbers', title: 'Count the even numbers' },
    ])
    expect(state.workingArea.exercise).toEqual({
      id: 'count_the_even_numbers',
      title: 'Count the even numbers',
      statement: 'Count how many numbers in a list are even. Use a for loop.',
      starterCode: 'def count_even(ds):\n    pass\n',
      tests: [
        { name: 'two evens', expression: 'count_even([1, 2, 3, 4])', expected: '2' },
        { name: 'all even', expression: 'count_even([2, 4, 6])', expected: '3' },
        { name: 'none even', expression: 'count_even([1, 3, 5])', expected: '0' },
      ],
    })
    expect(state.conversation.map(message => ({
      author: message.author,
      text: message.text,
      exerciseId: message.exerciseId,
    }))).toEqual([
      {
        author: 'event',
        text: 'Count the even numbers',
        exerciseId: 'count_the_even_numbers',
      },
    ])
    expect(JSON.stringify(state)).not.toContain('return 999')
  })

  it('open returns the conversation in the order it was written', async () => {
    const store = memoryStore()
    const model = speakingTeacher()

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, model)
    const sent = await handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'message',
        text: 'Inside the loop, I think.',
        draft: 'def total(ds):\n    return 999\n',
      },
    }, store, model)

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)

    expect(state.conversation.map(message => ({
      author: message.author,
      text: message.text,
      exerciseId: message.exerciseId,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        text: 'Where does the total live?',
        exerciseId: 'sum_of_a_list',
        approvedMove: null,
      },
      {
        author: 'teacher',
        text: teacherReply,
        exerciseId: 'sum_of_a_list',
        approvedMove: 'explain_concept',
      },
      {
        author: 'student',
        text: 'Inside the loop, I think.',
        exerciseId: 'sum_of_a_list',
        approvedMove: null,
      },
      {
        author: 'teacher',
        text: teacherReply,
        exerciseId: 'sum_of_a_list',
        approvedMove: 'explain_concept',
      },
    ])
    expect(state.conversation.some(message => message.author === 'deskmate')).toBe(false)
    expect(JSON.stringify(state)).not.toContain('return 999')
    expect(state.workingArea.exercise.id).toBe('sum_of_a_list')
    expect(sent.conversation.map(message => message.text)).toEqual([
      'Where does the total live?',
      teacherReply,
      'Inside the loop, I think.',
      teacherReply,
    ])
    expect(sent.knowledgeMap).toEqual(state.knowledgeMap)
    expect(sent.workingArea).toEqual(state.workingArea)
  })

  it('keeps each student\'s conversation separate', async () => {
    const store = memoryStore()

    const an = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'An speaking' },
    }, store, speakingTeacher())

    expect(an.displayName).toBe('An')
    expect(an.conversation.find(message => message.author === 'student')).toMatchObject({
      name: 'An',
    })

    const other = await handleTurn({
      sessionStudentId: otherStudent,
      body: { event: 'open' },
    }, store)

    expect(other.displayName).toBe('Bình')
    expect(other.conversation).toEqual([])
    expect(other.workingArea.topicId).toBe('for_loop')
    expect(other.workingArea.exercise.id).toBe('sum_of_a_list')
  })

  it('select_exercise moves the resume point and leaves an exercise marker', async () => {
    const store = memoryStore()

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, speakingTeacher())

    const selected = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'select_exercise', exerciseId: 'count_the_even_numbers' },
    }, store)

    expect(selected.workingArea.exercise.id).toBe('count_the_even_numbers')
    expect(selected.conversation.map(message => ({
      author: message.author,
      text: message.text,
      exerciseId: message.exerciseId,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        text: 'Where does the total live?',
        exerciseId: 'sum_of_a_list',
        approvedMove: null,
      },
      {
        author: 'teacher',
        text: teacherReply,
        exerciseId: 'sum_of_a_list',
        approvedMove: 'explain_concept',
      },
      {
        author: 'event',
        text: 'Count the even numbers',
        exerciseId: 'count_the_even_numbers',
        approvedMove: null,
      },
    ])
    expect(selected.conversation.some(message => message.author === 'deskmate')).toBe(false)

    const reopened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)

    expect(reopened.displayName).toBe('An')
    expect(reopened.workingArea.topicId).toBe('for_loop')
    expect(reopened.workingArea.exercise.id).toBe('count_the_even_numbers')
    expect(reopened.conversation).toEqual(selected.conversation)
    expect(reopened.conversation.find(message => message.author === 'student')).toMatchObject({
      name: 'An',
    })

    const followed = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Are evens the ones that divide by two?' },
    }, store, speakingTeacher())

    expect(followed.conversation.at(-2)).toMatchObject({
      author: 'student',
      text: 'Are evens the ones that divide by two?',
      exerciseId: 'count_the_even_numbers',
      approvedMove: null,
    })
    expect(followed.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      text: teacherReply,
      exerciseId: 'count_the_even_numbers',
      approvedMove: 'explain_concept',
    })
  })

  it('answers a message with one streamed Teacher message carrying its move', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      text: 'The total has to exist before the loop starts.',
    })

    const events = []
    for await (const event of streamTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, model)) {
      events.push(event)
    }

    const spoken = events
      .filter(event => event.type === 'text')
      .map(event => event.delta)
      .join('')
    const finished = events.at(-1)

    expect(spoken).toBe('The total has to exist before the loop starts.')
    expect(events.findIndex(event => event.type === 'text')).toBeLessThan(events.length - 1)
    expect(finished?.type).toBe('state')
    if (finished?.type !== 'state') return

    expect(finished.state.displayName).toBe('An')
    expect(finished.state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'An',
        role: 'Student',
        text: 'Where does the total live?',
        approvedMove: null,
      },
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        text: 'The total has to exist before the loop starts.',
        approvedMove: 'explain_concept',
      },
    ])
    expect(finished.state.workingArea.topicId).toBe('for_loop')
    expect(finished.state.knowledgeMap.find(topic => topic.id === 'nested_loop')).toMatchObject({
      state: 'closed',
      closedReason: 'Needs For loops.',
    })
  })

  it('answers with the Teacher first and then Mai', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: 'The total has to exist before the loop starts.',
      },
      {
        proposal: { type: 'peer_question' },
        text: 'wait, does the total live outside the loop?',
      },
    )

    const events = []
    for await (const event of streamTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, model)) {
      events.push(event)
    }

    const textEvents = events.filter(event => event.type === 'text')
    const teacherSpoken = textEvents
      .filter(event => event.author === 'teacher')
      .map(event => event.delta)
      .join('')
    const maiSpoken = textEvents
      .filter(event => event.author === 'deskmate')
      .map(event => event.delta)
      .join('')
    const lastTeacher = textEvents.findLastIndex(event => event.author === 'teacher')
    const firstMai = textEvents.findIndex(event => event.author === 'deskmate')
    const finished = events.at(-1)

    expect(teacherSpoken).toBe('The total has to exist before the loop starts.')
    expect(maiSpoken).toBe('wait, does the total live outside the loop?')
    expect(firstMai).toBeGreaterThan(lastTeacher)
    expect(finished?.type).toBe('state')
    if (finished?.type !== 'state') return

    expect(finished.state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'An',
        role: 'Student',
        text: 'Where does the total live?',
        approvedMove: null,
      },
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        text: 'The total has to exist before the loop starts.',
        approvedMove: 'explain_concept',
      },
      {
        author: 'deskmate',
        name: 'Mai',
        role: 'Deskmate',
        text: 'wait, does the total live outside the loop?',
        approvedMove: 'peer_question',
      },
    ])
  })

  it('gives the Teacher the draft and latest Run output without storing either', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel({
      proposal: { type: 'answer_question' },
      text: 'Look at the variable that survives the loop.',
    })
    const draft = 'def total(ds):\n    DRAFT_SENTINEL_42 = 0\n'
    const run = { stdout: 'RUN_OUTPUT_SENTINEL_42\n', stderr: '', error: null }

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'message',
        text: 'Why is this zero?',
        draft,
        run,
      },
    }, store, model)

    const teacherExchanges = model.exchanges.filter(exchange => exchange.agent === 'teacher')
    expect(teacherExchanges.map(exchange => exchange.phase)).toEqual(['propose', 'render'])
    for (const exchange of teacherExchanges) {
      expect(exchange.context.draft).toBe(draft)
      expect(exchange.context.runOutput).toEqual(run)
      expect(exchange.context.materials).toEqual({
        heading: 'Accumulating a total',
        body: 'A running total needs a variable that survives every pass of the loop.',
        example: 's = 0\nfor x in ds:\n    s = s + x',
        scopeNote: 'These materials belong to this topic alone.',
      })
      expect(exchange.context.hintLadder).toEqual([
        'A running total has to be created before the loop. A variable created inside the loop starts again on every pass.',
        'Add each number to that same total. Do not set the total back to zero inside the loop.',
        'When the loop finishes, return the total. It should hold every number you added.',
      ])
      expect(exchange.context.misconceptionResponses).toEqual([
        {
          id: 'accumulator_reset_inside_loop',
          response: 'The total is set back to zero inside the loop, so each pass forgets the numbers before it. Create the total once, before the loop starts.',
        },
      ])
      expect(exchange.context.exercise).toEqual({
        id: 'sum_of_a_list',
        title: 'Sum of a list',
        statement: 'Add up every number in a list. Use a for loop, and create the total before the loop so it survives every pass.',
        starterCode: 'def total(ds):\n    pass\n',
      })
      expect(exchange.context.conversation.map(message => message.text)).toContain('Why is this zero?')
    }

    expect(state.conversation.filter(message => message.author === 'teacher')).toEqual([
      expect.objectContaining({
        text: 'Look at the variable that survives the loop.',
        approvedMove: 'answer_question',
      }),
    ])
    expect(JSON.stringify(state)).not.toContain('DRAFT_SENTINEL_42')
    expect(JSON.stringify(state)).not.toContain('RUN_OUTPUT_SENTINEL_42')

    const reopened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)
    expect(JSON.stringify(reopened)).not.toContain('DRAFT_SENTINEL_42')
    expect(JSON.stringify(reopened)).not.toContain('RUN_OUTPUT_SENTINEL_42')
  })

  it('blocks a Deskmate hint and does not render it', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: teacherReply,
      },
      {
        proposal: { type: 'hint_level_N', level: 2 },
        text: 'HINT_SHOULD_NOT_RENDER',
      },
    )

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Just tell me the next step.' },
    }, store, model)

    expect(model.exchanges.filter(exchange => exchange.agent === 'deskmate').map(exchange => exchange.phase)).toEqual(['propose'])
    expect(state.conversation.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        text: 'Just tell me the next step.',
        approvedMove: null,
      },
      {
        author: 'teacher',
        text: teacherReply,
        approvedMove: 'explain_concept',
      },
    ])
    expect(JSON.stringify(state)).not.toContain('HINT_SHOULD_NOT_RENDER')
  })

  it('reports both proposals and a blocked Deskmate move, and does not keep them', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: teacherReply,
      },
      {
        proposal: { type: 'hint_level_N', level: 2 },
        text: 'HINT_SHOULD_NOT_RENDER',
      },
    )

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Just tell me the next step.' },
    }, store, model)

    expect(state.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: 'explain_concept',
          verdict: {
            decision: 'allow',
            ruleId: 'role_table',
            reasonCode: 'ROLE_PERMITTED',
          },
        },
        {
          agent: 'deskmate',
          proposal: 'hint_level_2',
          verdict: {
            decision: 'block',
            ruleId: 'role_table',
            reasonCode: 'ROLE_FORBIDDEN',
          },
        },
      ],
    })

    const reopened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)
    expect(reopened.trace).toBeUndefined()
    expect(JSON.stringify(reopened)).not.toContain('hint_level_2')
    expect(JSON.stringify(reopened)).not.toContain('ROLE_FORBIDDEN')
    expect(JSON.stringify(reopened)).not.toContain('role_table')
  })

  it('reports an agent that made no proposal', async () => {
    const store = memoryStore()
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: teacherReply,
      },
      {
        proposal: null,
        text: 'QUIET_MAI_TEXT',
      },
    ))

    expect(state.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: 'explain_concept',
          verdict: {
            decision: 'allow',
            ruleId: 'role_table',
            reasonCode: 'ROLE_PERMITTED',
          },
        },
        {
          agent: 'deskmate',
          proposal: null,
          verdict: null,
        },
      ],
    })
    expect(JSON.stringify(state.conversation)).not.toContain('QUIET_MAI_TEXT')
  })

  it('reports the opening turn as the Teacher proposal and no Deskmate proposal', async () => {
    const store = memoryStore()
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, speakingTeacher())

    expect(state.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: 'explain_concept',
          verdict: {
            decision: 'allow',
            ruleId: 'role_table',
            reasonCode: 'ROLE_PERMITTED',
          },
        },
        {
          agent: 'deskmate',
          proposal: null,
          verdict: null,
        },
      ],
    })
  })

  it('gives Mai no materials, hint ladder, or solution', async () => {
    const store = memoryStore()
    const draft = 'def total(ds):\n    MAI_DRAFT_SENTINEL = 0\n'
    const run = { stdout: 'MAI_RUN_SENTINEL\n', stderr: '', error: null }
    const model = createFakeLanguageModel(
      {
        proposal: { type: 'hint_level_N', level: 1 },
        text: teacherReply,
      },
      {
        proposal: { type: 'share_confusion' },
        text: 'i keep getting zero too.',
      },
    )

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'message',
        text: 'Why is this zero?',
        draft,
        run,
      },
    }, store, model)

    const given = model.exchanges.filter(exchange => exchange.agent === 'deskmate')
    expect(given.map(exchange => exchange.phase)).toEqual(['propose', 'render'])
    const [propose, render] = given
    const allowed = {
      misconceptionResponses: [
        {
          id: 'accumulator_reset_inside_loop',
          response: 'The total is set back to zero inside the loop, so each pass forgets the numbers before it. Create the total once, before the loop starts.',
        },
      ],
      exerciseStatement: 'Add up every number in a list. Use a for loop, and create the total before the loop so it survives every pass.',
      draft,
      runOutput: run,
      submission: null,
    }
    expect(propose?.context).toEqual({
      ...allowed,
      conversation: [
        {
          author: 'student',
          text: 'Why is this zero?',
          approvedMove: null,
        },
      ],
    })
    expect(render?.context).toEqual({
      ...allowed,
      conversation: [
        {
          author: 'student',
          text: 'Why is this zero?',
          approvedMove: null,
        },
        {
          author: 'teacher',
          text: teacherReply,
          approvedMove: 'hint_level_1',
        },
      ],
    })
    for (const exchange of given) {
      const rendered = JSON.stringify(exchange.context)
      expect(rendered).not.toContain('Accumulating a total')
      expect(rendered).not.toContain('A running total has to be created before the loop. A variable created inside the loop starts again on every pass.')
      expect(rendered).not.toContain('starterCode')
      expect(rendered).not.toContain('solution')
    }
  })

  it('produces no message for an agent that makes no proposal', async () => {
    const store = memoryStore()
    const quietMai = createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: teacherReply,
      },
      {
        proposal: null,
        text: 'QUIET_MAI_TEXT',
      },
    )

    const teacherOnly = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, quietMai)

    expect(quietMai.exchanges.filter(exchange => exchange.agent === 'deskmate').map(exchange => exchange.phase)).toEqual(['propose'])
    expect(teacherOnly.conversation.map(message => message.author)).toEqual(['student', 'teacher'])
    expect(JSON.stringify(teacherOnly)).not.toContain('QUIET_MAI_TEXT')

    const quietTeacher = createFakeLanguageModel(
      {
        proposal: null,
        text: 'QUIET_TEACHER_AGAIN',
      },
      {
        proposal: { type: 'share_confusion' },
        text: 'i keep getting zero too.',
      },
    )
    const maiOnly = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Mine is zero as well.' },
    }, store, quietTeacher)

    expect(quietTeacher.exchanges.filter(exchange => exchange.agent === 'teacher').map(exchange => exchange.phase)).toEqual(['propose'])
    expect(maiOnly.conversation.slice(-2).map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'An',
        role: 'Student',
        text: 'Mine is zero as well.',
        approvedMove: null,
      },
      {
        author: 'deskmate',
        name: 'Mai',
        role: 'Deskmate',
        text: 'i keep getting zero too.',
        approvedMove: 'share_confusion',
      },
    ])
    expect(JSON.stringify(maiOnly)).not.toContain('QUIET_TEACHER_AGAIN')
  })

  it('stays quiet when the Teacher proposes no move', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel({
      proposal: null,
      text: 'QUIET_TEACHER_TEXT',
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Hello' },
    }, store, model)

    expect(model.exchanges.filter(exchange => exchange.agent === 'teacher').map(exchange => exchange.phase)).toEqual(['propose'])
    expect(state.conversation.map(message => message.author)).toEqual(['student'])
    expect(JSON.stringify(state)).not.toContain('QUIET_TEACHER_TEXT')
  })

  it('does not render a Teacher move the role table forbids', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel({
      proposal: { type: 'peer_question' },
      text: 'FORBIDDEN_TEACHER_TEXT',
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Hello' },
    }, store, model)

    expect(model.exchanges.filter(exchange => exchange.agent === 'teacher').map(exchange => exchange.phase)).toEqual(['propose'])
    expect(state.conversation.map(message => message.author)).toEqual(['student'])
    expect(JSON.stringify(state)).not.toContain('FORBIDDEN_TEACHER_TEXT')
  })

  it('lets Mai speak when the Teacher cannot answer', async () => {
    const store = memoryStore()
    const events = []
    for await (const event of streamTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        fail: 'propose',
      },
      {
        proposal: { type: 'peer_question' },
        text: 'i\'m stuck on that too.',
      },
    ))) {
      events.push(event)
    }

    const teacherShown = events.findIndex(event =>
      event.type === 'state'
      && event.state.conversation.some(message => message.author === 'teacher'),
    )
    const firstMai = events.findIndex(event => event.type === 'text' && event.author === 'deskmate')
    expect(teacherShown).toBeGreaterThanOrEqual(0)
    expect(teacherShown).toBeLessThan(firstMai)

    const finished = events.at(-1)
    expect(finished?.type).toBe('state')
    if (finished?.type !== 'state') return
    const state = finished.state

    expect(state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'An',
        role: 'Student',
        text: 'Where does the total live?',
        approvedMove: null,
      },
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        text: 'The Teacher could not answer just now. Please try again.',
        approvedMove: null,
      },
      {
        author: 'deskmate',
        name: 'Mai',
        role: 'Deskmate',
        text: 'i\'m stuck on that too.',
        approvedMove: 'peer_question',
      },
    ])
    expect(state.knowledgeMap.length).toBeGreaterThan(0)
    expect(state.workingArea.topicId).toBe('for_loop')
  })

  it('stores a friendly Mai line, with no move, when she cannot answer', async () => {
    const store = memoryStore()
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: teacherReply,
      },
      {
        proposal: { type: 'peer_question' },
        text: 'PARTIAL_MAI_TEXT',
        fail: 'render',
      },
    ))

    expect(state.conversation.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        text: 'Where does the total live?',
        approvedMove: null,
      },
      {
        author: 'teacher',
        text: teacherReply,
        approvedMove: 'explain_concept',
      },
      {
        author: 'deskmate',
        text: 'Mai could not answer just now. Please try again.',
        approvedMove: null,
      },
    ])
    expect(JSON.stringify(state)).not.toContain('PARTIAL_MAI_TEXT')
  })

  it('returns a full redraw with a friendly fallback when the model fails', async () => {
    const store = memoryStore()
    const opened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      fail: 'propose',
    }))

    expect(state.knowledgeMap).toEqual(opened.knowledgeMap)
    expect(state.workingArea).toEqual({ ...opened.workingArea, mode: null })
    expect(state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'An',
        role: 'Student',
        text: 'Where does the total live?',
        approvedMove: null,
      },
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        text: 'The Teacher could not answer just now. Please try again.',
        approvedMove: null,
      },
    ])

    const rendered = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'And if it is inside?' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      text: 'PARTIAL_SHOULD_NOT_STICK',
      fail: 'render',
    }))
    expect(rendered.workingArea).toEqual({ ...opened.workingArea, mode: null })
    expect(rendered.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      text: 'The Teacher could not answer just now. Please try again.',
      approvedMove: null,
    })
    expect(JSON.stringify(rendered)).not.toContain('PARTIAL_SHOULD_NOT_STICK')
  })

  it('uses the scripted Teacher when fake-model mode is configured', async () => {
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, memoryStore(), createConfiguredLanguageModel({
      mode: 'fake',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: '',
    }))

    expect(state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      approvedMove: message.approvedMove,
      text: message.text,
    }))).toEqual([
      {
        author: 'student',
        name: 'An',
        role: 'Student',
        approvedMove: null,
        text: 'Where does the total live?',
      },
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        approvedMove: 'explain_concept',
        text: 'A running total has to be created before the loop, so each pass can add to the same number.',
      },
      {
        author: 'deskmate',
        name: 'Mai',
        role: 'Deskmate',
        approvedMove: 'peer_question',
        text: 'wait, does the total live outside the loop? i\'m lost too.',
      },
    ])
  })

  it('introduces a topic the first time it is opened and starts in Learn', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: 'A running total survives every pass of the loop.',
      },
      {
        proposal: { type: 'peer_question' },
        text: 'MAI_SHOULD_NOT_SPEAK_ON_OPEN',
      },
    )

    const events = []
    for await (const event of streamTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, model)) {
      events.push(event)
    }

    const spoken = events
      .filter(event => event.type === 'text')
      .map(event => event.author === 'teacher' ? event.delta : `UNEXPECTED_${event.author}`)
      .join('')
    const finished = events.at(-1)

    expect(spoken).toBe('A running total survives every pass of the loop.')
    expect(finished?.type).toBe('state')
    if (finished?.type !== 'state') return

    expect(finished.state.workingArea.mode).toBe('learn')
    expect(finished.state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
      openInLearn: message.openInLearn,
    }))).toEqual([
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        text: 'A running total survives every pass of the loop.',
        approvedMove: 'explain_concept',
        openInLearn: true,
      },
    ])
    expect(JSON.stringify(finished.state)).not.toContain('MAI_SHOULD_NOT_SPEAK_ON_OPEN')
    expect(model.exchanges.filter(exchange => exchange.agent === 'teacher').map(exchange => exchange.phase)).toEqual(['propose', 'render'])
    for (const exchange of model.exchanges) {
      expect(exchange.agent).toBe('teacher')
      if (exchange.agent !== 'teacher') continue
      expect(exchange.context.conversation).toEqual([])
      expect(exchange.context.materials.heading).toBe('Accumulating a total')
    }
  })

  it('introduces the topic with a teaching move when the model proposes another move', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel({
      proposal: { type: 'stay_and_practise' },
      text: 'A running total survives every pass of the loop.',
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, model)

    expect(state.workingArea.mode).toBe('learn')
    expect(state.conversation.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
      openInLearn: message.openInLearn,
    }))).toEqual([
      {
        author: 'teacher',
        text: 'A running total survives every pass of the loop.',
        approvedMove: 'explain_concept',
        openInLearn: true,
      },
    ])
    expect(model.exchanges.map(exchange => exchange.phase)).toEqual(['propose', 'render'])
    expect(model.exchanges.at(-1)?.move).toEqual({ type: 'explain_concept' })
    expect(state.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: 'stay_and_practise',
          verdict: {
            decision: 'allow',
            ruleId: 'role_table',
            reasonCode: 'ROLE_PERMITTED',
          },
        },
        {
          agent: 'deskmate',
          proposal: null,
          verdict: null,
        },
      ],
    })
  })

  it('reports that the Teacher made no proposal when opening stays quiet', async () => {
    const store = memoryStore()
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, createFakeLanguageModel({
      proposal: null,
      text: 'A running total survives every pass of the loop.',
    }))

    expect(state.conversation.map(message => message.approvedMove)).toEqual(['explain_concept'])
    expect(state.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: null,
          verdict: null,
        },
        {
          agent: 'deskmate',
          proposal: null,
          verdict: null,
        },
      ],
    })
  })

  it('reports that nobody proposed when the opening proposal fails', async () => {
    const store = memoryStore()
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      fail: 'propose',
    }))

    expect(state.conversation).toEqual([])
    expect(state.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: null,
          verdict: null,
        },
        {
          agent: 'deskmate',
          proposal: null,
          verdict: null,
        },
      ],
    })
  })

  it('leaves the topic unintroduced when the opening reply fails, so the next open can introduce it', async () => {
    const store = memoryStore()
    const failed = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      text: 'PARTIAL_OPENING_SHOULD_NOT_STICK',
      fail: 'render',
    }))

    expect(failed.workingArea.mode).toBe('learn')
    expect(failed.conversation).toEqual([])
    expect(JSON.stringify(failed)).not.toContain('could not answer')
    expect(JSON.stringify(failed)).not.toContain('PARTIAL_OPENING_SHOULD_NOT_STICK')
    expect(failed.trace).toEqual({
      active: false,
      agents: [
        {
          agent: 'teacher',
          proposal: 'explain_concept',
          verdict: {
            decision: 'allow',
            ruleId: 'role_table',
            reasonCode: 'ROLE_PERMITTED',
          },
        },
        {
          agent: 'deskmate',
          proposal: null,
          verdict: null,
        },
      ],
    })

    const introduced = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, speakingTeacher())

    expect(introduced.workingArea.mode).toBe('learn')
    expect(introduced.conversation.map(message => ({
      author: message.author,
      approvedMove: message.approvedMove,
      openInLearn: message.openInLearn,
    }))).toEqual([
      {
        author: 'teacher',
        approvedMove: 'explain_concept',
        openInLearn: true,
      },
    ])
  })

  it('does not take an agent turn when the topic already has a conversation', async () => {
    const store = memoryStore()
    const earlier = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, speakingTeacher())

    const model = createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      text: 'SHOULD_NOT_INTRODUCE_AGAIN',
    })
    const reopened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, model)

    expect(model.exchanges).toEqual([])
    expect(reopened.workingArea.mode).toBeNull()
    expect(reopened.conversation.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual(earlier.conversation.map(message => ({
      author: message.author,
      text: message.text,
      approvedMove: message.approvedMove,
    })))
    expect(JSON.stringify(reopened)).not.toContain('SHOULD_NOT_INTRODUCE_AGAIN')
  })

  it('offers to open Learn from a teaching reply without changing the working area mode', async () => {
    const store = memoryStore()
    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store, speakingTeacher())

    const explained = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      text: 'The total has to exist before the loop starts.',
    }))

    expect(explained.workingArea.mode).toBeNull()
    expect(explained.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      approvedMove: 'explain_concept',
      openInLearn: true,
    })

    const answered = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Is the total a variable?' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'answer_question' },
      text: 'Yes. It is a variable that lives outside the loop.',
    }))

    expect(answered.workingArea.mode).toBeNull()
    expect(answered.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      approvedMove: 'answer_question',
      openInLearn: true,
    })
  })

  it('does not offer Learn from a hint, and that turn does not set the working area mode', async () => {
    const store = memoryStore()
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'I am stuck.' },
    }, store, createFakeLanguageModel({
      proposal: { type: 'hint_level_N', level: 1 },
      text: 'Create the total before the loop.',
    }))

    expect(state.workingArea.mode).toBeNull()
    expect(state.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      approvedMove: 'hint_level_1',
      openInLearn: false,
    })
  })

  it('records a submission summary and lets the agents answer with no student text', async () => {
    const store = memoryStore()
    const model = createFakeLanguageModel(
      {
        proposal: { type: 'explain_concept' },
        text: 'The total is still created inside the loop.',
      },
      {
        proposal: { type: 'share_confusion' },
        text: 'mine failed that one too.',
      },
    )
    const code = 'def total(ds):\n    SUBMISSION_CODE_SENTINEL = 0\n'
    const results = [
      { name: 'three numbers', passed: false, expected: '6', actual: '0' },
      { name: 'one number', passed: true, expected: '10', actual: '10' },
      { name: 'empty list', passed: false, expected: 'EXPECTED_SENTINEL', actual: 'ACTUAL_SENTINEL' },
    ]

    const events = []
    for await (const event of streamTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'submission', code, results },
    }, store, model)) {
      events.push(event)
    }

    const textEvents = events.filter(event => event.type === 'text')
    const teacherSpoken = textEvents
      .filter(event => event.author === 'teacher')
      .map(event => event.delta)
      .join('')
    const maiSpoken = textEvents
      .filter(event => event.author === 'deskmate')
      .map(event => event.delta)
      .join('')
    const finished = events.at(-1)
    expect(finished?.type).toBe('state')
    if (finished?.type !== 'state') return
    const state = finished.state

    expect(teacherSpoken).toBe('The total is still created inside the loop.')
    expect(maiSpoken).toBe('mine failed that one too.')
    expect(textEvents.findIndex(event => event.author === 'deskmate'))
      .toBeGreaterThan(textEvents.findLastIndex(event => event.author === 'teacher'))
    expect(state.displayName).toBe('An')
    expect(state.workingArea.mode).toBeNull()
    expect(state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
      openInLearn: message.openInLearn,
    }))).toEqual([
      {
        author: 'event',
        name: 'Practice check',
        role: 'Result',
        text: '1/3 tests passed',
        approvedMove: null,
        openInLearn: false,
      },
      {
        author: 'teacher',
        name: 'Teacher',
        role: 'Teacher',
        text: 'The total is still created inside the loop.',
        approvedMove: 'explain_concept',
        openInLearn: true,
      },
      {
        author: 'deskmate',
        name: 'Mai',
        role: 'Deskmate',
        text: 'mine failed that one too.',
        approvedMove: 'share_confusion',
        openInLearn: false,
      },
    ])
    expect(state.conversation.some(message => message.author === 'student')).toBe(false)
    expect(JSON.stringify(state)).not.toContain('SUBMISSION_CODE_SENTINEL')
    expect(JSON.stringify(state)).not.toContain('EXPECTED_SENTINEL')
    expect(JSON.stringify(state)).not.toContain('ACTUAL_SENTINEL')

    const teacherPropose = model.exchanges.find(exchange => exchange.agent === 'teacher' && exchange.phase === 'propose')
    const deskmatePropose = model.exchanges.find(exchange => exchange.agent === 'deskmate' && exchange.phase === 'propose')
    expect(teacherPropose?.agent).toBe('teacher')
    expect(deskmatePropose?.agent).toBe('deskmate')
    if (teacherPropose?.agent !== 'teacher' || deskmatePropose?.agent !== 'deskmate') return

    expect(teacherPropose.context.submission).toEqual({ code, results })
    expect(teacherPropose.context.draft).toBeNull()
    expect(teacherPropose.context.conversation).toEqual([
      { author: 'event', text: '1/3 tests passed', approvedMove: null },
    ])
    expect(deskmatePropose.context.submission).toEqual({ code, results })
    expect(deskmatePropose.context.conversation).toEqual([
      { author: 'event', text: '1/3 tests passed', approvedMove: null },
    ])
    expect(JSON.stringify(deskmatePropose.context)).not.toContain('Accumulating a total')
    expect(JSON.stringify(deskmatePropose.context)).not.toContain('starterCode')
  })

  it('does not accept a run as a turn', async () => {
    const store = memoryStore()
    const model = speakingTeacher()

    await expect(handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'run',
        code: 'print(1)\n',
        stdout: 'RUN_SHOULD_NOT_BE_A_TURN',
      },
    }, store, model)).rejects.toThrow('The turn endpoint does not accept that event.')

    expect(model.exchanges).toEqual([])
    const opened = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)
    expect(opened.conversation).toEqual([])
    expect(JSON.stringify(opened)).not.toContain('RUN_SHOULD_NOT_BE_A_TURN')
  })

  it('rejects an exercise that is not on the topic', async () => {
    await expect(handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'select_exercise', exerciseId: 'while_loop' },
    }, memoryStore())).rejects.toEqual(expect.objectContaining({
      name: 'UnknownExerciseError',
      statusCode: 400,
    }))
  })
})
