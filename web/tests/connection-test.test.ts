import { afterEach, describe, expect, it, vi } from 'vitest'
import { testConnection } from '../server/language-model'

// The administrator's two questions, asked with the settings on the form and answered with what the
// provider really did. The provider is stubbed here, so the messages are the ones DeepSeek and any
// other OpenAI-compatible server send back.

const apiKey = 'sk-super-secret-a1b2'
const settings = { provider: 'real', apiKey, baseUrl: 'https://api.deepseek.com', modelName: 'deepseek-chat' }

// A provider that answers each call from a list: a string is the words the model wrote, `{ toolCall }`
// is a call of the proposal tool, and a Response is sent as it is.
function scripted(replies: (string | { toolCall: string } | Response | Error)[]): { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = []
  let calls = 0
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    bodies.push(await request.json() as Record<string, unknown>)
    const reply = replies[calls++]
    if (reply === undefined) throw new Error('No scripted reply left.')
    if (reply instanceof Error) throw reply
    if (reply instanceof Response) return reply
    if (typeof reply === 'string') return json(reply)
    return json(null, reply.toolCall)
  })
  return { bodies }
}

function json(content: string | null, toolCall?: string): Response {
  return Response.json({
    id: 'chatcmpl-test',
    choices: [{
      message: {
        role: 'assistant',
        content,
        ...(toolCall === undefined ? {} : { tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'propose', arguments: toolCall } }] }),
      },
      finish_reason: toolCall === undefined ? 'stop' : 'tool_calls',
    }],
  })
}

// A fresh Response each time, since a body can only be read once.
const refusedKey = () => Response.json({ error: { message: `Invalid API key ${apiKey}` } }, { status: 401 })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('testing the connection', () => {
  it('reports both answers with how long each took', async () => {
    const provider = scripted(['Counted in a loop.', { toolCall: '{"proposal": "checked"}' }])

    const report = await testConnection(settings)

    expect(report.reply.ok).toBe(true)
    expect(report.reply.ms).toBeGreaterThanOrEqual(0)
    expect(report.toolCall.ok).toBe(true)
    expect(report.toolCall.ms).toBeGreaterThanOrEqual(0)
    expect(provider.bodies).toHaveLength(2)
  })

  it('asks the second question even when the first is refused, and says what the provider said', async () => {
    scripted([refusedKey(), refusedKey()])

    const report = await testConnection(settings)

    expect(report.reply).toEqual({ ok: false, ms: report.reply.ms, error: 'Invalid API key …' })
    expect(report.toolCall.ok).toBe(false)
  })

  it('reports a model that answers in words instead of calling the tool', async () => {
    scripted(['Counted in a loop.', 'I would explain the loop.'])

    const report = await testConnection(settings)

    expect(report.reply.ok).toBe(true)
    expect(report.toolCall.error).toContain('tool call')
  })

  it('keeps the API key out of every answer, even one the provider repeats', async () => {
    scripted([refusedKey(), refusedKey()])

    const report = await testConnection({ ...settings, apiKey })

    expect(JSON.stringify(report)).not.toContain(apiKey)
    expect(report.reply.error).toContain('Invalid API key')
  })

  it('refuses to test the fake provider, which makes no calls', async () => {
    await expect(testConnection({ provider: 'fake', apiKey: '', baseUrl: '', modelName: '' }))
      .rejects.toThrow('fake')
  })

  it('names the setting a real provider is missing', async () => {
    await expect(testConnection({ provider: 'real', apiKey: 'sk-a', baseUrl: '', modelName: 'deepseek-chat' }))
      .rejects.toThrow('base URL')
  })
})
