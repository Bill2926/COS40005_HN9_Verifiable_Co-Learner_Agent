import { describe, expect, it } from 'vitest'
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

  it('ignores a student id in the request body', () => {
    expect(studentIdForTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open', studentId: otherStudent },
    })).toBe(signedInStudent)

    const state = handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open', studentId: otherStudent },
    })

    expect(JSON.stringify(state)).not.toContain(otherStudent)
  })

  it('open returns the topic states, the closed reason, Learn mode, and the current exercise', () => {
    const state = handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    })

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

  it('select_exercise redraws the chosen exercise and does not keep a draft', () => {
    const opened = handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'open' },
    })

    const state = handleTurn({
      sessionStudentId: signedInStudent,
      body: {
        event: 'select_exercise',
        exerciseId: 'count_the_even_numbers',
        draft: 'def count_even(ds):\n    return 999\n',
      },
    })

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
    expect(state.conversation).toEqual([])
    expect(JSON.stringify(state)).not.toContain('return 999')
  })

  it('rejects an exercise that is not on the topic', () => {
    expect(() => handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'select_exercise', exerciseId: 'while_loop' },
    })).toThrow(expect.objectContaining({
      name: 'UnknownExerciseError',
      statusCode: 400,
    }))
  })
})
