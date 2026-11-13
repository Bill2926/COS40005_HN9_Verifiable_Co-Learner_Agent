import { afterEach, expect, it, vi } from 'vitest'
import { createRealLanguageModel } from '../server/language-model'

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

  await model().proposeMove('Propose one move.', 'The student is stuck on a loop.')

  expect(sent).toHaveLength(1)
  expect(sent[0]!.responseFormat).toEqual({ type: 'json_object' })
})

it('states the proposal schema in the instructions, since the request cannot carry it', async () => {
  const sent = captureProposeRequest()

  await model().proposeMove('Propose one move.', 'The student is stuck on a loop.')

  const system = sent[0]!.messages.filter(message => message.role === 'system').map(message => message.content).join('\n')
  expect(system).toContain('"explain_concept"')
  expect(system).toContain('"hint_level_N"')
  expect(system).toContain('proposal')
})
