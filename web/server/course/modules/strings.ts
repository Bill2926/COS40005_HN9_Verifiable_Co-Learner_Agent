import type { StudyModule } from '../study-module'

export const stringsModule: StudyModule = {
  id: 'strings',
  materials: {
    heading: 'Text, piece by piece',
    body: 'A string is text. Indexing picks one character, and the first character is at 0. Slicing takes a stretch of the text. Methods such as upper, split, replace, and strip tidy or change it. An f-string drops a value into the text.',
    example: 'name = "An"\nprint(f"Hello, {name}")',
    keyPoint: 'The first character is at index 0, not 1.',
    scopeNote: 'These materials belong to this module alone.',
  },
  exercises: [
    {
      id: 'first_character',
      title: 'First character',
      statement: 'Write first_character(word) so it returns the first character of the word.',
      starterCode: `def first_character(word):
    pass
`,
      tests: [
        { name: 'python', expression: 'first_character("Python")', expected: 'P' },
        { name: 'an', expression: 'first_character("An")', expected: 'A' },
        { name: 'hi', expression: 'first_character("Hi")', expected: 'H' },
      ],
      referenceSolution: [
        'def first_character(word):',
        '    return word[0]',
      ].join('\n'),
    },
    {
      id: 'shout',
      title: 'Shout',
      statement: 'Write shout(word) so it returns the word in uppercase.',
      starterCode: `def shout(word):
    pass
`,
      tests: [
        { name: 'hello', expression: 'shout("hello")', expected: 'HELLO' },
        { name: 'python', expression: 'shout("Python")', expected: 'PYTHON' },
        { name: 'ok', expression: 'shout("ok")', expected: 'OK' },
      ],
      referenceSolution: [
        'def shout(word):',
        '    return word.upper()',
      ].join('\n'),
    },
    {
      id: 'greeting',
      title: 'Greeting',
      statement: 'Write greeting(name) so it returns Hello, then a space, then the name. Use an f-string.',
      starterCode: `def greeting(name):
    pass
`,
      tests: [
        { name: 'an', expression: 'greeting("An")', expected: 'Hello, An' },
        { name: 'mai', expression: 'greeting("Mai")', expected: 'Hello, Mai' },
        { name: 'lee', expression: 'greeting("Lee")', expected: 'Hello, Lee' },
      ],
      referenceSolution: [
        'def greeting(name):',
        '    return f"Hello, {name}"',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      id: 'first-index',
      prompt: 'Which expression selects the first character of `word = "cat"`?',
      choices: [
        'word[0]',
        'word[1]',
        'word[2]',
        'word[3]',
      ],
      correctIndex: 0,
      explanation: 'String indexing starts at zero. word[0] selects c, and word[1] selects a.',
      misconceptions: { 1: 'index_starts_at_one' },
    },
    {
      id: 'insert-value',
      prompt: 'Which expression inserts the value of `name` after Hello?',
      choices: [
        '"Hello, {name}"',
        'f"Hello, name"',
        'f"Hello, {name}"',
        '"Hello, name"',
      ],
      correctIndex: 2,
      explanation: 'The f prefix makes this an f-string. The braces tell Python to insert the value of name.',
    },
    {
      id: 'slice-text',
      prompt: 'Which operation is designed to take a stretch of characters from a string?',
      choices: [
        'Indexing the string',
        'Slicing the string',
        'Uppercasing the string',
        'Stripping the string',
      ],
      correctIndex: 1,
      explanation: 'Slicing selects a stretch of text. Indexing selects one character.',
    },
  ],
  hintLadder: [
    'word[0] is the first character. Counting starts at 0.',
    'word.upper() returns a new string in capitals and leaves word itself unchanged.',
    'An f-string looks like f"Hello, {name}". The braces drop the value in.',
  ],
  misconceptionResponses: [
    {
      id: 'index_starts_at_one',
      response: 'The first character is at index 0, not 1. word[1] is the second character.',
    },
  ],
}
