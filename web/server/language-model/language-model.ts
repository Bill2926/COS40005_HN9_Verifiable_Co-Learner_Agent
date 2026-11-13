import type { Move } from '../agents'

// What a language model can do, with no idea who is asking. `instructions` says how to behave and
// `prompt` says what is in front of it; the agents component writes both.
export interface LanguageModel {
  // One move, or null when the model chooses to stay quiet. Rejects when the model fails.
  proposeMove: (instructions: string, prompt: string) => Promise<Move | null>
  // The words of one reply, as they arrive.
  streamReply: (instructions: string, prompt: string) => AsyncIterable<string>
}
