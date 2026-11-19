import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createAgents, proposalSchema } from '../server/agents'
import { createRealLanguageModel } from '../server/language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { handleTurn } from '../server/turn/handle-turn'

// DeepSeek answers response_format: { type: 'json_schema' } with
// 400 "This response_format type is unavailable now", and every turn then
// reaches the student as "could not answer". These two tests pin the shape
// that works: json_object on the wire, and the schema written into the
// instructions, because the adapter drops it from the request.

interface SentRequest {
  responseFormat: { type?: string } | undefined
  messages: { role?: string, content?: string }[]
}

function captureProposeRequest(): SentRequest[] {
  const sent: SentRequest[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const body = await request.json() as { response_format?: { type?: string }, messages?: { role?: string, content?: string }[] }
    sent.push({ responseFormat: body.response_format, messages: body.messages ?? [] })
    return Response.json({
      id: 'chatcmpl-test',
      choices: [{
        message: { role: 'assistant', content: JSON.stringify({ proposal: { type: 'explain_concept', scope: 'getting_started' } }) },
        finish_reason: 'stop',
      }],
    })
  })
  return sent
}

function model() {
  return createRealLanguageModel({
    apiKey: 'sk-test',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('asks for a plain JSON object, never a json_schema the provider rejects', async () => {
  const sent = captureProposeRequest()

  await model().proposeMove('Propose one move.', 'The student is stuck on a loop.', proposalSchema)

  expect(sent).toHaveLength(1)
  expect(sent[0]!.responseFormat).toEqual({ type: 'json_object' })
})

it('states the proposal schema in the instructions, since the request cannot carry it', async () => {
  const sent = captureProposeRequest()

  await model().proposeMove('Propose one move.', 'The student is stuck on a loop.', proposalSchema)

  const system = sent[0]!.messages.filter(message => message.role === 'system').map(message => message.content).join('\n')
  expect(system).toContain('"explain_concept"')
  expect(system).toContain('"hint_level_N"')
  expect(system).toContain('proposal')
})

// A provider that answers each propose call with the next scripted reply: a string is the message
// content the model wrote, a Response is sent as is, and an Error makes the request itself fail.
function scriptedProvider(replies: (string | Response | Error)[]): { calls: () => number } {
  let calls = 0
  vi.stubGlobal('fetch', async () => {
    const reply = replies[calls++]
    if (reply === undefined) throw new Error('No scripted reply left.')
    if (reply instanceof Error) throw reply
    if (reply instanceof Response) return reply
    return Response.json({
      id: 'chatcmpl-test',
      choices: [{ message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
    })
  })
  return { calls: () => calls }
}

const validProposal = JSON.stringify({ proposal: { type: 'explain_concept', scope: 'getting_started' } })

it('asks again once when the proposal is malformed, and uses the second reply', async () => {
  const provider = scriptedProvider(['not json at all', validProposal])

  const proposal = await model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)

  expect(proposal).toEqual({ type: 'explain_concept', scope: 'getting_started' })
  expect(provider.calls()).toBe(2)
})

it('asks again once when the proposal parses but breaks the schema', async () => {
  const provider = scriptedProvider([JSON.stringify({ proposal: { type: 'write_the_solution' } }), validProposal])

  const proposal = await model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)

  expect(proposal).toEqual({ type: 'explain_concept', scope: 'getting_started' })
  expect(provider.calls()).toBe(2)
})

it('asks again once when the model stops before writing any proposal', async () => {
  const provider = scriptedProvider([
    Response.json({
      id: 'chatcmpl-test',
      choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'length' }],
    }),
    validProposal,
  ])

  const proposal = await model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)

  expect(proposal).toEqual({ type: 'explain_concept', scope: 'getting_started' })
  expect(provider.calls()).toBe(2)
})

it('gives up after two malformed proposals in a row', async () => {
  const provider = scriptedProvider(['not json at all', '{"proposal": {"type": 42}}', validProposal])

  await expect(model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)).rejects.toThrow()
  expect(provider.calls()).toBe(2)
})

it('does not retry a network error', async () => {
  const provider = scriptedProvider([new TypeError('fetch failed'), validProposal])

  await expect(model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)).rejects.toThrow()
  expect(provider.calls()).toBe(1)
})

it('does not retry a provider error', async () => {
  const provider = scriptedProvider([
    Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }),
    validProposal,
  ])

  await expect(model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)).rejects.toThrow()
  expect(provider.calls()).toBe(1)
})

it('does not retry a server error either', async () => {
  const provider = scriptedProvider([
    Response.json({ error: { message: 'Overloaded' } }, { status: 503 }),
    validProposal,
  ])

  await expect(model().proposeMove('Propose one move.', 'The student is stuck.', proposalSchema)).rejects.toThrow()
  expect(provider.calls()).toBe(1)
})

// A connection check and, later, the Teacher's own tools need the proposal to come back as a tool
// call rather than as JSON written in the text. The provider answers with tool_calls and carries no
// response_format at all: the schema travels in the tool definition.
interface ToolRequest {
  toolChoice: unknown
  responseFormat: unknown
  tools: { function: { name: string, parameters?: unknown } }[]
}

// A provider that answers each call with the next scripted assistant message and keeps every request.
function scriptedToolProvider(messages: unknown[]): { requests: () => ToolRequest[] } {
  const requests: ToolRequest[] = []
  let calls = 0
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const body = await request.json() as { tool_choice?: unknown, response_format?: unknown, tools?: ToolRequest['tools'] }
    requests.push({ toolChoice: body.tool_choice, responseFormat: body.response_format, tools: body.tools ?? [] })
    const message = messages[calls++]
    if (message === undefined) throw new Error('No scripted reply left.')
    if (message instanceof Response) return message
    const isToolCall = typeof message === 'object' && message !== null && 'tool_calls' in message
    return Response.json({
      id: 'chatcmpl-test',
      choices: [{ message, finish_reason: isToolCall ? 'tool_calls' : 'stop' }],
    })
  })
  return { requests: () => requests }
}

// The arguments of the tool call the provider would answer with.
const callProposing = (proposal: string) => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'propose', arguments: proposal } }],
})

describe('a plain reply, asked for without streaming', () => {
  it('answers with the words the model wrote', async () => {
    const provider = scriptedProvider(['Start with the quotes.'])

    await expect(model().reply('Say one sentence.', 'The student is stuck.'))
      .resolves.toBe('Start with the quotes.')
    expect(provider.calls()).toBe(1)
  })

  // The streaming call hides a failed request behind one generic message, which is fine for a student
  // and useless for the administrator. This one reaches the caller with what the provider said.
  it('carries the provider message when the key is refused', async () => {
    scriptedProvider([Response.json({ error: { message: 'Invalid API key' } }, { status: 401 })])

    await expect(model().reply('Say one sentence.', 'The student is stuck.'))
      .rejects.toThrow('Invalid API key')
  })
})

describe('a proposal asked for as a tool call', () => {
  it('sends the proposal schema as a tool the model must call', async () => {
    const provider = scriptedToolProvider([callProposing(validProposal)])

    const result = await model().proposeWithTools('Propose one move.', 'The student is stuck on a loop.', proposalSchema, { tools: [], maxSteps: 3 })

    expect(result).toEqual({ proposal: { type: 'explain_concept', scope: 'getting_started' }, ended: 'proposed' })
    const sent = provider.requests()[0]!
    expect(sent.toolChoice).toBe('required')
    expect(sent.tools.map(tool => tool.function.name)).toEqual(['propose'])
    expect(JSON.stringify(sent.tools[0]!.function.parameters)).toContain('"explain_concept"')
    expect(sent.responseFormat).toBeUndefined()
  })

  it('stops as soon as the tool has answered, so one call is enough', async () => {
    const provider = scriptedToolProvider([callProposing(validProposal)])

    await model().proposeWithTools('Propose one move.', 'The student is stuck on a loop.', proposalSchema, { tools: [], maxSteps: 3 })

    expect(provider.requests()).toHaveLength(1)
  })

  it('answers no move when the tool call carries none', async () => {
    const provider = scriptedToolProvider([callProposing('{"proposal": null}')])

    await expect(model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 })).resolves.toEqual({ proposal: null, ended: 'proposed' })
    expect(provider.requests()).toHaveLength(1)
  })

  it('runs the caller\'s own tools between steps and hands their results back to the model', async () => {
    const provider = scriptedToolProvider([
      { role: 'assistant', content: null, tool_calls: [{ id: 'call-0', type: 'function', function: { name: 'look_up', arguments: '{}' } }] },
      callProposing(validProposal),
    ])
    const run = vi.fn(async () => ({ masteryThreshold: 0.95 }))

    const result = await model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, {
      tools: [{ name: 'look_up', description: 'Looks something up.', inputSchema: z.object({}), run }],
      maxSteps: 3,
    })

    expect(result).toEqual({ proposal: { type: 'explain_concept', scope: 'getting_started' }, ended: 'proposed' })
    expect(run).toHaveBeenCalledOnce()
    expect(provider.requests()).toHaveLength(2)
    expect(provider.requests()[0]!.tools.map(tool => tool.function.name)).toEqual(['look_up', 'propose'])
  })

  it('answers no move, and says so, when the step cap is reached', async () => {
    const lookUp = { role: 'assistant', content: null, tool_calls: [{ id: 'call-0', type: 'function', function: { name: 'look_up', arguments: '{}' } }] }
    scriptedToolProvider([lookUp, lookUp])

    await expect(model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, {
      tools: [{ name: 'look_up', description: 'Looks something up.', inputSchema: z.object({}), run: async () => ({}) }],
      maxSteps: 2,
    })).resolves.toEqual({ proposal: null, ended: 'step_cap' })
  })

  it('gives up when the model answers with words instead of calling the tool', async () => {
    scriptedToolProvider([{ role: 'assistant', content: 'I would explain the loop.' }])


    await expect(model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 })).rejects.toThrow()
  })
})

// DeepSeek in thinking mode answers tool_choice: 'required' with 400 "Thinking mode does not support
// this tool_choice". It still calls tools when left to choose, so the proposal is asked for again with
// tool_choice: 'auto' and an instruction to answer through the tool.
describe('a provider that will not be made to call a tool', () => {
  const refusesToolChoice = () => Response.json(
    { error: { message: 'Thinking mode does not support this tool_choice', type: 'invalid_request_error' } },
    { status: 400 },
  )

  it('asks again, letting the model choose, and uses the tool call it makes', async () => {
    const provider = scriptedToolProvider([refusesToolChoice(), callProposing(validProposal)])

    const result = await model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 })

    expect(result).toEqual({ proposal: { type: 'explain_concept', scope: 'getting_started' }, ended: 'proposed' })
    expect(provider.requests().map(request => request.toolChoice)).toEqual(['required', 'auto'])
  })

  it('tells the model to answer through the tool once it is free to choose', async () => {
    const bodies: { messages: { role: string, content: string }[] }[] = []
    const replies = [refusesToolChoice(), Response.json({
      id: 'chatcmpl-test',
      choices: [{ message: callProposing(validProposal), finish_reason: 'tool_calls' }],
    })]
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      bodies.push(await request.json() as typeof bodies[number])
      return replies.shift()!
    })

    await model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 })

    const system = (index: number) => bodies[index]!.messages.filter(message => message.role === 'system').map(message => message.content).join('\n')
    expect(system(0)).not.toContain('propose tool')
    expect(system(1)).toContain('propose tool')
  })

  it('lets the model choose from then on, so later proposals cost one call', async () => {
    const provider = scriptedToolProvider([refusesToolChoice(), callProposing(validProposal), callProposing(validProposal)])
    const languageModel = model()

    await languageModel.proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 })
    await languageModel.proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 })

    expect(provider.requests().map(request => request.toolChoice)).toEqual(['required', 'auto', 'auto'])
  })

  it('answers no move when the model, free to choose, writes words instead', async () => {
    scriptedToolProvider([refusesToolChoice(), { role: 'assistant', content: 'I would explain the loop.' }])

    await expect(model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 }))
      .resolves.toEqual({ proposal: null, ended: 'stopped' })
  })

  it('does not ask again for any other refused request', async () => {
    const provider = scriptedToolProvider([
      Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }),
      callProposing(validProposal),
    ])

    await expect(model().proposeWithTools('Propose one move.', 'The student is stuck.', proposalSchema, { tools: [], maxSteps: 3 }))
      .rejects.toThrow('Invalid API key')
    expect(provider.requests()).toHaveLength(1)
  })
})

describe('what the student sees', () => {
  const student = '6f1b0c1e-1111-4111-8111-111111111111'

  // A provider where the Teacher's tool calls follow the script, Mai stays quiet, and every reply
  // streams the same words. The Teacher proposes by tool call, so each entry is the tool's arguments.
  function teacherProvider(teacherProposals: string[]): { teacherCalls: () => number } {
    let teacherCalls = 0
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { stream?: boolean, messages: { role: string, content: string }[] }
      if (body.stream) {
        const chunks = [
          { id: 'chatcmpl-test', choices: [{ delta: { role: 'assistant', content: 'Start with the quotes.' }, finish_reason: null }] },
          { id: 'chatcmpl-test', choices: [{ delta: {}, finish_reason: 'stop' }] },
        ]
        const sse = `${chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`
        return new Response(sse, { headers: { 'content-type': 'text/event-stream' } })
      }
      const isTeacher = body.messages.some(message => message.role === 'system' && message.content.includes('You are the Teacher'))
      if (!isTeacher) {
        return Response.json({
          id: 'chatcmpl-test',
          choices: [{ message: { role: 'assistant', content: JSON.stringify({ proposal: null }) }, finish_reason: 'stop' }],
        })
      }
      const proposal = teacherProposals[teacherCalls++]
      if (proposal === undefined) throw new Error('No scripted Teacher proposal left.')
      return Response.json({ id: 'chatcmpl-test', choices: [{ message: callProposing(proposal), finish_reason: 'tool_calls' }] })
    })
    return { teacherCalls: () => teacherCalls }
  }

  async function askTheTeacher() {
    const state = await handleTurn({
      sessionStudentId: student,
      body: { event: 'message', text: 'How do I start?' },
    }, createMemoryConversationStore({ [student]: 'An' }), createAgents(model()))
    return state.conversation.filter(message => message.author === 'teacher').map(message => message.text)
  }

  it('gets a normal reply when the Teacher proposes by tool call', async () => {
    const provider = teacherProvider([validProposal])

    expect(await askTheTeacher()).toEqual(['Start with the quotes.'])
    expect(provider.teacherCalls()).toBe(1)
  })

  it('gets the fallback message when the Teacher\'s tool call breaks the schema', async () => {
    const provider = teacherProvider(['{"proposal": {"type": "write_the_solution"}}', validProposal])

    expect(await askTheTeacher()).toEqual(['The Teacher could not answer just now. Please try again.'])
    expect(provider.teacherCalls()).toBe(1)
  })
})
