import type { ModuleContent } from '../course-spec'

export const loopsModule: ModuleContent = {
  materials: {
    heading: 'Accumulating a total',
    body: 'A running total needs a variable that survives every pass of the loop. for walks a collection, range() builds a sequence of numbers, and while repeats while a condition stays true. break leaves the loop early, continue skips to the next pass, and a loop can sit inside another loop.',
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
      referenceSolution: [
        'def total(ds):',
        '    s = 0',
        '    for x in ds:',
        '        s = s + x',
        '    return s',
      ].join('\n'),
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
      referenceSolution: [
        'def count_even(ds):',
        '    n = 0',
        '    for x in ds:',
        '        if x % 2 == 0:',
        '            n = n + 1',
        '    return n',
      ].join('\n'),
    },
    {
      id: 'count_the_items',
      title: 'Count the items',
      statement: 'Count how many items are in a list. Use a `for` loop, and start the count at zero before the loop.',
      starterCode: `def count_items(ds):
    pass
`,
      tests: [
        { name: 'three items', expression: 'count_items([1, 2, 3])', expected: '3' },
        { name: 'one item', expression: 'count_items([10])', expected: '1' },
        { name: 'empty list', expression: 'count_items([])', expected: '0' },
      ],
      referenceSolution: [
        'def count_items(ds):',
        '    n = 0',
        '    for _ in ds:',
        '        n = n + 1',
        '    return n',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      id: 'running-total',
      prompt: 'Where should you set a running total to zero so it remembers every number you add?',
      choices: [
        'At the start of every pass',
        'Once before the loop starts',
        'At the end of every pass',
        'Once after the loop ends',
      ],
      correctIndex: 1,
      explanation: 'Setting the total to zero before the loop lets each pass build on the previous total.',
      misconceptions: { 0: 'accumulator_reset_inside_loop', 2: 'accumulator_reset_inside_loop' },
    },
    {
      id: 'skip-pass',
      prompt: 'Which keyword skips the rest of the current pass and goes to the next one?',
      choices: [
        'break',
        'while',
        'for',
        'continue',
      ],
      correctIndex: 3,
      explanation: 'continue skips the rest of the current pass. break exits the loop entirely.',
    },
    {
      id: 'while-condition',
      prompt: 'What does `while` check before starting each pass?',
      choices: [
        'Whether its condition stays true',
        'Whether its condition stays false',
        'Whether it finishes its first pass',
        'Whether it has a loop inside it',
      ],
      correctIndex: 0,
      explanation: 'A while loop repeats while its condition is true. When the condition becomes false, it stops.',
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
