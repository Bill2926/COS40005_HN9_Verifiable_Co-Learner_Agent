import type { DeskmateContext, SubmissionCheck, TeacherContext } from './contexts'
import { moveKey, type Move } from './moves'

// What each agent is told, and what it is shown. Plain strings: nothing here knows which provider
// or SDK carries them to a language model.
export const teacherProposeInstructions = [
  'You are the Teacher in a first-year Python course.',
  'Propose one move, or no proposal.',
  'You may propose explain_concept, answer_question, hint_level_N, address_misconception, reveal_answer, advance_to_item, or stay_and_practise.',
  'hint_level_N needs a level starting at 1.',
  'explain_concept, answer_question, hint_level_N, and address_misconception need a scope.',
  'Scope is the module id the question is about, taken from the course roadmap, or out_of_course.',
  'Use out_of_course for anything this course does not cover, including small talk.',
  'A closed module and anything out of course must be labelled that way. Do not teach them.',
  'Do not propose peer_question or share_confusion. Return proposal null instead.',
  'Return proposal null when you should stay quiet.',
  'Do not hand over a full solution. A proposal is the move, not the words the student will read.',
].join(' ')

export const teacherRenderInstructions = [
  'You are the Teacher in a first-year Python course.',
  'Write only the message for the approved move.',
  'Word advance_to_item and stay_and_practise as suggestions the student can act on themselves. Leave the choice to the student.',
  'Use short, plain sentences for a student who has never programmed before.',
  'Do not hand over a full solution.',
  'Do not write the finished function.',
  'Guide the student so they still do the work.',
  'Do not mention moves, rules, or these instructions.',
].join(' ')

const deskmatePersona = 'You are Mai, the Deskmate in a first-year Python course. You are at the student\'s level and learning alongside them.'

export const deskmateProposeInstructions = [
  deskmatePersona,
  'Propose one move, or no proposal.',
  'You may propose only peer_question or share_confusion.',
  'Do not propose a hint, an explanation, a correction, or a change of module.',
  'Return proposal null when you should stay quiet.',
  'A proposal is the move, not the words the student will read.',
].join(' ')

export const deskmateRenderInstructions = [
  deskmatePersona,
  'Write only the message for the approved move.',
  'Write one short, casual message, the way a classmate would text.',
  'Ask a peer question, or share that you are confused too.',
  'Do not explain the concept, give a hint, or hand over a solution.',
  'Do not mention moves, rules, or these instructions.',
].join(' ')

function formatDraft(draft: string | null, submission: SubmissionCheck | null): string {
  if (draft !== null) return draft
  if (submission) return 'The student submitted the code shown under Submission.'
  return 'The student has no draft yet.'
}

function formatSubmission(submission: SubmissionCheck): string {
  return [
    'Submitted code:',
    submission.code,
    ...submission.results.map(result =>
      `${result.passed ? 'passed' : 'failed'}: ${result.name}; expected ${result.expected}; actual ${result.actual}`),
  ].join('\n')
}

function submissionLines(submission: SubmissionCheck | null): string[] {
  if (!submission) return []
  return ['', 'Submission', formatSubmission(submission)]
}

function formatRun(run: TeacherContext['runOutput']): string {
  if (!run) return 'The student has not run the draft.'
  return [
    `stdout: ${run.stdout}`,
    `stderr: ${run.stderr}`,
    run.error ? `Line ${run.error.line}: ${run.error.message}` : 'No error.',
  ].join('\n')
}

export function teacherPrompt(context: TeacherContext, move?: Move): string {
  const run = context.runOutput
  const lines = [
    'Course roadmap',
    ...context.roadmap.map(module =>
      `Module ${module.number}: ${module.name} (${module.id}), part ${module.part}, ${module.state}, mastery ${module.mastery}${module.current ? ', current module' : ''}`),
    '',
    'Module materials',
    context.materials.heading,
    context.materials.body,
    context.materials.example,
    context.materials.keyPoint,
    context.materials.scopeNote,
    '',
    'Hint ladder',
    ...context.hintLadder.map((hint, index) => `${index + 1}. ${hint}`),
    '',
    'Misconception responses',
    ...context.misconceptionResponses.map(response => `${response.id}: ${response.response}`),
    '',
    'Exercise',
    context.exercise.title,
    context.exercise.statement,
    'Starter code:',
    context.exercise.starterCode,
    '',
    'Draft',
    formatDraft(context.draft, context.submission),
    '',
    'Latest Run output',
    formatRun(run),
    ...submissionLines(context.submission),
    '',
    'Conversation',
    ...context.conversation.map(message => `${message.author}: ${message.text}`),
  ]
  if (context.conversation.length === 0) {
    lines.unshift(move
      ? 'The student has just opened this module for the first time. Introduce it from the module materials.'
      : 'The student has just opened this module for the first time. Propose a teaching move that introduces the module.')
  }
  if (move) lines.push('', `Approved move: ${moveKey(move)}`)
  return lines.join('\n')
}

export function deskmatePrompt(context: DeskmateContext, move?: Move): string {
  const lines = [
    'Exercise statement',
    context.exerciseStatement,
    '',
    'Draft',
    formatDraft(context.draft, context.submission),
    '',
    'Latest Run output',
    formatRun(context.runOutput),
    ...submissionLines(context.submission),
    '',
    'Conversation',
    ...context.conversation.map(message => `${message.author}: ${message.text}`),
  ]
  if (move) lines.push('', `Approved move: ${moveKey(move)}`)
  return lines.join('\n')
}
