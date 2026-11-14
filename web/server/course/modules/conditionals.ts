import type { ModuleContent } from '../course-spec'

export const conditionalsModule: ModuleContent = {
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
      id: 'branch-order',
      prompt: 'An `if` condition and the following `elif` condition would both be true. Which branches run?',
      choices: [
        'Only the elif branch',
        'Only the else branch',
        'Both the if and elif branches',
        'Only the if branch',
      ],
      correctIndex: 3,
      explanation: 'Python runs the first matching branch and skips the rest of the chain.',
      misconceptions: { 2: 'every_branch_runs' },
    },
    {
      id: 'else-branch',
      prompt: 'When does the `else` branch of an `if` and `elif` chain run?',
      choices: [
        'When no earlier condition is true',
        'When all earlier conditions are true',
        'When the first condition is true',
        'When only the last condition is true',
      ],
      correctIndex: 0,
      explanation: 'The else branch is the fallback when none of the earlier conditions is true.',
    },
    {
      id: 'nested-condition',
      prompt: 'What makes a conditional nested?',
      choices: [
        'It follows another conditional',
        'It has more than one branch',
        'It sits inside another branch',
        'It uses more than one condition',
      ],
      correctIndex: 2,
      explanation: 'A conditional is nested when it appears inside a branch of another conditional.',
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
