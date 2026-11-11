export interface ModelSettings {
  provider: string
  apiKey: string
  baseUrl: string
  modelName: string
}

export type ModelChoice =
  | { kind: 'fake' }
  | { kind: 'real', apiKey: string, baseUrl: string, model: string }

const providers = ['real', 'fake'] as const

// The provider is named outright. A blank name means the real
// OpenAI-compatible client, which is how DeepSeek is reached. Nothing here
// reads the environment or the network.
export function resolveModelChoice(settings: ModelSettings): ModelChoice {
  const provider = settings.provider.trim().toLowerCase() || 'real'

  if (provider === 'fake') return { kind: 'fake' }

  if (provider === 'real') {
    return {
      kind: 'real',
      apiKey: required(settings.apiKey, 'API key'),
      baseUrl: baseUrl(required(settings.baseUrl, 'base URL')),
      model: required(settings.modelName, 'model name'),
    }
  }

  throw new Error(`The model provider is "${provider}": name one of ${providers.join(', ')}.`)
}

// A real model cannot be called without these, and a value carrying stray
// whitespace would travel to the provider and come back as a 404. Fail at the
// moment of resolution, naming the field to fix.
function required(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed === '') throw new Error(`The ${field} is blank, and a real model needs it.`)
  return trimmed
}

// The client appends /chat/completions itself, so the base URL is the root the
// provider documents. DeepSeek's is https://api.deepseek.com. A trailing slash
// would make that path miss.
function baseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}
