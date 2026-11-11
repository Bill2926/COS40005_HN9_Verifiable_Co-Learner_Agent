import { describe, expect, it } from 'vitest'
import { courseScope } from '../server/content/course'
import { roleTable } from '../server/content/role-table'
import { decide, type CourseScope, type TurnSnapshot } from '../server/verdict/decide'

const course: CourseScope = {
  modules: [
    { id: 'strings', number: 3, name: 'Working with Strings', available: true, keywords: ['working with strings', 'strings'] },
    { id: 'loops', number: 5, name: 'Loops', available: true, keywords: ['loops'] },
    { id: 'lists_and_tuples', number: 6, name: 'Lists and Tuples', available: false, keywords: ['lists and tuples', 'lists', 'tuples'] },
  ],
  outOfCourseKeywords: ['pandas', 'classes', 'linked lists'],
}

function snapshot(overrides: Partial<TurnSnapshot> = {}): TurnSnapshot {
  return {
    moduleId: 'for_loop',
    exerciseId: 'sum_of_a_list',
    currentModuleId: 'loops',
    masteries: [
      { moduleId: 'strings', mastery: 0.95 },
      { moduleId: 'loops', mastery: 0.4 },
      { moduleId: 'lists_and_tuples', mastery: 0 },
    ],
    unlockedModuleIds: ['loops'],
    studentMessage: 'How does a for loop work?',
    verifyShieldOn: true,
    ...overrides,
  }
}

describe('decide', () => {
  it('allows a teaching move scoped to an open module', () => {
    expect(decide(
      [{
        agent: 'teacher',
        move: { type: 'explain_concept', scope: 'loops' },
      }],
      snapshot(),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: { type: 'explain_concept', scope: 'loops' },
    }])
  })

  it('allows a teaching move scoped to a mastered module', () => {
    expect(decide(
      [{
        agent: 'teacher',
        move: { type: 'answer_question', scope: 'strings' },
      }],
      snapshot({
        unlockedModuleIds: ['strings', 'loops'],
        studentMessage: 'How do I slice a string?',
      }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: { type: 'answer_question', scope: 'strings' },
    }])
  })

  it('downgrades a teaching move scoped to a closed module', () => {
    expect(decide(
      [{
        agent: 'teacher',
        move: { type: 'explain_concept', scope: 'lists_and_tuples' },
      }],
      snapshot({ studentMessage: 'What are lists?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_requires_unlocked_module',
      reasonCode: 'MODULE_CLOSED',
      move: { type: 'redirect_to_module', scope: 'lists_and_tuples' },
    }])
  })

  it('downgrades a teaching move scoped out of course', () => {
    expect(decide(
      [{
        agent: 'teacher',
        move: { type: 'explain_concept', scope: 'out_of_course' },
      }],
      snapshot({ studentMessage: 'hey how are you' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_in_course',
      reasonCode: 'OUT_OF_COURSE',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }])
  })

  it('downgrades a move labelled in scope when the message names an out-of-course module', () => {
    expect(decide(
      [{
        agent: 'teacher',
        move: { type: 'explain_concept', scope: 'loops' },
      }],
      snapshot({ studentMessage: 'Can you show me Pandas?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_keyword',
      reasonCode: 'OUT_OF_COURSE_KEYWORD',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }])
  })

  it('downgrades a move labelled in scope when the message names a closed module', () => {
    expect(decide(
      [{
        agent: 'teacher',
        move: { type: 'hint_level_N', level: 1, scope: 'loops' },
      }],
      snapshot({ studentMessage: 'What are lists?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_keyword',
      reasonCode: 'MODULE_CLOSED_KEYWORD',
      move: { type: 'redirect_to_module', scope: 'lists_and_tuples' },
    }])
  })

  it('allows every proposal when the VerifyShield is off', () => {
    const off = snapshot({
      verifyShieldOn: false,
      studentMessage: 'What are lists?',
    })
    expect(decide(
      [
        { agent: 'teacher', move: { type: 'explain_concept', scope: 'lists_and_tuples' } },
        { agent: 'deskmate', move: { type: 'hint_level_N', level: 2 } },
      ],
      off,
      roleTable,
      course,
    )).toEqual([
      {
        agent: 'teacher',
        decision: 'allow',
        ruleId: 'verify_shield',
        reasonCode: 'VERIFYSHELD_OFF',
        move: { type: 'explain_concept', scope: 'lists_and_tuples' },
      },
      {
        agent: 'deskmate',
        decision: 'allow',
        ruleId: 'verify_shield',
        reasonCode: 'VERIFYSHELD_OFF',
        move: { type: 'hint_level_N', level: 2 },
      },
    ])
  })

  it('gives the same verdict each time for the same proposal and snapshot', () => {
    const proposals = [{
      agent: 'teacher' as const,
      move: { type: 'explain_concept' as const, scope: 'lists_and_tuples' },
    }]
    const frozen = snapshot({ studentMessage: 'What are lists?' })
    const expected = [{
      agent: 'teacher' as const,
      decision: 'downgrade' as const,
      ruleId: 'scope_requires_unlocked_module',
      reasonCode: 'MODULE_CLOSED',
      move: { type: 'redirect_to_module' as const, scope: 'lists_and_tuples' },
    }]

    expect(decide(proposals, frozen, roleTable, course)).toEqual(expected)
    expect(decide(proposals, frozen, roleTable, course)).toEqual(expected)
  })

  it('leaves the deskmate alone when the message names a closed module', () => {
    expect(decide(
      [
        { agent: 'teacher', move: { type: 'explain_concept', scope: 'lists_and_tuples' } },
        { agent: 'deskmate', move: { type: 'peer_question' } },
      ],
      snapshot({ studentMessage: 'What are lists?' }),
      roleTable,
      course,
    )).toEqual([
      {
        agent: 'teacher',
        decision: 'downgrade',
        ruleId: 'scope_requires_unlocked_module',
        reasonCode: 'MODULE_CLOSED',
        move: { type: 'redirect_to_module', scope: 'lists_and_tuples' },
      },
      {
        agent: 'deskmate',
        decision: 'allow',
        ruleId: 'role_table',
        reasonCode: 'ROLE_PERMITTED',
        move: { type: 'peer_question' },
      },
    ])
  })

  it('downgrades a revealed answer when the message names an out-of-course module', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'reveal_answer' } }],
      snapshot({ studentMessage: 'Can you show me Pandas?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_keyword',
      reasonCode: 'OUT_OF_COURSE_KEYWORD',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }])
  })

  it('matches a closed module by its name and not by a word inside a loops question', () => {
    const onLoops = snapshot({
      currentModuleId: 'loops',
      unlockedModuleIds: ['getting_started', 'variables', 'strings', 'conditionals', 'loops'],
    })
    expect(decide(
      [{ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } }],
      { ...onLoops, studentMessage: 'The loop sets the total back to zero for this list.' },
      roleTable,
      courseScope,
    )[0]).toMatchObject({ decision: 'allow', reasonCode: 'ROLE_PERMITTED' })

    expect(decide(
      [{ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } }],
      { ...onLoops, studentMessage: 'Can we talk about Lists and Tuples?' },
      roleTable,
      courseScope,
    )[0]).toMatchObject({
      decision: 'downgrade',
      ruleId: 'scope_keyword',
      reasonCode: 'MODULE_CLOSED_KEYWORD',
      move: { type: 'redirect_to_module', scope: 'lists_and_tuples' },
    })
  })

  it('allows a loops question that mentions a list', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } }],
      snapshot({ studentMessage: 'Why is my list total zero?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: { type: 'explain_concept', scope: 'loops' },
    }])
  })

  it('downgrades an advance aimed at a module that is not unlocked', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'advance_to_item', moduleId: 'lists_and_tuples' } }],
      snapshot({ studentMessage: 'Can we start lists?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_requires_unlocked_module',
      reasonCode: 'MODULE_CLOSED',
      move: { type: 'redirect_to_module', scope: 'lists_and_tuples' },
    }])
  })
})
