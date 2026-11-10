import { createDeepSeekLanguageModel } from './deepseek-language-model'
import { createFakeLanguageModel } from './fake-language-model'
import type { LanguageModel } from './language-model'
import { resolveModelChoice, type ModelSettings } from './model-choice'
import { createOllamaLanguageModel } from './ollama-language-model'

export type { ModelSettings } from './model-choice'

// The model is built once per request, so an unconditional line would repeat on
// every turn. Only a change of choice is news worth printing.
let lastLogged = ''

function logOnce(line: string): void {
  if (line === lastLogged) return
  lastLogged = line
  console.info(line)
}

export function createConfiguredLanguageModel(settings: ModelSettings): LanguageModel {
  const choice = resolveModelChoice(settings)

  if (choice.kind === 'deepseek') {
    // The key is never logged and never named in an error.
    logOnce(`Language model: deepseek, model ${choice.model}.`)
    return createDeepSeekLanguageModel({ apiKey: choice.apiKey, model: choice.model })
  }

  if (choice.kind === 'ollama') {
    logOnce(`Language model: ollama at ${choice.baseUrl}, model ${choice.model}.`)
    return createOllamaLanguageModel({ baseUrl: choice.baseUrl, model: choice.model })
  }

  logOnce('Language model: fake, scripted Teacher and Deskmate replies.')
  return createFakeLanguageModel({
    proposal: { type: 'explain_concept' },
    text: 'A running total has to be created before the loop, so each pass can add to the same number.',
  }, {
    proposal: { type: 'peer_question' },
    text: 'wait, does the total live outside the loop? i\'m lost too.',
  })
}
