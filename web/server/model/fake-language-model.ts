import type { LanguageModel, ModelExchange, TeacherContext } from './language-model'
import type { Move } from './moves'

export interface FakeModelScript {
  proposal: Move | null
  text?: string
  fail?: 'propose' | 'render'
}

export function createFakeLanguageModel(script: FakeModelScript): LanguageModel & { exchanges: ModelExchange[] } {
  const exchanges: ModelExchange[] = []

  return {
    exchanges,
    async propose(context) {
      exchanges.push({ phase: 'propose', context: structuredClone(context), move: script.proposal })
      if (script.fail === 'propose') throw new Error('The language model failed.')
      return script.proposal
    },
    async *render(context, move) {
      exchanges.push({ phase: 'render', context: structuredClone(context), move })
      if (script.fail === 'render') throw new Error('The language model failed.')
      for (const delta of spokenChunks(script.text ?? '')) yield delta
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
