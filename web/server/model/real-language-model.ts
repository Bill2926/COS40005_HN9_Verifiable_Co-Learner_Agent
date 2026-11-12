import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAgentLanguageModel } from './agent-language-model'
import type { LanguageModel } from './language-model'

// supportsStructuredOutputs is false on purpose. When it is true the adapter
// sends response_format: { type: 'json_schema' }, which DeepSeek refuses with a
// 400, so every turn fails. When it is false the adapter asks for plain JSON
// (response_format: { type: 'json_object' }) and drops the schema, so the shape
// of a proposal is spelled out in the instructions instead. See
// agent-language-model.ts.
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
  return createAgentLanguageModel(provider(options.model))
}
