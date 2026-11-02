import { describe, expect, it } from 'vitest'
import { createConfiguredLanguageModel } from '../server/model/configured-language-model'
import { createFakeLanguageModel } from '../server/model/fake-language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { handleTurn, streamTurn, studentIdForTurn } from '../server/turn/handle-turn'

const signedInStudent = '6f1b0c1e-1111-4111-8111-111111111111'
const otherStudent = '6f1b0c1e-2222-4222-8222-222222222222'
const teacherReply = 'The total has to exist before the loop starts.'

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
    }, createMemoryConversationStore())

    expect(JSON.stringify(state)).not.toContain(otherStudent)
  })

  it('open returns the topic states, the closed reason, Learn mode, and the current exercise', async () => {
    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, createMemoryConversationStore())

    expect(state.knowledgeMap).toEqual([
      { id: 'variable', name: 'Variables', state: 'mastered', current: false },
      { id: 'if_else', name: 'If / else', state: 'mastered', current: false },
      { id: 'for_loop', name: 'For loops', state: 'open', current: true },
      {
        id: 'nested_loop',
        name: 'Nested loops',
        state: 'closed',
        current: false,
        closedReason: 'needs for_loop',
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
  })

  it('select_exercise redraws the chosen exercise and does not keep a draft', async () => {
    const store = createMemoryConversationStore()
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

    expect(state.knowledgeMap).toEqual(opened.knowledgeMap)
    expect(state.workingArea.mode).toBe('learn')
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
    const store = createMemoryConversationStore()
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
    const store = createMemoryConversationStore()

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'An speaking' },
    }, store, speakingTeacher())

    const other = await handleTurn({
      sessionStudentId: otherStudent,
      body: { event: 'open' },
    }, store)

    expect(other.conversation).toEqual([])
    expect(other.workingArea.topicId).toBe('for_loop')
    expect(other.workingArea.exercise.id).toBe('sum_of_a_list')
  })

  it('select_exercise moves the resume point and leaves an exercise marker', async () => {
    const store = createMemoryConversationStore()

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

    expect(reopened.workingArea.topicId).toBe('for_loop')
    expect(reopened.workingArea.exercise.id).toBe('count_the_even_numbers')
    expect(reopened.conversation).toEqual(selected.conversation)

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
    const store = createMemoryConversationStore()
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

    expect(finished.state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'You',
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
      closedReason: 'needs for_loop',
    })
  })

  it('gives the Teacher the draft and latest Run output without storing either', async () => {
    const store = createMemoryConversationStore()
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

    expect(model.exchanges.map(exchange => exchange.phase)).toEqual(['propose', 'render'])
    for (const exchange of model.exchanges) {
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

  it('stays quiet when the Teacher proposes no move', async () => {
    const store = createMemoryConversationStore()
    const model = createFakeLanguageModel({
      proposal: null,
      text: 'QUIET_TEACHER_TEXT',
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Hello' },
    }, store, model)

    expect(model.exchanges.map(exchange => exchange.phase)).toEqual(['propose'])
    expect(state.conversation.map(message => message.author)).toEqual(['student'])
    expect(JSON.stringify(state)).not.toContain('QUIET_TEACHER_TEXT')
  })

  it('does not render a Teacher move the role table forbids', async () => {
    const store = createMemoryConversationStore()
    const model = createFakeLanguageModel({
      proposal: { type: 'peer_question' },
      text: 'FORBIDDEN_TEACHER_TEXT',
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Hello' },
    }, store, model)

    expect(model.exchanges.map(exchange => exchange.phase)).toEqual(['propose'])
    expect(state.conversation.map(message => message.author)).toEqual(['student'])
    expect(JSON.stringify(state)).not.toContain('FORBIDDEN_TEACHER_TEXT')
  })

  it('returns a full redraw with a friendly fallback when the model fails', async () => {
    const store = createMemoryConversationStore()
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
    expect(state.workingArea).toEqual(opened.workingArea)
    expect(state.conversation.map(message => ({
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      approvedMove: message.approvedMove,
    }))).toEqual([
      {
        author: 'student',
        name: 'You',
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
    expect(rendered.workingArea).toEqual(opened.workingArea)
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
    }, createMemoryConversationStore(), createConfiguredLanguageModel({
      mode: 'fake',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: '',
    }))

    expect(state.conversation.at(-1)).toMatchObject({
      author: 'teacher',
      name: 'Teacher',
      role: 'Teacher',
      approvedMove: 'explain_concept',
      text: 'A running total has to be created before the loop, so each pass can add to the same number.',
    })
    expect(state.conversation.filter(message => message.author === 'teacher')).toHaveLength(1)
  })

  it('rejects an exercise that is not on the topic', async () => {
    await expect(handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'select_exercise', exerciseId: 'while_loop' },
    }, createMemoryConversationStore())).rejects.toEqual(expect.objectContaining({
      name: 'UnknownExerciseError',
      statusCode: 400,
    }))
  })
})
