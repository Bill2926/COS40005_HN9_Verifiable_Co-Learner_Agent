import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from './language-model'
import { createProviderLanguageModel } from './provider-language-model'

// supportsStructuredOutputs must stay false. Verified against
// @ai-sdk/openai-compatible 3.0.85: set true, the adapter sends the proposal
// schema as response_format: { type: 'json_schema' }, and DeepSeek answers
// 400 "This response_format type is unavailable now", so every turn fails.
// False sends response_format: { type: 'json_object' }, which DeepSeek
// accepts. The adapter then drops the schema and Output.object does not put it
// in the prompt, so createProviderLanguageModel states the shape in the propose
// instructions itself.
export function createRealLanguageModel(options: {
  apiKey: string
  baseUrl: string
  model: string
}): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
    supportsStructuredOutputs: false,
  })
  return createProviderLanguageModel(provider(options.model))
}
