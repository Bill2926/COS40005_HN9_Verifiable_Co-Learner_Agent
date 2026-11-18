import type { z } from 'zod'

// The shape a proposal must take: an object holding one proposal, or null for none. The caller owns
// the schema; the language model only holds the reply to it.
export type ProposalSchema<Proposal> = z.ZodType<{ proposal: Proposal | null }>

// A tool the model may call before it proposes. The caller owns what it does and binds whatever it
// needs (a student, a course) itself, so nothing the model writes chooses whose data is read.
export interface ModelTool {
  name: string
  description: string
  inputSchema: z.ZodType
  run: (input: unknown) => Promise<unknown>
}

export interface ToolLoop {
  tools?: readonly ModelTool[]
  // Called when `maxSteps` is reached with no proposal, so the caller can record it.
  onStepCap?: () => void
}

// What a language model can do, with no idea who is asking or which moves exist. `instructions` says
// how to behave and `prompt` says what is in front of it; the agents component writes both, and
// supplies the proposal schema.
export interface LanguageModel {
  // One proposal that parses against `schema`, or null when the model chooses to stay quiet.
  // A reply that does not parse is asked for once more; rejects when the second does not parse
  // either, or at once when the call itself fails.
  proposeMove: <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>) => Promise<Proposal | null>
  // The same proposal asked for as a tool call the model must make, rather than as JSON in the text.
  // `loop.tools` are the tools it may call first; `maxSteps` caps how long the model may keep calling other tools first; no move comes back when
  // the cap is reached. Rejects when the call fails or the model answers with words instead.
  proposeWithTools: <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>, maxSteps: number, loop?: ToolLoop) => Promise<Proposal | null>
  // The words of one reply, as they arrive.
  streamReply: (instructions: string, prompt: string) => AsyncIterable<string>
  // One reply in full, asked for without streaming. A request the provider refuses reaches the
  // caller with the provider's own message, which the streaming call cannot do.
  reply: (instructions: string, prompt: string) => Promise<string>
}
