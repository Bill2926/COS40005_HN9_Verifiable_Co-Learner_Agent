import type { ModuleContent } from '../course-spec'
import { legacyMaterials } from '../materials'

export const gettingStartedModule: ModuleContent = {
  materials: [
    ...legacyMaterials({
      heading: 'A first program',
      body: 'A program is a list of steps the computer follows. print() shows text, and a comment, a line that starts with #, is a note for a person. Python skips comments.',
      example: '# Show a greeting\nprint("Hello, world")',
      keyPoint: 'The text you want to show sits inside quotes. A comment starts with # and is not run.',
      scopeNote: 'These materials belong to this module alone.',
    }),
    {
      type: 'diagram',
      mermaid: 'flowchart LR\n  program[A program] --> shown["print()"]',
    },
    {
      type: 'video',
      url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8',
      title: 'A first Python program',
    },
  ],
  exercises: [
    {
      id: 'say_hello',
      title: 'Say hello',
      statement: 'Write hello(name) so it returns a greeting: Hello, then a space, then the name. Put a comment above the return that says what the function does.',
      starterCode: `def hello(name):
    pass
`,
      tests: [
        { name: 'greeting for An', expression: 'hello("An")', expected: 'Hello, An' },
        { name: 'greeting for Mai', expression: 'hello("Mai")', expected: 'Hello, Mai' },
        { name: 'greeting for world', expression: 'hello("world")', expected: 'Hello, world' },
      ],
      referenceSolution: [
        'def hello(name):',
        '    # Greet the person by name',
        '    return "Hello, " + name',
      ].join('\n'),
    },
    {
      id: 'join_words',
      title: 'Join two words',
      statement: 'Write join_words(first, second) so it returns the two words with a space between them.',
      starterCode: `def join_words(first, second):
    pass
`,
      tests: [
        { name: 'hello and a name', expression: 'join_words("Hello", "An")', expected: 'Hello An' },
        { name: 'two words', expression: 'join_words("Python", "program")', expected: 'Python program' },
        { name: 'a short start', expression: 'join_words("Good", "start")', expected: 'Good start' },
      ],
      referenceSolution: [
        'def join_words(first, second):',
        '    return first + " " + second',
      ].join('\n'),
    },
    {
      id: 'sign_the_program',
      title: 'Sign the program',
      statement: 'Write sign_off(name) so it returns the name followed by " wrote this program".',
      starterCode: `def sign_off(name):
    pass
`,
      tests: [
        { name: 'signed by An', expression: 'sign_off("An")', expected: 'An wrote this program' },
        { name: 'signed by Mai', expression: 'sign_off("Mai")', expected: 'Mai wrote this program' },
        { name: 'signed by Lee', expression: 'sign_off("Lee")', expected: 'Lee wrote this program' },
      ],
      referenceSolution: [
        'def sign_off(name):',
        '    return name + " wrote this program"',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      id: 'print-text',
      prompt: 'Which line displays the literal word Hello?',
      choices: [
        'print(Hello)',
        'print("Hello")',
        '# print("Hello")',
        'print("#Hello")',
      ],
      correctIndex: 1,
      explanation: 'Quotes make Hello literal text. print() displays that text.',
      misconceptions: { 0: 'missing_quotes' },
    },
    {
      id: 'comment-line',
      prompt: 'Which line is a comment Python skips?',
      choices: [
        'print("# Note")',
        'print("A note")',
        '"Note for a reader"',
        '# Note for a reader',
      ],
      correctIndex: 3,
      explanation: 'A line beginning with # is a comment. A # inside quotes is part of the text.',
    },
    {
      id: 'program-steps',
      prompt: 'What is a program?',
      choices: [
        'A list of steps for a computer',
        'A list of notes for a reader',
        'A list of words to display',
        'A list of names for commands',
      ],
      correctIndex: 0,
      explanation: 'A program gives the computer steps to follow. It can include notes or display text, but those are only parts of a program.',
    },
  ],
  hintLadder: [
    'Text you want to show or return sits between quotes, like "Hello".',
    'Join two pieces of text with +. A space is text as well: " ".',
    'Return the text you built. A comment starts with # and does not change what is returned.',
  ],
  misconceptionResponses: [
    {
      id: 'missing_quotes',
      response: 'The words are missing their quotes, so Python looks for a variable instead of using the text. Put the text between quotes.',
    },
  ],
}
