import type { StudyModule } from '../study-module'

export const conditionalsModule: StudyModule = {
  id: 'conditionals',
  materials: {
    heading: 'Choosing a path',
    body: 'if, elif, and else choose which steps run. Python checks the conditions from top to bottom and runs only the first branch that is true. Conditions can be nested, and and, or, and not combine them.',
    example: 'if score >= 50:\n    print("pass")\nelse:\n    print("try again")',
    keyPoint: 'Only the first true branch runs. The others are skipped.',
    scopeNote: 'These materials belong to this module alone.',
  },
  exercises: [
    {
      id: 'sign_of',
      title: 'Sign of a number',
      statement: 'Write sign_of(number) so it returns "positive", "negative", or "zero".',
      starterCode: `def sign_of(number):
    pass
`,
      tests: [
        { name: 'positive', expression: 'sign_of(3)', expected: 'positive' },
        { name: 'negative', expression: 'sign_of(-2)', expected: 'negative' },
        { name: 'zero', expression: 'sign_of(0)', expected: 'zero' },
      ],
      referenceSolution: [
        'def sign_of(number):',
        '    if number > 0:',
        '        return "positive"',
        '    if number < 0:',
        '        return "negative"',
        '    return "zero"',
      ].join('\n'),
    },
    {
      id: 'ticket',
      title: 'Ticket',
      statement: 'Write ticket(age) so it returns "child" under 12, "student" from 12 to 17, and "adult" from 18.',
      starterCode: `def ticket(age):
    pass
`,
      tests: [
        { name: 'child', expression: 'ticket(10)', expected: 'child' },
        { name: 'student', expression: 'ticket(15)', expected: 'student' },
        { name: 'adult', expression: 'ticket(30)', expected: 'adult' },
      ],
      referenceSolution: [
        'def ticket(age):',
        '    if age < 12:',
        '        return "child"',
        '    if age < 18:',
        '        return "student"',
        '    return "adult"',
      ].join('\n'),
    },
    {
      id: 'marked_result',
      title: 'Marked result',
      statement: 'Write result(score, submitted) so it returns "missing" when submitted is false, "pass" when the score is 50 or more, and "fail" otherwise.',
      starterCode: `def result(score, submitted):
    pass
`,
      tests: [
        { name: 'a pass', expression: 'result(80, True)', expected: 'pass' },
        { name: 'a fail', expression: 'result(40, True)', expected: 'fail' },
        { name: 'not submitted', expression: 'result(90, False)', expected: 'missing' },
      ],
      referenceSolution: [
        'def result(score, submitted):',
        '    if not submitted:',
        '        return "missing"',
        '    if score >= 50:',
        '        return "pass"',
        '    return "fail"',
      ].join('\n'),
    },
  ],
  quiz: [
    {
      id: 'placeholder_1',
      prompt: 'Placeholder question 1 for conditionals.',
      choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correctIndex: 0,
      explanation: 'Placeholder explanation, until the real quiz lands.',
    },
    {
      id: 'placeholder_2',
      prompt: 'Placeholder question 2 for conditionals.',
      choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correctIndex: 0,
      explanation: 'Placeholder explanation, until the real quiz lands.',
    },
    {
      id: 'placeholder_3',
      prompt: 'Placeholder question 3 for conditionals.',
      choices: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
      correctIndex: 0,
      explanation: 'Placeholder explanation, until the real quiz lands.',
    },
  ],
  hintLadder: [
    'Check the cases from top to bottom. Return as soon as one case matches.',
    'age < 12 is the child case. The next check can be age < 18, because 11 has already returned.',
    'if not submitted comes before the score check, or a missing paper could be marked as a pass.',
  ],
  misconceptionResponses: [
    {
      id: 'every_branch_runs',
      response: 'Only the first true branch runs. elif and else are skipped once an earlier condition matched.',
    },
  ],
}
