import { describe, expect, it } from 'vitest'
import { createConfiguredAgents, type TeacherContext } from '../server/agents'

const scripted = createConfiguredAgents({ provider: 'fake', apiKey: '', baseUrl: '', modelName: '' })

function context(plan: Partial<NonNullable<TeacherContext['plan']>> | null): TeacherContext {
  return {
    moduleId: 'getting_started',
    exercises: [
      { id: 'say_hello', title: 'Say hello' },
      { id: 'join_words', title: 'Join two words' },
    ],
    roadmap: [{ id: 'getting_started', number: 1, name: 'Getting started', part: 'One', state: 'open', current: true }],
    plan: plan && {
      revision: 1,
      agreed: true,
      steps: [{ kind: 'exercise', ref: 'say_hello', title: 'Say hello', done: false, current: true }],
      triggers: [],
      approachAwaitingTry: false,
      ...plan,
    },
  } as unknown as TeacherContext
}

describe('the scripted Teacher and a plan that keeps failing', () => {
  it('revises the plan to another exercise once failed submissions are a trigger', async () => {
    const move = await scripted.teacher.propose(context({ triggers: ['failed_submissions'] }))

    expect(move).toEqual({ type: 'revise_plan', steps: [{ kind: 'exercise', ref: 'join_words' }] })
  })

  it('keeps explaining when nothing triggers a revision, and while the plan is not agreed', async () => {
    const expected = { type: 'explain_concept', scope: 'getting_started' }

    expect(await scripted.teacher.propose(context({}))).toEqual(expected)
    expect(await scripted.teacher.propose(context({ agreed: false, triggers: ['failed_submissions'] }))).toEqual(expected)
    expect(await scripted.teacher.propose(context(null))).toEqual(expected)
  })
})
