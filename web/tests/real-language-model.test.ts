import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('what the student sees', () => {
  const student = '6f1b0c1e-1111-4111-8111-111111111111'

  // A provider where the Teacher's proposals follow the script, Mai stays quiet, and every reply
  // streams the same words.
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
      const content = isTeacher ? teacherProposals[teacherCalls++] : JSON.stringify({ proposal: null })
      if (content === undefined) throw new Error('No scripted Teacher proposal left.')
      return Response.json({
        id: 'chatcmpl-test',
        choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
      })
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

  it('gets a normal reply when a malformed proposal is followed by a valid one', async () => {
    const provider = teacherProvider(['{"proposal": ', validProposal])

    expect(await askTheTeacher()).toEqual(['Start with the quotes.'])
    expect(provider.teacherCalls()).toBe(2)
  })

  it('gets the fallback message after two malformed proposals in a row', async () => {
    const provider = teacherProvider(['{"proposal": ', '{"proposal": {"type": "write_the_solution"}}', validProposal])

    expect(await askTheTeacher()).toEqual(['The Teacher could not answer just now. Please try again.'])
    expect(provider.teacherCalls()).toBe(2)
  })
})
