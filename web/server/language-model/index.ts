// The language-model component's interface: a model that proposes a move and streams a reply, given
// instructions and a prompt. It does not know who is asking or which moves exist; the agents component
// writes both and passes the proposal schema.
// `createRealLanguageModel` is the OpenAI-compatible client, `resolveModelChoice` reads the saved
// settings. The provider calls stay behind this file.
export type { LanguageModel, ProposalSchema } from './language-model'
export { resolveModelChoice } from './model-choice'
export type { ModelChoice, ModelSettings } from './model-choice'
export { createRealLanguageModel } from './real-language-model'
