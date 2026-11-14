import type { ModuleContent } from '../course-spec'

export const variablesModule: ModuleContent = {
  materials: {
    heading: 'Names for values',
    body: 'A variable is a name for a value. A value has a type: a whole number (int), a decimal (float), text (str), or true or false (bool). Operators such as +, *, and >= combine values. input() reads text, and int() turns that text into a whole number.',
    example: 'years = int("2")\nprint(years + 1)',
    keyPoint: 'input() gives you text. Use int() before you do arithmetic with it.',
    scopeNote: 'These materials belong to this module alone.',
  },
  exercises: [
    {
      id: 'total_cost',
      title: 'Total cost',
      statement: 'Write total_cost(price, count) so it returns the price multiplied by the count.',
      starterCode: `def total_cost(price, count):
    pass
`,
      tests: [
        { name: 'four at three', expression: 'total_cost(4, 3)', expected: '12' },
        { name: 'one item', expression: 'total_cost(10, 1)', expected: '10' },
        { name: 'nothing to buy', expression: 'total_cost(0, 5)', expected: '0' },
      ],
      referenceSolution: [
        'def total_cost(price, count):',
        '    return price * count',
      ].join('\n'),
    },
    {
      id: 'whole_number',
      title: 'Whole number',
      statement: 'Write whole_number(text) so it returns the text as a whole number. "12" becomes 12.',
      starterCode: `def whole_number(text):
    pass
`,
      tests: [
        { name: 'twelve', expression: 'whole_number("12")', expected: '12' },
        { name: 'zero', expression: 'whole_number("0")', expected: '0' },
        { name: 'seven', expression: 'whole_number("7")', expected: '7' },
      ],
      referenceSolution: [
        'def whole_number(text):',
        '    return int(text)',
      ].join('\n'),
    },
    {
      id: 'old_enough',
      title: 'Old enough',
      statement: 'Write old_enough(age) so it returns True when the age is 18 or more, and False otherwise.',
      starterCode: `def old_enough(age):
    pass
`,
      tests: [
        { name: 'eighteen', expression: 'old_enough(18)', expected: 'True' },
        { name: 'seventeen', expression: 'old_enough(17)', expected: 'False' },
        { name: 'forty', expression: 'old_enough(40)', expected: 'True' },
      ],
      referenceSolution: [
        'def old_enough(age):',
        '    return age >= 18',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      id: 'input-arithmetic',
      prompt: 'Which expression reads any whole-number age the user types and adds one to it?',
      choices: [
        'input() + 1',
        'input() + "1"',
        'int(input()) + 1',
        'int("1") + 1',
      ],
      correctIndex: 2,
      explanation: 'input() returns text. Convert it with int() before adding one.',
      misconceptions: { 0: 'added_text_to_a_number' },
    },
    {
      id: 'value-type',
      prompt: 'Which type represents a decimal number like 2.5?',
      choices: [
        'int',
        'float',
        'str',
        'bool',
      ],
      correctIndex: 1,
      explanation: 'A float represents a decimal number. An int represents a whole number.',
    },
    {
      id: 'variable-name',
      prompt: 'In `years = int("2")`, what does `years` name?',
      choices: [
        'The text "2"',
        'The function int',
        'The type str',
        'The whole number 2',
      ],
      correctIndex: 3,
      explanation: 'int() converts the text into the whole number 2, and years names that value.',
    },
  ],
  hintLadder: [
    'Give the result a name if you want, then return that name. price * count is the total.',
    'int(text) turns the characters "12" into the number 12.',
    'age >= 18 is True or False. Return that comparison.',
  ],
  misconceptionResponses: [
    {
      id: 'added_text_to_a_number',
      response: 'A number was joined to text. int() turns text into a number first, and then + can add.',
    },
  ],
}
