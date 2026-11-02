import { createDeepSeek, type DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek'
import { generateText, Output, streamText } from 'ai'
import { z } from 'zod'
import type { LanguageModel, TeacherContext } from './language-model'
import { moveKey, type Move } from './moves'

const moveSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('explain_concept') }),
  z.object({ type: z.literal('answer_question') }),
  z.object({ type: z.literal('hint_level_N'), level: z.int().min(1) }),
  z.object({ type: z.literal('address_misconception'), misconceptionId: z.string().min(1) }),
  z.object({ type: z.literal('reveal_answer') }),
  z.object({ type: z.literal('peer_question') }),
  z.object({ type: z.literal('share_confusion') }),
  z.object({ type: z.literal('advance_to_item'), topicId: z.string().min(1) }),
  z.object({ type: z.literal('stay_and_practise') }),
])

const proposalSchema = z.object({
  proposal: z.union([z.null(), moveSchema]),
})

const providerOptions = {
  deepseek: {
    thinking: { type: 'disabled' },
  } satisfies DeepSeekLanguageModelChatOptions,
}

const proposeInstructions = [
  'You are the Teacher in a first-year Python course.',
  'Propose one move, or no proposal.',
  'You may propose explain_concept, answer_question, hint_level_N, address_misconception, reveal_answer, advance_to_item, or stay_and_practise.',
  'hint_level_N needs a level starting at 1.',
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

export function createDeepSeekLanguageModel(options: {
  apiKey: string
  model: string
}): LanguageModel {
  const deepseek = createDeepSeek({ apiKey: options.apiKey })
  const model = deepseek(options.model)

  return {
    async propose(context) {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: proposalSchema }),
        instructions: proposeInstructions,
        prompt: teacherPrompt(context),
        providerOptions,
      })
      if (!output) throw new Error('The language model returned no proposal.')
      return output.proposal
    },
    async *render(context, move) {
      const result = streamText({
        model,
        instructions: renderInstructions,
        prompt: teacherPrompt(context, move),
        providerOptions,
      })
      for await (const delta of result.textStream) {
        if (delta.length > 0) yield delta
      }
    },
  }
}

function teacherPrompt(context: TeacherContext, move?: Move): string {
  const run = context.runOutput
  const lines = [
    'Topic materials',
    context.materials.heading,
    context.materials.body,
    context.materials.example,
    context.materials.scopeNote,
    '',
    'Hint ladder',
    ...context.hintLadder.map((hint, index) => `${index + 1}. ${hint}`),
    '',
    'Misconception responses',
    ...context.misconceptionResponses.map(item => `${item.id}: ${item.response}`),
    '',
    'Exercise',
    context.exercise.title,
    context.exercise.statement,
    'Starter code:',
    context.exercise.starterCode,
    '',
    'Draft',
    context.draft ?? 'The student has no draft yet.',
    '',
    'Latest Run output',
    run
      ? [
          `stdout: ${run.stdout}`,
          `stderr: ${run.stderr}`,
          run.error ? `Line ${run.error.line}: ${run.error.message}` : 'No error.',
        ].join('\n')
      : 'The student has not run the draft.',
    '',
    'Conversation',
    ...context.conversation.map(message => `${message.author}: ${message.text}`),
  ]
  if (move) lines.push('', `Approved move: ${moveKey(move)}`)
  return lines.join('\n')
}
