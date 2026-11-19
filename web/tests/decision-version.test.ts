import { expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { currentCodeVersion } from '../server/code-version'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryDecisionLogStore } from '../server/storage/decision-log'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-1111-4111-8111-111111111111'
const codeVersion = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

it('records the code version and the course history entry in force on each decision', async () => {
  const decisions = createMemoryDecisionLogStore()
  await handleTurn({
    sessionStudentId: student,
    body: { event: 'message', text: 'What is a program?' },
  }, createMemoryConversationStore({
    [student]: 'An',
  }), createFakeAgents({
    proposal: { type: 'explain_concept', scope: 'getting_started' },
    text: 'A program is a list of steps.',
  }), {
    decisions,
    codeVersion,
    courseHistoryId: 12,
  })

  const logged = await decisions.list()
  expect(logged.length).toBeGreaterThan(0)
  expect(logged.every(decision => decision.codeVersion === codeVersion && decision.courseHistoryId === 12)).toBe(true)
})

it('reads the running commit from CODE_VERSION', () => {
  const previous = process.env.CODE_VERSION
  process.env.CODE_VERSION = codeVersion
  try {
    expect(currentCodeVersion()).toBe(codeVersion)
  }
  finally {
    if (previous === undefined) delete process.env.CODE_VERSION
    else process.env.CODE_VERSION = previous
  }
})
