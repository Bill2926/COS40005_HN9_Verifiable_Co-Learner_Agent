import { APICallError, generateText, hasToolCall, NoObjectGeneratedError, NoOutputGeneratedError, Output, stepCountIs, streamText, tool, type LanguageModel as ProviderModel } from 'ai'
import { z } from 'zod'
import type { LanguageModel, ProposalSchema, ToolLoop, ToolLoopResult } from './language-model'

// The name of the tool a proposal is asked for as. It says nothing about moves: the tool only ever
// holds the caller's schema, so this component still does not know which proposals exist.
const proposalTool = 'propose'
const answerThroughTool = `Answer only by calling the ${proposalTool} tool, never with words.`

// A request refused because of its tool_choice, rather than its key, model or anything else.
function refusesToolChoice(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 400 && /tool_choice/i.test(error.message)
}

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
  // A provider may refuse to be made to call a tool: DeepSeek in thinking mode answers 'required'
  // with 400 "Thinking mode does not support this tool_choice", though it calls tools when left to
  // choose. Once refused, this model lets its provider choose.
  let toolChoice: 'required' | 'auto' = 'required'
  return {
    async proposeMove<Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>): Promise<Proposal | null> {
      const ask = async () => {
        const { output } = await generateText({
          model,
          output: Output.object({ schema }),
          instructions: `${instructions} ${proposalShape(schema)}`,
          prompt,
          // A network or provider error is not retried: only a reply that does not parse is.
          maxRetries: 0,
        })
        // Reading `output` throws NoOutputGeneratedError when the model wrote nothing to parse.
        return output.proposal
      }
      // A malformed reply is often a one-off, so it is asked for once more. A second one, or any
      // other failure, reaches the caller.
      try {
        return await ask()
      }
      catch (error) {
        if (!NoObjectGeneratedError.isInstance(error) && !NoOutputGeneratedError.isInstance(error)) throw error
        return await ask()
      }
    },

    // The same proposal asked for as a tool call. The provider puts the schema in the tool and the
    // answer in `tool_calls`, which is how a model that can also call its own tools is given a move.
    async proposeWithTools<Proposal>(instructions: string, prompt: string, schema: ProposalSchema<Proposal>, { tools, maxSteps }: ToolLoop): Promise<ToolLoopResult<Proposal>> {
      // The caller's own tools run here, between steps; their results go back to the model.
      const ownTools = Object.fromEntries(tools.map(item => [item.name, tool({
        description: item.description,
        inputSchema: item.inputSchema,
        execute: input => item.run(input),
      })]))
      const ask = (choice: 'required' | 'auto') => generateText({
        model,
        // A model free to choose is told which tool holds its answer.
        instructions: choice === 'auto' ? `${instructions} ${answerThroughTool}` : instructions,
        prompt,
        tools: {
          ...ownTools,
          [proposalTool]: tool({
            description: 'Record the move you propose, or null when you propose none.',
            inputSchema: schema,
          }),
        },
        // A model that answers with words instead of calling the tool is reported, not talked to
        // again: that is the answer the product owner needs to see.
        toolChoice: choice,
        // The loop ends at the tool call, so a proposal costs one call. The cap bounds a model that
        // keeps calling other tools before it answers with this one; no move comes back when it is hit.
        stopWhen: [hasToolCall(proposalTool), stepCountIs(maxSteps)],
        maxRetries: 0,
      })
      let answer
      try {
        answer = await ask(toolChoice)
      }
      catch (error) {
        if (toolChoice !== 'required' || !refusesToolChoice(error)) throw error
        // Remembered, so later proposals from this model are not refused first.
        toolChoice = 'auto'
        answer = await ask(toolChoice)
      }
      const { toolCalls, steps } = answer
      // The provider parses the tool input against the schema it was given, but the answer it hands
      // back is only typed as unknown text, so it is read through the schema here. A tool call that
      // breaks the schema is reported rather than passed on as a move.
      const call = toolCalls.find(toolCall => toolCall.toolName === proposalTool)
      // No move: the cap is reached only when every step was spent; a loop that ended sooner (the
      // provider interrupting the reply) is a different end, and not reported as the cap.
      if (!call) return { proposal: null, ended: steps.length >= maxSteps ? 'step_cap' : 'stopped' }
      return { proposal: schema.parse(call.input).proposal, ended: 'proposed' }
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

    // No retry and no message of its own, so a refused key or an unknown model comes back as the
    // provider said it. `generateText` throws its error before any text is yielded.
    async reply(instructions, prompt) {
      const { text } = await generateText({ model, instructions, prompt, maxRetries: 0 })
      return text
    },
  }
}
