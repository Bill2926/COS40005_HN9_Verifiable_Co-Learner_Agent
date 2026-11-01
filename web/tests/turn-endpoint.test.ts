import { describe, expect, it } from 'vitest'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { handleTurn, studentIdForTurn } from '../server/turn/handle-turn'

const signedInStudent = '6f1b0c1e-1111-4111-8111-111111111111'
const otherStudent = '6f1b0c1e-2222-4222-8222-222222222222'

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

  it('open returns the student messages in the order they were sent', async () => {
    const store = createMemoryConversationStore()

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, store)
    const sent = await handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'message',
        text: 'Inside the loop, I think.',
        draft: 'def total(ds):\n    return 999\n',
      },
    }, store)

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    }, store)

    expect(state.conversation.map(message => ({
      author: message.author,
      text: message.text,
      exerciseId: message.exerciseId,
    }))).toEqual([
      {
        author: 'student',
        text: 'Where does the total live?',
        exerciseId: 'sum_of_a_list',
      },
      {
        author: 'student',
        text: 'Inside the loop, I think.',
        exerciseId: 'sum_of_a_list',
      },
    ])
    expect(state.conversation.some(message => message.author === 'teacher' || message.author === 'deskmate')).toBe(false)
    expect(JSON.stringify(state)).not.toContain('return 999')
    expect(state.workingArea.exercise.id).toBe('sum_of_a_list')
    expect(sent.conversation.map(message => message.text)).toEqual([
      'Where does the total live?',
      'Inside the loop, I think.',
    ])
    expect(sent.knowledgeMap).toEqual(state.knowledgeMap)
    expect(sent.workingArea).toEqual(state.workingArea)
  })

  it('keeps each student\'s conversation separate', async () => {
    const store = createMemoryConversationStore()

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'An speaking' },
    }, store)

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
    }, store)

    const selected = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'select_exercise', exerciseId: 'count_the_even_numbers' },
    }, store)

    expect(selected.workingArea.exercise.id).toBe('count_the_even_numbers')
    expect(selected.conversation.map(message => ({
      author: message.author,
      text: message.text,
      exerciseId: message.exerciseId,
    }))).toEqual([
      {
        author: 'student',
        text: 'Where does the total live?',
        exerciseId: 'sum_of_a_list',
      },
      {
        author: 'event',
        text: 'Count the even numbers',
        exerciseId: 'count_the_even_numbers',
      },
    ])
    expect(selected.conversation.some(message => message.author === 'teacher' || message.author === 'deskmate')).toBe(false)

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
    }, store)

    expect(followed.conversation.at(-1)).toMatchObject({
      author: 'student',
      text: 'Are evens the ones that divide by two?',
      exerciseId: 'count_the_even_numbers',
    })
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
