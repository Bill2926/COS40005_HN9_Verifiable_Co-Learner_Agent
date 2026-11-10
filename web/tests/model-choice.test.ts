import { describe, expect, it } from 'vitest'
import { resolveModelChoice, type ModelSettings } from '../server/model/model-choice'

const configured: ModelSettings = {
  model: '',
  deepseekApiKey: 'sk-not-a-real-key',
  deepseekModel: 'deepseek-flash',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
}

function settings(overrides: Partial<ModelSettings>): ModelSettings {
  return { ...configured, ...overrides }
}

describe('language model choice', () => {
  it('chooses DeepSeek when the provider is not named', () => {
    expect(resolveModelChoice(configured)).toEqual({
      kind: 'deepseek',
      apiKey: 'sk-not-a-real-key',
      model: 'deepseek-flash',
    })
  })

  it('chooses DeepSeek when the provider is named outright', () => {
    expect(resolveModelChoice(settings({ model: 'deepseek' }))).toEqual({
      kind: 'deepseek',
      apiKey: 'sk-not-a-real-key',
      model: 'deepseek-flash',
    })
  })

  it('chooses the fake model when the provider is named', () => {
    expect(resolveModelChoice(settings({ model: 'fake' }))).toEqual({ kind: 'fake' })
  })

  it('chooses Ollama when the provider is named', () => {
    expect(resolveModelChoice(settings({ model: 'ollama' }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })
  })

  it('treats a whitespace-only provider as unnamed and chooses DeepSeek', () => {
    expect(resolveModelChoice(settings({ model: '  \t' }))).toEqual({
      kind: 'deepseek',
      apiKey: 'sk-not-a-real-key',
      model: 'deepseek-flash',
    })
  })

  it('trims surrounding whitespace from the provider name', () => {
    expect(resolveModelChoice(settings({ model: '  ollama ' }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })
  })

  it('ignores the credentials of the provider not chosen', () => {
    expect(resolveModelChoice(settings({
      model: 'ollama',
      deepseekApiKey: '',
      deepseekModel: '',
    }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })

    expect(resolveModelChoice(settings({
      model: 'deepseek',
      ollamaBaseUrl: '',
      ollamaModel: '',
    }))).toEqual({
      kind: 'deepseek',
      apiKey: 'sk-not-a-real-key',
      model: 'deepseek-flash',
    })
  })

  it('needs no credential at all for the fake model', () => {
    expect(resolveModelChoice({
      model: 'fake',
      deepseekApiKey: '',
      deepseekModel: '',
      ollamaBaseUrl: '',
      ollamaModel: '',
    })).toEqual({ kind: 'fake' })
  })

  it('refuses an unknown provider and lists the three that exist', () => {
    expect(() => resolveModelChoice(settings({ model: 'openai' })))
      .toThrow(/NUXT_MODEL is "openai": name one of deepseek, fake, ollama\./)
  })

  it('refuses a missing DeepSeek API key and names the setting', () => {
    expect(() => resolveModelChoice(settings({ model: 'deepseek', deepseekApiKey: '' })))
      .toThrow(/NUXT_DEEPSEEK_API_KEY/)
  })

  it('refuses a blank DeepSeek model name and names the setting', () => {
    expect(() => resolveModelChoice(settings({ model: 'deepseek', deepseekModel: '   ' })))
      .toThrow(/NUXT_DEEPSEEK_MODEL/)
  })

  it('refuses a missing Ollama base URL and names the setting', () => {
    expect(() => resolveModelChoice(settings({ model: 'ollama', ollamaBaseUrl: '\t\n ' })))
      .toThrow(/NUXT_OLLAMA_BASE_URL/)
  })

  it('refuses a blank Ollama model name and names the setting', () => {
    expect(() => resolveModelChoice(settings({ model: 'ollama', ollamaModel: '' })))
      .toThrow(/NUXT_OLLAMA_MODEL/)
  })

  it('trims surrounding whitespace from a model name', () => {
    expect(resolveModelChoice(settings({
      model: 'deepseek',
      deepseekModel: '  deepseek-chat\t',
    }))).toEqual({
      kind: 'deepseek',
      apiKey: 'sk-not-a-real-key',
      model: 'deepseek-chat',
    })

    expect(resolveModelChoice(settings({
      model: 'ollama',
      ollamaModel: 'qwen3:4b ',
    }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen3:4b',
    })
  })

  it('keeps a base URL that already carries the version path', () => {
    expect(resolveModelChoice(settings({
      model: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434/v1',
    }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })
  })

  it('drops a trailing slash from a base URL with the version path', () => {
    expect(resolveModelChoice(settings({
      model: 'ollama',
      ollamaBaseUrl: 'http://localhost:11434/v1/',
    }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })
  })

  it('drops a trailing slash from a bare host and still appends the version path', () => {
    expect(resolveModelChoice(settings({
      model: 'ollama',
      ollamaBaseUrl: 'http://127.0.0.1:11434/  ',
    }))).toEqual({
      kind: 'ollama',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama3.1',
    })
  })
})
