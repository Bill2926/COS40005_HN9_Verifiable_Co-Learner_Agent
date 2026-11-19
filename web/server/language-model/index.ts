// The language-model component's interface: a model that proposes a move, as JSON in the text or as a
// tool call, and replies in words or as a stream, given instructions and a prompt. It does not know
// who is asking or which moves exist; the agents component writes both and passes the proposal schema.
// `createRealLanguageModel` is the OpenAI-compatible client, `createFakeLanguageModel` the scripted
// answer to the same interface, `resolveModelChoice` reads the saved settings, and `testConnection`
// asks a provider the two questions the administrator can check by hand.
// The provider calls stay behind this file.
export type { LanguageModel, ModelTool, ProposalSchema, ToolLoop, ToolLoopEnd, ToolLoopResult } from './language-model'
export { resolveModelChoice } from './model-choice'
export type { ModelChoice, ModelSettings } from './model-choice'
export { createRealLanguageModel } from './real-language-model'
export { createFakeLanguageModel } from './fake-language-model'
export type { FakeLanguageModelScript, FakeModelCall, FakeModelStep, FakeToolCall, FakeToolResult } from './fake-language-model'
export { testConnection, UnusableSettingsError } from './connection-test'
export type { ConnectionCheck, ConnectionReport } from './connection-test'
