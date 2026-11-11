import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleAdmin } from '../server/admin/handle-admin'
import { productOwnerAccount } from '../server/auth/demo-accounts'
import { languageModelForTurn } from '../server/model/configured-language-model'
import type { ModelSettings } from '../server/model/model-choice'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryModelSettingsStore } from '../server/storage/model-settings-store'
import { handleTurn } from '../server/turn/handle-turn'

const owner = productOwnerAccount.email
const adminEmails = 'assistant@example.com, owner@example.com'
const signedInStudent = '6f1b0c1e-1111-4111-8111-111111111111'
const savedKey = 'sk-super-secret-a1b2'
const envKey = 'sk-environment-key-zz99'
const fakeSentence = 'A running total has to be created before the loop, so each pass can add to the same number.'
const realSentence = 'Counted by the saved model.'

const realEnv: ModelSettings = {
  provider: 'real',
  apiKey: envKey,
  baseUrl: 'https://env.example',
  modelName: 'env-model',
}

const fakeEnv: ModelSettings = {
  provider: 'fake',
  apiKey: '',
  baseUrl: '',
  modelName: '',
}

function ownerRequest(overrides: {
  email?: string | null
  env?: ModelSettings
  store?: ReturnType<typeof createMemoryModelSettingsStore>
  body?: unknown
} = {}) {
  return {
    email: 'email' in overrides ? overrides.email! : owner,
    adminEmails,
    env: overrides.env ?? realEnv,
    store: overrides.store ?? createMemoryModelSettingsStore(),
    body: overrides.body ?? { event: 'read' },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin handler', () => {
  it('refuses a student and leaves the saved settings untouched', async () => {
    const store = createMemoryModelSettingsStore()

    await expect(handleAdmin(ownerRequest({
      email: 'an@example.com',
      store,
      body: { event: 'save', provider: 'fake' },
    }))).rejects.toMatchObject({ statusCode: 403 })

    expect(await store.read()).toBeNull()
  })

  it('refuses a request with no session', async () => {
    await expect(handleAdmin(ownerRequest({ email: null })))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('uses the saved fake provider on the next turn without a restart', async () => {
    const store = createMemoryModelSettingsStore()
    const saved = await handleAdmin(ownerRequest({
      env: realEnv,
      store,
      body: { event: 'save', provider: 'fake' },
    }))

    expect(saved.model).toEqual({
      provider: 'fake',
      apiKeyMask: 'sk-…zz99',
      baseUrl: 'https://env.example',
      modelName: 'env-model',
      saved: true,
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await languageModelForTurn(store, realEnv))

    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe(fakeSentence)
  })

  it('uses the saved real provider on the next turn', async () => {
    const store = createMemoryModelSettingsStore()
    const calls: { url: string, authorization: string, model: string }[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { model?: string, stream?: boolean, messages?: { content?: string }[] }
      calls.push({
        url: request.url,
        authorization: request.headers.get('authorization') ?? '',
        model: body.model ?? '',
      })
      const instructions = JSON.stringify(body.messages ?? [])
      if (body.stream) return sse(realSentence)
      const proposal = instructions.includes('You are Mai') ? null : { type: 'explain_concept', scope: 'loops' }
      return Response.json({
        id: 'chatcmpl-test',
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({ proposal }),
          },
          finish_reason: 'stop',
        }],
      })
    })

    await handleAdmin(ownerRequest({
      env: fakeEnv,
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-chat',
      },
    }))

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await languageModelForTurn(store, fakeEnv))

    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every(call => call.url === 'https://api.deepseek.com/chat/completions')).toBe(true)
    expect(calls.every(call => call.authorization === `Bearer ${savedKey}`)).toBe(true)
    expect(calls.every(call => call.model === 'deepseek-chat')).toBe(true)
    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe(realSentence)
    expect(JSON.stringify(state)).not.toContain(savedKey)
  })

  it('returns the API key only as a mask', async () => {
    const store = createMemoryModelSettingsStore()
    const saved = await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-chat',
      },
    }))
    const again = await handleAdmin(ownerRequest({ store, body: { event: 'read' } }))

    expect(saved.model.apiKeyMask).toBe('sk-…a1b2')
    expect(again.model.apiKeyMask).toBe('sk-…a1b2')
    expect(JSON.stringify(saved)).not.toContain(savedKey)
    expect(JSON.stringify(again)).not.toContain(savedKey)

    const shortKey = 'secret1'
    const short = await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: shortKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-chat',
      },
    }))
    expect(short.model.apiKeyMask).toBe('…')
    expect(JSON.stringify(short)).not.toContain(shortKey)
  })

  it('keeps the saved API key when a later save leaves the key blank', async () => {
    const store = createMemoryModelSettingsStore()
    await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: 'deepseek-flash',
      },
    }))
    const calls: { authorization: string, model: string }[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { model?: string, stream?: boolean, messages?: unknown }
      calls.push({
        authorization: request.headers.get('authorization') ?? '',
        model: body.model ?? '',
      })
      const instructions = JSON.stringify(body.messages ?? [])
      if (body.stream) return sse(realSentence)
      const proposal = instructions.includes('You are Mai') ? null : { type: 'explain_concept', scope: 'loops' }
      return Response.json({
        choices: [{
          message: { role: 'assistant', content: JSON.stringify({ proposal }) },
          finish_reason: 'stop',
        }],
      })
    })

    const updated = await handleAdmin(ownerRequest({
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: '   ',
        baseUrl: 'https://api.deepseek.com/',
        modelName: 'deepseek-chat',
      },
    }))

    await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await languageModelForTurn(store, fakeEnv))

    expect(updated.model.apiKeyMask).toBe('sk-…a1b2')
    expect(JSON.stringify(updated)).not.toContain(savedKey)
    expect(calls.every(call => call.authorization === `Bearer ${savedKey}`)).toBe(true)
    expect(calls.every(call => call.model === 'deepseek-chat')).toBe(true)
  })

  it('refuses to save a real model with a blank model name', async () => {
    const store = createMemoryModelSettingsStore()

    await expect(handleAdmin(ownerRequest({
      env: fakeEnv,
      store,
      body: {
        event: 'save',
        provider: 'real',
        apiKey: savedKey,
        baseUrl: 'https://api.deepseek.com',
        modelName: ' ',
      },
    }))).rejects.toMatchObject({ statusCode: 400 })

    expect(await store.read()).toBeNull()
  })

  it('falls back to the environment when nothing has been saved', async () => {
    const store = createMemoryModelSettingsStore()
    const viewed = await handleAdmin(ownerRequest({
      env: realEnv,
      store,
      body: { event: 'read' },
    }))

    expect(viewed.model).toEqual({
      provider: 'real',
      apiKeyMask: 'sk-…zz99',
      baseUrl: 'https://env.example',
      modelName: 'env-model',
      saved: false,
    })
    expect(JSON.stringify(viewed)).not.toContain(envKey)

    const calls: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const body = await request.json() as { stream?: boolean, messages?: unknown }
      calls.push(request.url)
      const instructions = JSON.stringify(body.messages ?? [])
      if (body.stream) return sse('From the environment.')
      const proposal = instructions.includes('You are Mai') ? null : { type: 'explain_concept', scope: 'loops' }
      return Response.json({
        choices: [{
          message: { role: 'assistant', content: JSON.stringify({ proposal }) },
          finish_reason: 'stop',
        }],
      })
    })

    const state = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'Where does the total live?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await languageModelForTurn(store, realEnv))

    expect(calls.every(url => url === 'https://env.example/chat/completions')).toBe(true)
    expect(state.conversation.find(message => message.author === 'teacher')?.text).toBe('From the environment.')

    const scripted = await handleTurn({
      sessionStudentId: signedInStudent,
      body: { event: 'message', text: 'And the empty case?' },
    }, createMemoryConversationStore({
      [signedInStudent]: 'An',
    }), await languageModelForTurn(store, fakeEnv))

    expect(scripted.conversation.find(message => message.author === 'teacher')?.text).toBe(fakeSentence)
  })
})

function sse(text: string): Response {
  const chunks = [
    { choices: [{ delta: { content: text }, finish_reason: null }] },
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
  ]
  const payload = chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n'
  return new Response(payload, {
    headers: { 'content-type': 'text/event-stream' },
  })
}
