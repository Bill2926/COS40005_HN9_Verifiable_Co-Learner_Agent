import type { ExerciseCheck, ModuleMaterials } from '../../shared/turn'

export interface Exercise {
  id: string
  title: string
  statement: string
  starterCode: string
  tests: readonly [ExerciseCheck, ExerciseCheck, ExerciseCheck]
}

export interface MisconceptionResponse {
  id: string
  response: string
}

export const forLoopModule: {
  id: string
  name: string
  materials: ModuleMaterials
  exercises: readonly [Exercise, Exercise]
  hintLadder: readonly string[]
  misconceptionResponses: readonly MisconceptionResponse[]
} = {
  id: 'for_loop',
  name: 'For loops',
  materials: {
    heading: 'Accumulating a total',
    body: 'A running total needs a variable that survives every pass of the loop.',
    example: '# Create the total before the loop\ns = 0\nfor x in ds:\n    s = s + x',
    keyPoint: 'Look at where `s = 0` is. If it were inside the loop, the total would go back to zero on every pass and forget the numbers before it.',
    scopeNote: 'These materials belong to this module alone.',
  },
  exercises: [
    {
      id: 'sum_of_a_list',
      title: 'Sum of a list',
      statement:
        'Add up every number in a list. Use a `for` loop, and create the total before the loop so it survives every pass.',
      starterCode: `def total(ds):
    pass
`,
      tests: [
        { name: 'three numbers', expression: 'total([1, 2, 3])', expected: '6' },
        { name: 'one number', expression: 'total([10])', expected: '10' },
        { name: 'empty list', expression: 'total([])', expected: '0' },
      ],
    },
    {
      id: 'count_the_even_numbers',
      title: 'Count the even numbers',
      statement: 'Count how many numbers in a list are even. Use a `for` loop.',
      starterCode: `def count_even(ds):
    pass
`,
      tests: [
        { name: 'two evens', expression: 'count_even([1, 2, 3, 4])', expected: '2' },
        { name: 'all even', expression: 'count_even([2, 4, 6])', expected: '3' },
        { name: 'none even', expression: 'count_even([1, 3, 5])', expected: '0' },
      ],
    },
  ],
  hintLadder: [
    'A running total has to be created before the loop. A variable created inside the loop starts again on every pass.',
    'Add each number to that same total. Do not set the total back to zero inside the loop.',
    'When the loop finishes, return the total. It should hold every number you added.',
  ],
  misconceptionResponses: [
    {
      id: 'accumulator_reset_inside_loop',
      response:
        'The total is set back to zero inside the loop, so each pass forgets the numbers before it. Create the total once, before the loop starts.',
    },
  ],
}
