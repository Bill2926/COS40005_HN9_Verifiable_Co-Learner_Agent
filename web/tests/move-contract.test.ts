import { describe, expect, it } from 'vitest'
import { createAgents, proposalSchema, roleTable } from '../server/agents'
import type { LanguageModel } from '../server/language-model'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-1111-4111-8111-111111111111'

function parses(proposal: unknown): boolean {
  return proposalSchema.safeParse({ proposal }).success
}

// A language model that replies with fixed JSON per agent and holds it to the schema it is given,
// as the real one does.
function replyingModel(replies: { teacher: unknown, deskmate: unknown }): LanguageModel & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async proposeMove(instructions, _prompt, schema) {
      calls.push(instructions)
      const reply = instructions.includes('You are the Teacher') ? replies.teacher : replies.deskmate
      return schema.parse({ proposal: reply }).proposal
    },
    async proposeWithTools(instructions, prompt, schema) {
      return { proposal: await this.proposeMove(instructions, prompt, schema), ended: 'proposed' }
    },
    async* streamReply() {
      yield 'A reply.'
    },
  }
}

describe('the move contract', () => {
  it.each(['explain_concept', 'answer_question'])('requires a scope on %s', (type) => {
    expect(parses({ type })).toBe(false)
    expect(parses({ type, scope: 'loops' })).toBe(true)
  })

  it('requires a scope on hint_level_N and address_misconception', () => {
    expect(parses({ type: 'hint_level_N', level: 1 })).toBe(false)
    expect(parses({ type: 'address_misconception', misconceptionId: 'reset_in_loop' })).toBe(false)
    expect(parses({ type: 'address_misconception', misconceptionId: 'reset_in_loop', scope: 'loops' })).toBe(true)
  })

  it.each([0, 4, 1.5])('rejects a hint level of %s', (level) => {
    expect(parses({ type: 'hint_level_N', level, scope: 'loops' })).toBe(false)
  })

  it.each([1, 2, 3])('accepts a hint level of %s', (level) => {
    expect(parses({ type: 'hint_level_N', level, scope: 'loops' })).toBe(true)
  })

  it('cannot carry reveal_answer or the VerifyShield\'s own redirect', () => {
    expect(parses({ type: 'reveal_answer' })).toBe(false)
    expect(parses({ type: 'redirect_to_module', scope: 'loops' })).toBe(false)
    expect(roleTable.teacher).not.toContain('reveal_answer')
  })

  it('parses a Deskmate teacher move, so the VerifyShield blocks and logs it', async () => {
    const decisions = createMemoryDecisionLogStore()
    const model = replyingModel({
      teacher: null,
      deskmate: { type: 'hint_level_N', level: 2, scope: 'getting_started' },
    })

    await handleTurn({
      sessionStudentId: student,
      body: { event: 'message', text: 'Just tell me the next step.' },
    }, createMemoryConversationStore({ [student]: 'An' }), createAgents(model), { decisions })

    expect(await decisions.list()).toContainEqual(expect.objectContaining({
      agent: 'deskmate',
      proposedMove: 'hint_level_2',
      verdict: 'block',
      reasonCode: 'ROLE_FORBIDDEN',
    }))
  })

  it('lists in each agent\'s propose instructions only the moves its role table gives it', async () => {
    const model = replyingModel({ teacher: null, deskmate: null })
    await handleTurn({
      sessionStudentId: student,
      body: { event: 'message', text: 'How does a for loop work?' },
    }, createMemoryConversationStore({ [student]: 'An' }), createAgents(model))

    const teacher = model.calls.find(call => call.includes('You are the Teacher'))
    const deskmate = model.calls.find(call => call.includes('Deskmate'))
    const allowed = (instructions: string | undefined) => instructions?.match(/You may propose (?:only )?([^.]*)\./)?.[1]
      ?.split(/,? or |, /)

    expect(allowed(teacher)).toEqual([...roleTable.teacher])
    expect(allowed(deskmate)).toEqual([...roleTable.deskmate])
    expect(teacher).not.toContain('reveal_answer')
  })
})
