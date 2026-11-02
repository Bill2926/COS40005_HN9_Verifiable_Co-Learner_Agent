import type { LanguageModel, ModelExchange } from './language-model'
import type { Move } from './moves'

export interface FakeModelScript {
  proposal: Move | null
  text?: string
  fail?: 'propose' | 'render'
}

export function createFakeLanguageModel(
  script: FakeModelScript,
  deskmateScript: FakeModelScript = { proposal: null },
): LanguageModel & { exchanges: ModelExchange[] } {
  const exchanges: ModelExchange[] = []

  return {
    exchanges,
    teacher: {
      async propose(context) {
        exchanges.push({
          agent: 'teacher',
          phase: 'propose',
          context: structuredClone(context),
          move: script.proposal,
        })
        if (script.fail === 'propose') throw new Error('The language model failed.')
        return script.proposal
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
        exchanges.push({
          agent: 'deskmate',
          phase: 'propose',
          context: structuredClone(context),
          move: deskmateScript.proposal,
        })
        if (deskmateScript.fail === 'propose') throw new Error('The language model failed.')
        return deskmateScript.proposal
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

function spokenChunks(text: string): string[] {
  const parts = text.split(/(\s+)/)
  const chunks: string[] = []
  for (let index = 0; index < parts.length; index += 2) {
    const chunk = `${parts[index] ?? ''}${parts[index + 1] ?? ''}`
    if (chunk.length > 0) chunks.push(chunk)
  }
  return chunks
}
