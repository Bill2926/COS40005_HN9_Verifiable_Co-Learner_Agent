import { describe, expect, it } from 'vitest'
import { pythonCourse } from '../server/course'
import { roleTable } from '../server/agents'
import { decide, type CourseScope, type TurnSnapshot } from '../server/verify-shield'

const course: CourseScope = {
  modules: [
    { id: 'strings', keywords: ['working with strings', 'strings'] },
    { id: 'loops', keywords: ['loops'] },
    { id: 'lists_and_tuples', keywords: ['lists and tuples', 'lists', 'tuples'] },
  ],
  outOfCourseKeywords: ['pandas', 'classes', 'linked lists'],
}

function snapshot(overrides: Partial<TurnSnapshot> = {}): TurnSnapshot {
  return {
    moduleId: 'loops',
    exerciseId: 'sum_of_a_list',
    masteries: [
      { moduleId: 'strings', mastery: 0.95 },
      { moduleId: 'loops', mastery: 0.4 },
      { moduleId: 'lists_and_tuples', mastery: 0 },
    ],
    unlockedModuleIds: ['loops'],
    studentMessage: 'How does a for loop work?',
    verifyShieldOn: true,
    highestHintRung: 0,
    misconceptionIds: ['accumulator_reset_inside_loop'],
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
        { agent: 'deskmate', move: { type: 'hint_level_N', level: 2, scope: 'getting_started' } },
      ],
      off,
      roleTable,
      course,
    )).toEqual([
      {
        agent: 'teacher',
        decision: 'allow',
        ruleId: 'verify_shield',
        reasonCode: 'VERIFYSHIELD_OFF',
        move: { type: 'explain_concept', scope: 'lists_and_tuples' },
      },
      {
        agent: 'deskmate',
        decision: 'allow',
        ruleId: 'verify_shield',
        reasonCode: 'VERIFYSHIELD_OFF',
        move: { type: 'hint_level_N', level: 2, scope: 'getting_started' },
      },
    ])
  })

  it.each([
    { placement: 'no module', overrides: { moduleId: '' } },
    { placement: 'no exercise', overrides: { exerciseId: '' } },
  ])('blocks every proposal on a turn with $placement as NO_PLACEMENT', ({ overrides }) => {
    expect(decide(
      [
        { agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } },
        { agent: 'deskmate', move: { type: 'peer_question' } },
      ],
      snapshot(overrides),
      roleTable,
      course,
    )).toEqual([
      {
        agent: 'teacher',
        decision: 'block',
        ruleId: 'turn_placement',
        reasonCode: 'NO_PLACEMENT',
        move: null,
      },
      {
        agent: 'deskmate',
        decision: 'block',
        ruleId: 'turn_placement',
        reasonCode: 'NO_PLACEMENT',
        move: null,
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

  it('downgrades an in-scope answer when the message names an out-of-course module', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'answer_question', scope: 'loops' } }],
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
      unlockedModuleIds: ['getting_started', 'variables', 'strings', 'conditionals', 'loops'],
    })
    expect(decide(
      [{ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } }],
      { ...onLoops, studentMessage: 'The loop sets the total back to zero for this list.' },
      roleTable,
      pythonCourse.scope,
    )[0]).toMatchObject({ decision: 'allow', reasonCode: 'ROLE_PERMITTED' })

    expect(decide(
      [{ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } }],
      { ...onLoops, studentMessage: 'Can we talk about Lists and Tuples?' },
      roleTable,
      pythonCourse.scope,
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

  it('downgrades a rung 3 hint to rung 1 when no hint has been given', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 3, scope: 'loops' } }],
      snapshot({ studentMessage: 'Give me a hint.', highestHintRung: 0 }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'hint_ladder',
      reasonCode: 'HINT_SKIPPED',
      move: { type: 'hint_level_N', level: 1, scope: 'loops' },
    }])
  })

  it('allows rung 2 but downgrades rung 3 to rung 2 after rung 1 is given', () => {
    const afterRung1 = snapshot({ studentMessage: 'Give me a hint.', highestHintRung: 1 })

    expect(decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 2, scope: 'loops' } }],
      afterRung1,
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: { type: 'hint_level_N', level: 2, scope: 'loops' },
    }])

    expect(decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 3, scope: 'loops' } }],
      afterRung1,
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'hint_ladder',
      reasonCode: 'HINT_SKIPPED',
      move: { type: 'hint_level_N', level: 2, scope: 'loops' },
    }])
  })

  it('allows rung 1 repeated after rung 2 has been given', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 1, scope: 'loops' } }],
      snapshot({ studentMessage: 'Give me a hint.', highestHintRung: 2 }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move: { type: 'hint_level_N', level: 1, scope: 'loops' },
    }])
  })

  it('allows a skipped rung when the VerifyShield is off', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 3, scope: 'loops' } }],
      snapshot({ studentMessage: 'Give me a hint.', highestHintRung: 0, verifyShieldOn: false }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'verify_shield',
      reasonCode: 'VERIFYSHIELD_OFF',
      move: { type: 'hint_level_N', level: 3, scope: 'loops' },
    }])
  })

  it('downgrades an advance aimed at a module that is not unlocked', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'advance_to_module', moduleId: 'lists_and_tuples' } }],
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

  it('blocks an advance aimed at a module the course does not have', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'advance_to_module', moduleId: 'nested_loops' } }],
      snapshot({ studentMessage: 'What is next?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'block',
      ruleId: 'advance_known_module',
      reasonCode: 'ADVANCE_UNKNOWN_MODULE',
      move: null,
    }])
  })

  it('turns an advance aimed at the current module into a suggestion to keep practising', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'advance_to_module', moduleId: 'loops' } }],
      snapshot({ studentMessage: 'Should I move on?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'advance_not_current_module',
      reasonCode: 'ADVANCE_TO_CURRENT',
      move: { type: 'stay_and_practise' },
    }])
  })

  it('allows an advance aimed at another open module', () => {
    const move = { type: 'advance_to_module' as const, moduleId: 'strings' }
    expect(decide(
      [{ agent: 'teacher', move }],
      snapshot({ unlockedModuleIds: ['strings', 'loops'], studentMessage: 'Should I revisit strings?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move,
    }])
  })

  it('redirects a teaching move whose scope is not a module of the course', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'explain_concept', scope: 'recursion' } }],
      snapshot({ studentMessage: 'How does recursion work?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_in_course',
      reasonCode: 'SCOPE_UNKNOWN',
      move: { type: 'redirect_to_module', scope: 'out_of_course' },
    }])
  })

  // Rule order: a closed module of the course is MODULE_CLOSED, not SCOPE_UNKNOWN,
  // and the keyword backstop still wins over both.
  it('keeps a closed course module apart from an invented scope', () => {
    const invented = decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 1, scope: 'generators' } }],
      snapshot({ studentMessage: 'Give me a hint.' }),
      roleTable,
      course,
    )[0]
    const closed = decide(
      [{ agent: 'teacher', move: { type: 'hint_level_N', level: 1, scope: 'lists_and_tuples' } }],
      snapshot({ studentMessage: 'Give me a hint.' }),
      roleTable,
      course,
    )[0]

    expect(invented).toMatchObject({ reasonCode: 'SCOPE_UNKNOWN', move: { type: 'redirect_to_module', scope: 'out_of_course' } })
    expect(closed).toMatchObject({ reasonCode: 'MODULE_CLOSED', move: { type: 'redirect_to_module', scope: 'lists_and_tuples' } })
  })

  it('allows an invented scope and an unknown advance target with the VerifyShield off', () => {
    expect(decide(
      [
        { agent: 'teacher', move: { type: 'explain_concept', scope: 'recursion' } },
        { agent: 'teacher', move: { type: 'advance_to_module', moduleId: 'nested_loops' } },
      ],
      snapshot({ verifyShieldOn: false, studentMessage: 'How does recursion work?' }),
      roleTable,
      course,
    ).map(verdict => verdict.reasonCode)).toEqual(['VERIFYSHIELD_OFF', 'VERIFYSHIELD_OFF'])
  })

  it('allows a misconception the current module has', () => {
    const move = { type: 'address_misconception' as const, misconceptionId: 'accumulator_reset_inside_loop', scope: 'loops' }
    expect(decide(
      [{ agent: 'teacher', move }],
      snapshot({ studentMessage: 'Why is my total always the last number?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move,
    }])
  })

  it('answers the question instead when the misconception is not one the module has', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'address_misconception', misconceptionId: 'off_by_one_range', scope: 'loops' } }],
      snapshot({ studentMessage: 'Why is my total always the last number?' }),
      roleTable,
      course,
    )).toEqual([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'misconception_known',
      reasonCode: 'MISCONCEPTION_UNKNOWN',
      move: { type: 'answer_question', scope: 'loops' },
    }])
  })

  it('redirects an invented misconception on a closed module, as the scope rules come first', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'address_misconception', misconceptionId: 'tuple_is_mutable', scope: 'lists_and_tuples' } }],
      snapshot({ studentMessage: 'Why does my code fail?' }),
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
