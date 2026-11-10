export interface ModelSettings {
  model: string
  deepseekApiKey: string
  deepseekModel: string
  ollamaBaseUrl: string
  ollamaModel: string
}

export type ModelChoice =
  | { kind: 'fake' }
  | { kind: 'deepseek', apiKey: string, model: string }
  | { kind: 'ollama', baseUrl: string, model: string }

const providers = ['deepseek', 'fake', 'ollama'] as const

// NUXT_MODEL names the provider outright; the settings below it only supply
// that provider's credentials. Nothing here reads the environment, touches the
// network, or pings the Ollama host.
export function resolveModelChoice(settings: ModelSettings): ModelChoice {
  const provider = settings.model.trim() === '' ? 'deepseek' : settings.model.trim()

  if (provider === 'fake') return { kind: 'fake' }

  if (provider === 'deepseek') {
    return {
      kind: 'deepseek',
      apiKey: required(settings.deepseekApiKey, 'NUXT_DEEPSEEK_API_KEY'),
      model: required(settings.deepseekModel, 'NUXT_DEEPSEEK_MODEL'),
    }
  }

  if (provider === 'ollama') {
    return {
      kind: 'ollama',
      baseUrl: ollamaBaseUrl(required(settings.ollamaBaseUrl, 'NUXT_OLLAMA_BASE_URL')),
      model: required(settings.ollamaModel, 'NUXT_OLLAMA_MODEL'),
    }
  }

  throw new Error(`NUXT_MODEL is "${provider}": name one of ${providers.join(', ')}.`)
}

// A credential the chosen provider needs cannot be repaired here, and a model
// name carrying stray whitespace would travel all the way to the provider and
// come back as a 404. Fail at the moment of resolution, naming the setting to
// fix, instead of at the student's first turn.
function required(value: string, setting: string): string {
  const trimmed = value.trim()
  if (trimmed === '') throw new Error(`${setting} is blank, and NUXT_MODEL needs it.`)
  return trimmed
}

// A developer may write the bare host, with or without a trailing slash.
function ollamaBaseUrl(baseUrl: string): string {
  const host = baseUrl.replace(/\/+$/, '')
  return host.endsWith('/v1') ? host : `${host}/v1`
}
