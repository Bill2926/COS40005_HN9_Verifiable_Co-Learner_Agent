// The composer's `@` menu: one addressed agent per message, chosen only at
// its start. An `@` anywhere else is plain text.
import { agentNames, type AddressedAgent } from '#shared/turn'

export type { AddressedAgent }

export interface AddressOption {
  agent: AddressedAgent
  name: string
}

const options: readonly AddressOption[] = (['teacher', 'deskmate'] as const)
  .map(agent => ({ agent, name: agentNames[agent] }))

export function addresseeName(agent: AddressedAgent): string {
  return agentNames[agent]
}

// The agents the menu offers for the message typed so far: none unless it is
// an `@` and the start of one name. Mai is left out while she is switched off.
export function addressMenu(text: string, deskmateOn: boolean): AddressOption[] {
  const match = /^@(\S*)$/.exec(text)
  if (!match) return []
  const query = match[1]!.toLowerCase()
  return options.filter(option =>
    (deskmateOn || option.agent !== 'deskmate')
    && option.name.toLowerCase().startsWith(query),
  )
}

// Choosing an agent replaces the typed tag with a chip, so the text keeps none of it.
export function chooseAddressee(text: string, agent: AddressedAgent): { addressedAgent: AddressedAgent, text: string } {
  return { addressedAgent: agent, text: text.replace(/^@\S*\s*/, '') }
}
