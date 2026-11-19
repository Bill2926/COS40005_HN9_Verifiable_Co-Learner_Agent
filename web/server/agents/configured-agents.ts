import { createRealLanguageModel, modelAddressLocked, resolveModelChoice, type ModelSettings } from '../language-model'
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

export function createConfiguredAgents(settings: ModelSettings, options?: { production?: boolean }): Agents {
  const choice = resolveModelChoice(settings, { production: options?.production ?? false })

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
    // Scoped to the current module, as the real Teacher scopes a question about it.
    proposal: (context) => {
      // A plan that keeps failing is revised onto an exercise it does not hold yet, so a rehearsal
      // can walk the revision. Only an agreed plan with that trigger is revised; the VerifyShield
      // still rules the move.
      if (context.plan?.agreed && context.plan.triggers.includes('failed_submissions')) {
        const held = new Set(context.plan.steps.map(step => step.ref))
        const next = context.exercises.find(exercise => !held.has(exercise.id))
        if (next) return { type: 'revise_plan', steps: [{ kind: 'exercise', ref: next.id }] }
      }
      return {
        type: 'explain_concept',
        scope: context.roadmap.find(module => module.current)?.id ?? 'out_of_course',
      }
    },
    // The module's materials, then its first exercise, as a real plan would.
    plan: context => ({
      type: 'propose_plan',
      steps: [
        { kind: 'materials', ref: '' },
        ...(context.exercises[0] ? [{ kind: 'exercise' as const, ref: context.exercises[0].id }] : []),
      ],
    }),
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
  options?: { production?: boolean },
): Promise<Agents> {
  const saved = await store.read()
  return createConfiguredAgents(saved ?? env, { production: modelAddressLocked(options?.production) })
}
