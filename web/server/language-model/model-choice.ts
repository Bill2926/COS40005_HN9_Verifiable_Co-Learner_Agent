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

// The only address a production server may call. A saved record that names
// another host would send students' prompts there.
export const approvedModelAddress = 'https://api.deepseek.com'

// Production locks the address unless a caller says otherwise. Tests pass the
// flag outright, so the process environment does not decide them.
export function modelAddressLocked(override?: boolean): boolean {
  return override ?? process.env.NODE_ENV === 'production'
}

// The provider is named outright. A blank name means the real
// OpenAI-compatible client, which is how DeepSeek is reached.
// resolveModelChoice reads neither the environment nor the network. The caller
// says whether this is production. In production the real address has to be
// the approved one; development may name another host.
export function resolveModelChoice(settings: ModelSettings, options?: { production?: boolean }): ModelChoice {
  const provider = settings.provider.trim().toLowerCase() || 'real'

  if (provider === 'fake') return { kind: 'fake' }

  if (provider === 'real') {
    const address = baseUrl(required(settings.baseUrl, 'base URL'))
    if (options?.production && address !== approvedModelAddress) {
      throw new Error(`The model address must be ${approvedModelAddress}.`)
    }
    return {
      kind: 'real',
      apiKey: required(settings.apiKey, 'API key'),
      baseUrl: address,
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
