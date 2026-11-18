import { describe, expect, it } from 'vitest'
import { proposalSchema } from '../server/agents'
import { createFakeLanguageModel } from '../server/language-model'

// The model underneath the agents, scripted rather than called. The scripted agents stand in for the
// Teacher and Mai themselves; this stands in for the language model, so a tool-call conversation and
// its step cap can be rehearsed with no provider and no key.

const instructions = 'Propose one move.'
const prompt = 'The student is stuck on a loop.'
const move = { type: 'explain_concept', scope: 'loops' }

describe('the fake language model asked for a tool call', () => {
  it('answers with the move the script carries', async () => {
    const model = createFakeLanguageModel({ steps: [{ proposal: move }] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 3 })).resolves.toEqual({ proposal: move, ended: 'proposed' })
    expect(model.calls).toEqual([{ operation: 'proposeWithTools', instructions, prompt, steps: 1, maxSteps: 3 }])
  })

  it('answers no move, ended by the step cap, once the cap is reached', async () => {
    const model = createFakeLanguageModel({ steps: [{}, {}, { proposal: move }] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 2 })).resolves.toEqual({ proposal: null, ended: 'step_cap' })
    expect(model.calls).toEqual([{ operation: 'proposeWithTools', instructions, prompt, steps: 2, maxSteps: 2 }])
  })

  it('answers no move when the tool call carries none', async () => {
    const model = createFakeLanguageModel({ steps: [{ proposal: null }] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 3 })).resolves.toEqual({ proposal: null, ended: 'proposed' })
    expect(model.calls).toEqual([{ operation: 'proposeWithTools', instructions, prompt, steps: 1, maxSteps: 3 }])
  })

  it('answers no move, ended early rather than by the cap, when the model stops before it', async () => {
    const model = createFakeLanguageModel({ steps: [{}, { stop: true }] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 3 })).resolves.toEqual({ proposal: null, ended: 'stopped' })
    expect(model.calls).toEqual([{ operation: 'proposeWithTools', instructions, prompt, steps: 2, maxSteps: 3 }])
  })

  it('refuses a tool call that breaks the proposal schema', async () => {
    const model = createFakeLanguageModel({ steps: [{ proposal: { type: 'write_the_solution' } }] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 3 })).rejects.toThrow()
    expect(model.calls).toEqual([{ operation: 'proposeWithTools', instructions, prompt, steps: 1, maxSteps: 3 }])
  })

  it('fails when the script says the call fails', async () => {
    const model = createFakeLanguageModel({ steps: [new Error('Invalid API key')] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 3 })).rejects.toThrow('Invalid API key')
  })

  it('refuses a further call once the script has no step left to spend', async () => {
    const model = createFakeLanguageModel({ steps: [{ proposal: move }] })

    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 2 })).resolves.toEqual({ proposal: move, ended: 'proposed' })
    await expect(model.proposeWithTools(instructions, prompt, proposalSchema, { tools: [], maxSteps: 2 })).rejects.toThrow('no step left')
  })
})

describe('the fake language model asked for words', () => {
  it('answers a proposal with the JSON the script wrote', async () => {
    const model = createFakeLanguageModel({ proposals: ['{"proposal": {"type": "answer_question", "scope": "loops"}}'] })

    await expect(model.proposeMove(instructions, prompt, proposalSchema)).resolves.toEqual({ type: 'answer_question', scope: 'loops' })
    expect(model.calls).toEqual([{ operation: 'proposeMove', instructions, prompt }])
  })

  it('answers a reply with the words the script wrote, whole and as a stream', async () => {
    const model = createFakeLanguageModel({ replies: ['Start with the quotes.', 'Then print it.'] })

    await expect(model.reply(instructions, prompt)).resolves.toBe('Start with the quotes.')
    const streamed: string[] = []
    for await (const part of model.streamReply(instructions, prompt)) streamed.push(part)
    expect(streamed.join('')).toBe('Then print it.')
    expect(model.calls.map(call => call.operation)).toEqual(['reply', 'streamReply'])
  })

  it('fails a reply when the script says the call fails', async () => {
    const model = createFakeLanguageModel({ replies: [new Error('Invalid API key')] })

    await expect(model.reply(instructions, prompt)).rejects.toThrow('Invalid API key')
  })
})
