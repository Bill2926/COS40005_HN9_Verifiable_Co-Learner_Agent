import { createRealLanguageModel, resolveModelChoice, type ModelSettings } from '../language-model'
import type { ModelSettingsStore } from '../storage/model-settings-store'
import type { Agents } from './agents'
import { createAgents } from './create-agents'
import { createFakeAgents } from './fake-agents'

// The model is built once per request, so an unconditional line would repeat on
// every turn. Only a change of choice is news worth printing.
let lastLogged = ''

function logOnce(line: string): void {
  if (line === lastLogged) return
  lastLogged = line
  console.info(line)
}

export function createConfiguredAgents(settings: ModelSettings): Agents {
  const choice = resolveModelChoice(settings)

  if (choice.kind === 'real') {
    // The key is never logged and never named in an error.
    logOnce(`Language model: real, ${choice.baseUrl}, model ${choice.model}.`)
    return createAgents(createRealLanguageModel({
      apiKey: choice.apiKey,
      baseUrl: choice.baseUrl,
      model: choice.model,
    }))
  }

  logOnce('Language model: fake, scripted Teacher and Deskmate replies.')
  return createFakeAgents({
    proposal: { type: 'explain_concept' },
    text: 'A running total has to be created before the loop, so each pass can add to the same number.',
  }, {
    proposal: { type: 'peer_question' },
    text: 'wait, does the total live outside the loop? i\'m lost too.',
  })
}

// A saved record replaces the environment for this turn. An empty store leaves
// the environment in charge, so a server that has never been saved keeps working.
export async function agentsForTurn(
  store: ModelSettingsStore,
  env: ModelSettings,
): Promise<Agents> {
  const saved = await store.read()
  return createConfiguredAgents(saved ?? env)
}
