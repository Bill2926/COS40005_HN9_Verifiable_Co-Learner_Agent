import type { LanguageModel, ProposalSchema, ToolLoop, ToolLoopResult } from './language-model'

// A tool the scripted model calls, with the input it gives.
export interface FakeToolCall {
  name: string
  input: unknown
}

// What one of the caller's tools gave back when the scripted model called it.
export interface FakeToolResult extends FakeToolCall {
  output: unknown
}

// One step of a scripted tool-call conversation. A step carrying a `proposal` is the model calling the
// proposal tool with it; a step naming none is a step that does not, which is what a model looking
// round its other tools (`toolCalls`) spends before it answers. `stop` is the model ending the loop
// before the cap without proposing. An Error stands for the request itself failing.
export interface FakeModelStep {
  proposal?: unknown
  toolCalls?: FakeToolCall[]
  stop?: true
}

export interface FakeLanguageModelScript {
  // The steps each call to `proposeWithTools` reads, in order, and likewise the JSON of each
  // `proposeMove` and the words of each `reply` and `streamReply`. A call that runs past the end of
  // its list fails, so a script that runs short is reported instead of quietly answering nothing.
  steps?: (FakeModelStep | Error)[]
  proposals?: (string | Error)[]
  replies?: (string | Error)[]
}

export interface FakeModelCall {
  operation: 'proposeMove' | 'proposeWithTools' | 'reply' | 'streamReply'
  instructions: string
  prompt: string
  // Only a tool call spends steps: how many it spent, and the cap it was given.
  steps?: number
  maxSteps?: number
}

const lists = { steps: 'step', proposals: 'proposal', replies: 'reply' } as const
type List = keyof typeof lists

// The model the `fake` provider and the tests of a tool-call turn stand in for. It is given the same
// instructions, prompt and schema as the real one and answers from the script, so a step cap, a quiet
// model and a refused key can be rehearsed with no provider, no key and no cost. Unlike the scripted
// agents in `agents`, which answer with a move without ever seeing a prompt, this is the layer beneath.
export function createFakeLanguageModel(script: FakeLanguageModelScript = {}): LanguageModel & { calls: FakeModelCall[], toolResults: FakeToolResult[] } {
  const calls: FakeModelCall[] = []
  const toolResults: FakeToolResult[] = []
  const spent: Record<List, number> = { steps: 0, proposals: 0, replies: 0 }

  function read<Entry>(list: List, entries: (Entry | Error | undefined)[]): Entry | Error {
    const entry = entries[spent[list]]
    if (entry === undefined) throw new Error(`The scripted language model has no ${lists[list]} left.`)
    spent[list] += 1
    return entry
  }

  return {
    calls,
    toolResults,

    async proposeMove<Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>) {
      const call: FakeModelCall = { operation: 'proposeMove', instructions, prompt }
      calls.push(call)
      const written = read('proposals', script.proposals ?? [])
      if (written instanceof Error) throw written
      return schema.parse(JSON.parse(written) as unknown).proposal
    },

    async proposeWithTools<Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>, { tools, maxSteps }: ToolLoop): Promise<ToolLoopResult<Proposal>> {
      const call: FakeModelCall = { operation: 'proposeWithTools', instructions, prompt, steps: 0, maxSteps }
      calls.push(call)
      for (let step = 0; step < maxSteps; step += 1) {
        const next = read('steps', script.steps ?? [])
        call.steps = (call.steps ?? 0) + 1
        if (next instanceof Error) throw next
        if ('proposal' in next) return { proposal: schema.parse(next).proposal, ended: 'proposed' }
        if (next.stop) return { proposal: null, ended: 'stopped' }
        for (const toolCall of next.toolCalls ?? []) {
          const found = tools.find(item => item.name === toolCall.name)
          if (!found) throw new Error(`The scripted language model called an unknown tool, ${toolCall.name}.`)
          const output = await found.run(found.inputSchema.parse(toolCall.input))
          toolResults.push({ name: toolCall.name, input: toolCall.input, output })
        }
      }
      // The cap is reached with no tool call answered: the same no move the real loop returns.
      return { proposal: null, ended: 'step_cap' }
    },

    async reply(instructions, prompt) {
      calls.push({ operation: 'reply', instructions, prompt })
      const written = read('replies', script.replies ?? [])
      if (written instanceof Error) throw written
      return written
    },

    async* streamReply(instructions, prompt) {
      calls.push({ operation: 'streamReply', instructions, prompt })
      const written = read('replies', script.replies ?? [])
      if (written instanceof Error) throw written
      yield written
    },
  }
}
