import type { z } from 'zod'

// The shape a proposal must take: an object holding one proposal, or null for none. The caller owns
// the schema; the language model only holds the reply to it.
export type ProposalSchema<Proposal> = z.ZodType<{ proposal: Proposal | null }>

// What a language model can do, with no idea who is asking or which moves exist. `instructions` says
// how to behave and `prompt` says what is in front of it; the agents component writes both, and
// supplies the proposal schema.
export interface LanguageModel {
  // One proposal that parses against `schema`, or null when the model chooses to stay quiet.
  // A reply that does not parse is asked for once more; rejects when the second does not parse
  // either, or at once when the call itself fails.
  proposeMove: <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>) => Promise<Proposal | null>
  // The same proposal asked for as a tool call the model must make, rather than as JSON in the text.
  // `maxSteps` caps how long the model may keep calling other tools first; no move comes back when
  // the cap is reached. Rejects when the call fails or the model answers with words instead.
  proposeWithTools: <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>, maxSteps: number) => Promise<Proposal | null>
  // The words of one reply, as they arrive.
  streamReply: (instructions: string, prompt: string) => AsyncIterable<string>
  // One reply in full, asked for without streaming. A request the provider refuses reaches the
  // caller with the provider's own message, which the streaming call cannot do.
  reply: (instructions: string, prompt: string) => Promise<string>
}
