import { z } from 'zod'
import { createRealLanguageModel } from './real-language-model'
import { resolveModelChoice, type ModelChoice, type ModelSettings } from './model-choice'
import type { ProposalSchema } from './language-model'

// One of the two answers, with how long the provider took. `error` is what the provider said, with the
// API key taken out of it: the page shows this to the administrator, and the key never leaves the server.
export interface ConnectionCheck {
  ok: boolean
  ms: number
  error?: string
}

export interface ConnectionReport {
  reply: ConnectionCheck
  toolCall: ConnectionCheck
}

// The settings do not describe a call that can be made: the provider is the fake one, or a field a
// real model needs is blank. A provider that refuses is different: that is an answer in the report,
// not a fault here.
export class UnusableSettingsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnusableSettingsError'
  }
}

// The shape the tool-call question is asked in. It has the same one required field as a proposal, so
// the provider is exercised the way the Teacher will exercise it, but it names no move: this
// component does not know which moves exist, and a connection check must not depend on them.
const probeSchema: ProposalSchema<'checked' | 'none'> = z.object({ proposal: z.enum(['checked', 'none']).nullable() })

const probePrompt = 'This is a connection check, not a lesson.'

// The two questions the administrator can ask of a provider by hand: will it answer in words, and will
// it answer a forced tool call. Each is timed and each is reported on its own, because a model can do
// one and not the other. Nothing is saved here and nothing is retried.
export async function testConnection(settings: ModelSettings): Promise<ConnectionReport> {
  const choice = realChoice(settings)
  const model = createRealLanguageModel({ apiKey: choice.apiKey, baseUrl: choice.baseUrl, model: choice.model })

  return {
    reply: await check(async () => (await model.reply('Answer with one short sentence and nothing else.', probePrompt)).trim() !== '', choice.apiKey),
    // One step is all a tool call needs, so a model that will not call one fails here rather than
    // spending a cap's worth of calls on the administrator's bill.
    toolCall: await check(async () => {
      await model.proposeWithTools(
        'Call the tool, with the proposal set to "checked". Do not answer in words.',
        probePrompt,
        probeSchema,
        { tools: [], maxSteps: 1 },
      )
      return true
    }, choice.apiKey),
  }
}

// A fake provider has nothing to reach, and a real one needs every field: both are answered before a
// call is made, so the administrator is told what to fix instead of watching two timeouts.
function realChoice(settings: ModelSettings): Extract<ModelChoice, { kind: 'real' }> {
  let choice
  try {
    choice = resolveModelChoice(settings)
  }
  catch (error) {
    throw new UnusableSettingsError(error instanceof Error ? error.message : 'The model settings are not usable.')
  }
  if (choice.kind === 'fake') throw new UnusableSettingsError('The fake provider makes no calls, so there is nothing to test.')
  return choice
}

async function check(ask: () => Promise<boolean>, apiKey: string): Promise<ConnectionCheck> {
  const startedAt = Date.now()
  try {
    if (!await ask()) return { ok: false, ms: elapsedSince(startedAt), error: 'The provider answered with nothing.' }
    return { ok: true, ms: elapsedSince(startedAt) }
  }
  catch (error) {
    const message = error instanceof Error && error.message.trim() !== '' ? error.message : 'The provider did not answer.'
    return { ok: false, ms: elapsedSince(startedAt), error: redactKey(message, apiKey) }
  }
}

function elapsedSince(startedAt: number): number {
  return Date.now() - startedAt
}

// A provider that quotes the key in its complaint would otherwise carry it to the page and into any
// log line the caller writes.
function redactKey(message: string, apiKey: string): string {
  return apiKey === '' ? message : message.split(apiKey).join('…')
}
