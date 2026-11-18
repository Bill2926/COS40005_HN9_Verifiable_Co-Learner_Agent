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

// The tools the model may call before it proposes, and the most steps it may take doing so.
export interface ToolLoop {
  tools: readonly ModelTool[]
  maxSteps: number
}

// Why a tool loop ended: the model called the proposal tool (with a move or with none), it took
// `maxSteps` steps without doing so, or it stopped before the cap without doing so. Only the model
// knows which, so it is decided here and nowhere else.
export type ToolLoopEnd = 'proposed' | 'step_cap' | 'stopped'

export interface ToolLoopResult<Proposal> {
  proposal: Proposal | null
  ended: ToolLoopEnd
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
  // `loop.tools` are the tools it may call first, and `loop.maxSteps` caps how many steps it may take;
  // the result says why the loop ended, and carries no move unless it ended at the proposal tool.
  // Rejects when the call fails or the model answers with words instead.
  proposeWithTools: <Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>, loop: ToolLoop) => Promise<ToolLoopResult<Proposal>>
  // The words of one reply, as they arrive.
  streamReply: (instructions: string, prompt: string) => AsyncIterable<string>
  // One reply in full, asked for without streaming. A request the provider refuses reaches the
  // caller with the provider's own message, which the streaming call cannot do.
  reply: (instructions: string, prompt: string) => Promise<string>
}
