import { generateText, Output, streamText, type LanguageModel as ProviderModel } from 'ai'
import { z } from 'zod'
import type { Move } from '../agents'
import type { LanguageModel } from './language-model'

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

// response_format: { type: 'json_object' } is all a provider like DeepSeek
// accepts, and it carries no schema. Output.object validates the reply but
// never tells the model the shape, so the schema is spelled out here. Derived
// from proposalSchema so the two cannot drift apart.
const proposalShape = [
  'Reply with JSON and nothing else. The JSON must match this JSON Schema:',
  JSON.stringify(z.toJSONSchema(proposalSchema)),
].join(' ')

// The proposal schema and the streaming of rendered text are the same whichever provider built the
// model. What to say is not decided here: the caller passes the instructions and the prompt.
export function createProviderLanguageModel(model: ProviderModel): LanguageModel {
  return {
    async proposeMove(instructions, prompt): Promise<Move | null> {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: proposalSchema }),
        instructions: `${instructions} ${proposalShape}`,
        prompt,
      })
      if (!output) throw new Error('The language model returned no proposal.')
      return output.proposal
    },

    async* streamReply(instructions, prompt) {
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
    },
  }
}
