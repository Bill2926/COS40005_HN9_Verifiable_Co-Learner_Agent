import { describe, expect, it } from 'vitest'
import { resolveModelChoice, type ModelSettings } from '../server/language-model'

const configured: ModelSettings = {
  provider: '',
  apiKey: 'sk-not-a-real-key',
  baseUrl: 'https://api.deepseek.com',
  modelName: 'deepseek-flash',
}

function settings(overrides: Partial<ModelSettings>): ModelSettings {
  return { ...configured, ...overrides }
}

describe('language model choice', () => {
  it('chooses a real OpenAI-compatible model when the provider is not named', () => {
    expect(resolveModelChoice(configured)).toEqual({
      kind: 'real',
      apiKey: 'sk-not-a-real-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
    })
  })

  it('chooses a real model when the provider is named outright', () => {
    expect(resolveModelChoice(settings({ provider: 'real' }))).toEqual({
      kind: 'real',
      apiKey: 'sk-not-a-real-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
    })
  })

  it('chooses the fake model when the provider is named', () => {
    expect(resolveModelChoice(settings({ provider: 'fake' }))).toEqual({ kind: 'fake' })
  })

  it('treats a whitespace-only provider as unnamed and chooses a real model', () => {
    expect(resolveModelChoice(settings({ provider: '  \t' }))).toEqual({
      kind: 'real',
      apiKey: 'sk-not-a-real-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
    })
  })

  it('trims surrounding whitespace from the provider name', () => {
    expect(resolveModelChoice(settings({ provider: '  fake ' }))).toEqual({ kind: 'fake' })
  })

  it('needs no credential at all for the fake model', () => {
    expect(resolveModelChoice({
      provider: 'fake',
      apiKey: '',
      baseUrl: '',
      modelName: '',
    })).toEqual({ kind: 'fake' })
  })

  it('refuses an unknown provider and lists the two that exist', () => {
    expect(() => resolveModelChoice(settings({ provider: 'openai' })))
      .toThrow(/The model provider is "openai": name one of real, fake\./)
  })

  it('refuses a blank API key when the provider is real', () => {
    expect(() => resolveModelChoice(settings({ provider: 'real', apiKey: '' })))
      .toThrow(/API key/)
  })

  it('refuses a blank model name when the provider is real', () => {
    expect(() => resolveModelChoice(settings({ provider: 'real', modelName: '   ' })))
      .toThrow(/model name/)
  })

  it('refuses a blank base URL when the provider is real', () => {
    expect(() => resolveModelChoice(settings({ provider: 'real', baseUrl: '\t\n ' })))
      .toThrow(/base URL/)
  })

  it('trims surrounding whitespace from the key, base URL, and model name', () => {
    expect(resolveModelChoice(settings({
      provider: 'real',
      apiKey: '  sk-not-a-real-key\t',
      baseUrl: ' https://api.deepseek.com/ ',
      modelName: '  deepseek-chat\t',
    }))).toEqual({
      kind: 'real',
      apiKey: 'sk-not-a-real-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    })
  })

  it('drops a trailing slash from the base URL and keeps a version path that was written', () => {
    expect(resolveModelChoice(settings({
      provider: 'real',
      baseUrl: 'https://api.deepseek.com/v1/',
    }))).toEqual({
      kind: 'real',
      apiKey: 'sk-not-a-real-key',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-flash',
    })
  })

  it('accepts the approved DeepSeek address in production, including a trailing slash', () => {
    expect(resolveModelChoice(settings({
      provider: 'real',
      baseUrl: 'https://api.deepseek.com/',
    }), { production: true })).toEqual({
      kind: 'real',
      apiKey: 'sk-not-a-real-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash',
    })
  })

  it('refuses a saved model address other than the approved one in production', () => {
    expect(() => resolveModelChoice(settings({
      provider: 'real',
      baseUrl: 'https://example.test',
    }), { production: true })).toThrow(/The model address must be https:\/\/api\.deepseek\.com\./)
    expect(() => resolveModelChoice(settings({
      provider: 'real',
      baseUrl: 'https://api.deepseek.com/v1',
    }), { production: true })).toThrow(/https:\/\/api\.deepseek\.com/)
    expect(() => resolveModelChoice(settings({
      provider: 'real',
      baseUrl: 'http://api.deepseek.com',
    }), { production: true })).toThrow(/https:\/\/api\.deepseek\.com/)
  })

  it('still chooses the fake model in production when no address is called', () => {
    expect(resolveModelChoice({
      provider: 'fake',
      apiKey: '',
      baseUrl: 'https://example.test',
      modelName: '',
    }, { production: true })).toEqual({ kind: 'fake' })
  })
})
