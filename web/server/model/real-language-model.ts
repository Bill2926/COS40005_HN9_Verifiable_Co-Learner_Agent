import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAgentLanguageModel } from './agent-language-model'
import type { LanguageModel } from './language-model'

// supportsStructuredOutputs must be set explicitly. Verified against
// @ai-sdk/openai-compatible: the flag defaults to false, and only when it is
// true does the adapter send the proposal schema as
// response_format: { type: 'json_schema' }. Left false, the schema is dropped
// and every turn dies in Output.object validation.
export function createRealLanguageModel(options: {
  apiKey: string
  baseUrl: string
  model: string
}): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
    supportsStructuredOutputs: true,
  })
  return createAgentLanguageModel(provider(options.model))
}
