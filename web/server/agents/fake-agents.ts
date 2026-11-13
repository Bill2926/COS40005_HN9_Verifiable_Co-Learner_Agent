// A scripted Teacher and Deskmate, for tests and for the `fake` provider. It stands in for the agents
// themselves, so it never sees a prompt: it records the context and the move of each call instead.
import type { Agents, AgentExchange } from './agents'
import type { DeskmateContext, TeacherContext } from './contexts'
import type { Move } from './moves'

export interface FakeAgentScript<Context = TeacherContext> {
  // A fixed proposal, or one read from the context, as a real agent reads the roadmap for its scope.
  proposal: Move | null | ((context: Context) => Move | null)
  text?: string
  fail?: 'propose' | 'render'
}

export function createFakeAgents(
  script: FakeAgentScript<TeacherContext>,
  deskmateScript: FakeAgentScript<DeskmateContext> = { proposal: null },
): Agents & { exchanges: AgentExchange[] } {
  const exchanges: AgentExchange[] = []

  return {
    exchanges,
    teacher: {
      async propose(context) {
        const move = proposalFor(script, context)
        exchanges.push({
          agent: 'teacher',
          phase: 'propose',
          context: structuredClone(context),
          move,
        })
        if (script.fail === 'propose') throw new Error('The language model failed.')
        return move
      },
      async *render(context, move) {
        exchanges.push({
          agent: 'teacher',
          phase: 'render',
          context: structuredClone(context),
          move,
        })
        if (script.fail === 'render') throw new Error('The language model failed.')
        for (const delta of spokenChunks(script.text ?? '')) yield delta
      },
    },
    deskmate: {
      async propose(context) {
        const move = proposalFor(deskmateScript, context)
        exchanges.push({
          agent: 'deskmate',
          phase: 'propose',
          context: structuredClone(context),
          move,
        })
        if (deskmateScript.fail === 'propose') throw new Error('The language model failed.')
        return move
      },
      async *render(context, move) {
        exchanges.push({
          agent: 'deskmate',
          phase: 'render',
          context: structuredClone(context),
          move,
        })
        if (deskmateScript.fail === 'render') throw new Error('The language model failed.')
        for (const delta of spokenChunks(deskmateScript.text ?? '')) yield delta
      },
    },
  }
}

function proposalFor<Context>(script: FakeAgentScript<Context>, context: Context): Move | null {
  return typeof script.proposal === 'function' ? script.proposal(context) : script.proposal
}

function spokenChunks(text: string): string[] {
  const parts = text.split(/(\s+)/)
  const chunks: string[] = []
  for (let index = 0; index < parts.length; index += 2) {
    const chunk = `${parts[index] ?? ''}${parts[index + 1] ?? ''}`
    if (chunk.length > 0) chunks.push(chunk)
  }
  return chunks
}
