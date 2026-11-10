import { createDeepSeek } from '@ai-sdk/deepseek'
import { createAgentLanguageModel } from './agent-language-model'
import type { LanguageModel } from './language-model'

export function createDeepSeekLanguageModel(options: {
  apiKey: string
  model: string
}): LanguageModel {
  const deepseek = createDeepSeek({ apiKey: options.apiKey })
  return createAgentLanguageModel(deepseek(options.model))
}
