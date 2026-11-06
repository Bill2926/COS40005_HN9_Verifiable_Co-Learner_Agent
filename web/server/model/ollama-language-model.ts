import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAgentLanguageModel } from './agent-language-model'
import type { LanguageModel } from './language-model'

// Ollama serves an OpenAI-compatible endpoint, so the first-party adapter for
// it is the honest way to reach a local model. No key, no network.
//
// supportsStructuredOutputs must be set explicitly. Verified against
// @ai-sdk/openai-compatible@3.0.85 dist/index.js: the flag defaults to false,
// and only when it is true does the adapter send the proposal schema as
// response_format: { type: 'json_schema' }. Left false it sends
// { type: 'json_object' }, the schema is silently dropped, and every turn dies
// in Output.object validation. Ollama's OpenAI-compatible endpoint has
// supported response_format: json_schema since 0.5.
export function createOllamaLanguageModel(options: {
  baseUrl: string
  model: string
}): LanguageModel {
  const ollama = createOpenAICompatible({
    name: 'ollama',
    baseURL: options.baseUrl,
    supportsStructuredOutputs: true,
  })
  return createAgentLanguageModel(ollama(options.model))
}
