import type { z } from 'zod'

// The shape a proposal must take: an object holding one proposal, or null for none. The caller owns
// the schema; the language model only holds the reply to it.
export type ProposalSchema<Proposal> = z.ZodType<{ proposal: Proposal | null }>

// What a language model can do, with no idea who is asking or which moves exist. `instructions` says
// how to behave and `prompt` says what is in front of it; the agents component writes both, and
// supplies the proposal schema.
export interface LanguageModel {
  // One proposal that parses against `schema`, or null when the model chooses to stay quiet.
  // Rejects when the model fails or its reply does not parse.
  proposeMove: <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>) => Promise<Proposal | null>
  // The words of one reply, as they arrive.
  streamReply: (instructions: string, prompt: string) => AsyncIterable<string>
}
