// The language-model component's interface: a model that proposes a move and streams a reply, given
// instructions and a prompt. It does not know who is asking; the agents component writes both.
// `createRealLanguageModel` is the OpenAI-compatible client, `resolveModelChoice` reads the saved
// settings. The provider calls stay behind this file.
export type { LanguageModel } from './language-model'
export { resolveModelChoice } from './model-choice'
export type { ModelChoice, ModelSettings } from './model-choice'
export { createRealLanguageModel } from './real-language-model'
