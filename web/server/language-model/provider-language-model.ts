import { generateText, Output, streamText, type LanguageModel as ProviderModel } from 'ai'
import { z } from 'zod'
import type { LanguageModel, ProposalSchema } from './language-model'

// response_format: { type: 'json_object' } is all a provider like DeepSeek
// accepts, and it carries no schema. Output.object validates the reply but
// never tells the model the shape, so the schema is spelled out here. Derived
// from the schema it is checked against so the two cannot drift apart.
function proposalShape(schema: z.ZodType): string {
  return [
    'Reply with JSON and nothing else. The JSON must match this JSON Schema:',
    JSON.stringify(z.toJSONSchema(schema)),
  ].join(' ')
}

// Holding a reply to a proposal schema and streaming rendered text are the same whichever provider
// built the model. What to say, and which proposals exist, is not decided here: the caller passes the
// instructions, the prompt and the schema.
export function createProviderLanguageModel(model: ProviderModel): LanguageModel {
  return {
    async proposeMove<Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>): Promise<Proposal | null> {
      const { output } = await generateText({
        model,
        output: Output.object({ schema }),
        instructions: `${instructions} ${proposalShape(schema)}`,
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
