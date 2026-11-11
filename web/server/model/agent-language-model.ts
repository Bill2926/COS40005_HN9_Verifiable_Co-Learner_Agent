import { generateText, Output, streamText, type LanguageModel as ProviderModel } from 'ai'
import { z } from 'zod'
import type { DeskmateContext, LanguageModel, SubmissionCheck, TeacherContext } from './language-model'
import { moveKey, type Move } from './moves'

const scopeSchema = z.string().min(1)

const moveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('explain_concept'), scope: scopeSchema }),
  z.object({ type: z.literal('answer_question'), scope: scopeSchema }),
  z.object({ type: z.literal('hint_level_N'), level: z.int().min(1), scope: scopeSchema }),
  z.object({ type: z.literal('address_misconception'), misconceptionId: z.string().min(1), scope: scopeSchema }),
  z.object({ type: z.literal('reveal_answer') }),
  z.object({ type: z.literal('peer_question') }),
  z.object({ type: z.literal('share_confusion') }),
  z.object({ type: z.literal('advance_to_item'), moduleId: z.string().min(1) }),
  z.object({ type: z.literal('stay_and_practise') }),
])

const proposalSchema = z.object({
  proposal: z.union([z.null(), moveSchema]),
})

const proposeInstructions = [
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

const renderInstructions = [
  'You are the Teacher in a first-year Python course.',
  'Write only the message for the approved move.',
  'Use short, plain sentences for a student who has never programmed before.',
  'Do not hand over a full solution.',
  'Do not write the finished function.',
  'Guide the student so they still do the work.',
  'Do not mention moves, rules, or these instructions.',
].join(' ')

const deskmateProposeInstructions = [
  'You are Mai, the Deskmate, a classmate in a first-year Python course.',
  'You know little, and you are not a teacher.',
  'Propose one move, or no proposal.',
  'You may propose only peer_question or share_confusion.',
  'Do not propose a hint, an explanation, a correction, or a change of module.',
  'Return proposal null when you should stay quiet.',
  'A proposal is the move, not the words the student will read.',
].join(' ')

const deskmateRenderInstructions = [
  'You are Mai, the Deskmate, a classmate in a first-year Python course.',
  'Write only the message for the approved move.',
  'Write one short, casual message, the way a classmate would text.',
  'Ask a peer question, or share that you are confused too.',
  'Do not explain the concept, give a hint, or hand over a solution.',
  'Do not mention moves, rules, or these instructions.',
].join(' ')

// The prompts, the move vocabulary, the proposal schema, and the streaming of
// rendered text are the same whichever provider built the model.
export function createAgentLanguageModel(model: ProviderModel): LanguageModel {
  async function proposeMove(instructions: string, prompt: string): Promise<Move | null> {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: proposalSchema }),
      instructions,
      prompt,
    })
    if (!output) throw new Error('The language model returned no proposal.')
    return output.proposal
  }

  async function* streamReply(instructions: string, prompt: string): AsyncGenerator<string> {
    const result = streamText({
      model,
      instructions,
      prompt,
    })
    for await (const part of result.stream) {
      if (part.type === 'error' || part.type === 'abort') {
        throw new Error('The language model failed.')
      }
      if (part.type === 'text-delta' && part.text.length > 0) yield part.text
    }
  }

  return {
    teacher: {
      propose(context) {
        return proposeMove(proposeInstructions, teacherPrompt(context))
      },
      render(context, move) {
        return streamReply(renderInstructions, teacherPrompt(context, move))
      },
    },
    deskmate: {
      propose(context) {
        return proposeMove(deskmateProposeInstructions, deskmatePrompt(context))
      },
      render(context, move) {
        return streamReply(deskmateRenderInstructions, deskmatePrompt(context, move))
      },
    },
  }
}

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

function teacherPrompt(context: TeacherContext, move?: Move): string {
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

function deskmatePrompt(context: DeskmateContext, move?: Move): string {
  const lines = [
    'Misconception responses',
    ...context.misconceptionResponses.map(response => `${response.id}: ${response.response}`),
    '',
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
