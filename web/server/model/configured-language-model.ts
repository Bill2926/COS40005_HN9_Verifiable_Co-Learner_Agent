import { createDeepSeekLanguageModel } from './deepseek-language-model'
import { createFakeLanguageModel } from './fake-language-model'
import type { LanguageModel } from './language-model'

export interface ModelConfiguration {
  mode: string
  provider: string
  model: string
  apiKey: string
}

export function createConfiguredLanguageModel(config: ModelConfiguration): LanguageModel {
  if (config.mode === 'fake') {
    return createFakeLanguageModel({
      proposal: { type: 'explain_concept' },
      text: 'A running total has to be created before the loop, so each pass can add to the same number.',
    }, {
      proposal: { type: 'peer_question' },
      text: 'wait, does the total live outside the loop? i\'m lost too.',
    })
  }

  if (config.provider === 'deepseek') {
    return createDeepSeekLanguageModel({
      apiKey: config.apiKey,
      model: config.model,
    })
  }

  throw new Error(`The language model provider "${config.provider}" is not configured.`)
}
