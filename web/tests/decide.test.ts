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
    shownMisconceptionIds: ['accumulator_reset_inside_loop'],
    planTargets: {
      materials: 1,
      exerciseIds: ['sum_of_a_list', 'count_the_even_numbers', 'count_the_items'],
      questionIds: ['running-total', 'skip-pass', 'while-condition'],
      misconceptionIds: ['accumulator_reset_inside_loop'],
    },
    weakSpotMisconceptionIds: [],
    planInForce: false,
    planTriggers: [],
    approachAwaitingTry: false,
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([
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
    )).toMatchObject([
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

    expect(decide(proposals, frozen, roleTable, course)).toMatchObject(expected)
    expect(decide(proposals, frozen, roleTable, course)).toMatchObject(expected)
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
    )).toMatchObject([
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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
    )).toMatchObject([{
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

  it('allows a misconception the student\'s work shows', () => {
    const move = { type: 'address_misconception' as const, misconceptionId: 'accumulator_reset_inside_loop', scope: 'loops' }
    expect(decide(
      [{ agent: 'teacher', move }],
      snapshot({ studentMessage: 'Why is my total always the last number?' }),
      roleTable,
      course,
    )).toMatchObject([{
      agent: 'teacher',
      decision: 'allow',
      ruleId: 'role_table',
      reasonCode: 'ROLE_PERMITTED',
      move,
    }])
  })

  it('answers the question instead when the work does not show the misconception', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'address_misconception', misconceptionId: 'accumulator_reset_inside_loop', scope: 'loops' } }],
      snapshot({ studentMessage: 'Why is my total always the last number?', shownMisconceptionIds: [] }),
      roleTable,
      course,
    )).toMatchObject([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'misconception_shown',
      reasonCode: 'MISCONCEPTION_NOT_SHOWN',
      move: { type: 'answer_question', scope: 'loops' },
    }])
  })

  it('answers on the student\'s own module when the claim names another one', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'address_misconception', misconceptionId: 'missing_quotes', scope: 'strings' } }],
      snapshot({ unlockedModuleIds: ['loops', 'strings'], shownMisconceptionIds: [] }),
      roleTable,
      course,
    )).toMatchObject([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'misconception_shown',
      reasonCode: 'MISCONCEPTION_NOT_SHOWN',
      move: { type: 'answer_question', scope: 'loops' },
    }])
  })

  it('redirects an invented misconception on a closed module, as the scope rules come first', () => {
    expect(decide(
      [{ agent: 'teacher', move: { type: 'address_misconception', misconceptionId: 'tuple_is_mutable', scope: 'lists_and_tuples' } }],
      snapshot({ studentMessage: 'Why does my code fail?' }),
      roleTable,
      course,
    )).toMatchObject([{
      agent: 'teacher',
      decision: 'downgrade',
      ruleId: 'scope_requires_unlocked_module',
      reasonCode: 'MODULE_CLOSED',
      move: { type: 'redirect_to_module', scope: 'lists_and_tuples' },
    }])
  })

  describe('rule checks', () => {
    function checks(proposal: Parameters<typeof decide>[0][number], overrides: Partial<TurnSnapshot> = {}) {
      return decide([proposal], snapshot(overrides), roleTable, course)[0]?.ruleChecks
    }

    it('lists the passed checks in the order they ran and ends with the allow on an allow', () => {
      expect(checks({ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } })).toEqual([
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_keyword', passed: true, reasonCode: 'NO_CLOSED_KEYWORD' },
        { ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' },
        { ruleId: 'scope_requires_unlocked_module', passed: true, reasonCode: 'MODULE_UNLOCKED' },
        { ruleId: 'all_rules', passed: true, reasonCode: 'ALL_RULES_PASSED' },
      ])
    })

    it('checks only the role table for a deskmate move', () => {
      expect(checks({ agent: 'deskmate', move: { type: 'peer_question' } })).toEqual([
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'all_rules', passed: true, reasonCode: 'ALL_RULES_PASSED' },
      ])
    })

    it('ends with the failed role table check on a block', () => {
      expect(checks({ agent: 'deskmate', move: { type: 'explain_concept', scope: 'loops' } })).toEqual([
        { ruleId: 'role_table', passed: false, reasonCode: 'ROLE_FORBIDDEN' },
      ])
    })

    it('ends with the failed scope check on a redirect downgrade', () => {
      expect(checks(
        { agent: 'teacher', move: { type: 'explain_concept', scope: 'lists_and_tuples' } },
        { studentMessage: 'What are lists?' },
      )).toEqual([
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' },
        { ruleId: 'scope_requires_unlocked_module', passed: false, reasonCode: 'MODULE_CLOSED' },
      ])
    })

    it('ends with the failed hint ladder check on a skipped rung', () => {
      expect(checks({ agent: 'teacher', move: { type: 'hint_level_N', level: 3, scope: 'loops' } })).toEqual([
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_keyword', passed: true, reasonCode: 'NO_CLOSED_KEYWORD' },
        { ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' },
        { ruleId: 'scope_requires_unlocked_module', passed: true, reasonCode: 'MODULE_UNLOCKED' },
        { ruleId: 'hint_ladder', passed: false, reasonCode: 'HINT_SKIPPED' },
      ])
    })

    it('ends with the failed misconception check on an unknown misconception', () => {
      expect(checks({ agent: 'teacher', move: { type: 'address_misconception', misconceptionId: 'invented', scope: 'loops' } })).toEqual([
        { ruleId: 'role_table', passed: true, reasonCode: 'ROLE_PERMITTED' },
        { ruleId: 'scope_keyword', passed: true, reasonCode: 'NO_CLOSED_KEYWORD' },
        { ruleId: 'scope_in_course', passed: true, reasonCode: 'IN_COURSE' },
        { ruleId: 'scope_requires_unlocked_module', passed: true, reasonCode: 'MODULE_UNLOCKED' },
        { ruleId: 'misconception_shown', passed: false, reasonCode: 'MISCONCEPTION_NOT_SHOWN' },
      ])
    })

    it('has no checks when the VerifyShield is off', () => {
      expect(checks({ agent: 'teacher', move: { type: 'explain_concept', scope: 'loops' } }, { verifyShieldOn: false })).toEqual([])
    })

    it('ends every list with the deciding rule and gives the same checks each time', () => {
      const proposals = [
        { agent: 'teacher' as const, move: { type: 'explain_concept' as const, scope: 'pandas' } },
        { agent: 'teacher' as const, move: { type: 'advance_to_module' as const, moduleId: 'loops' } },
        { agent: 'deskmate' as const, move: { type: 'share_confusion' as const } },
      ]
      const first = decide(proposals, snapshot({ moduleId: '' }), roleTable, course)
      const again = decide(proposals, snapshot({ studentMessage: 'Tell me about pandas' }), roleTable, course)
      for (const verdict of [...first, ...again]) {
        const deciding = verdict.decision === 'allow'
          ? { ruleId: 'all_rules', passed: true, reasonCode: 'ALL_RULES_PASSED' }
          : { ruleId: verdict.ruleId, reasonCode: verdict.reasonCode }
        expect(verdict.ruleChecks.at(-1)).toMatchObject(deciding)
      }
      expect(decide(proposals, snapshot({ studentMessage: 'Tell me about pandas' }), roleTable, course)).toEqual(again)
    })
  })
})

describe('decide on a learning plan', () => {
  const plan = (steps: { kind: 'materials' | 'quiz' | 'exercise' | 'misconception', ref: string }[]) =>
    ({ agent: 'teacher' as const, move: { type: 'propose_plan' as const, steps } })

  it('allows a plan whose steps all point at the module', () => {
    expect(decide(
      [plan([
        { kind: 'materials', ref: '' },
        { kind: 'quiz', ref: 'running-total' },
        { kind: 'exercise', ref: 'sum_of_a_list' },
      ])],
      snapshot(),
      roleTable,
      course,
    )).toMatchObject([{
      decision: 'allow',
      move: { type: 'propose_plan', steps: [
        { kind: 'materials', ref: '' },
        { kind: 'quiz', ref: 'running-total' },
        { kind: 'exercise', ref: 'sum_of_a_list' },
      ] },
    }])
  })

  it('blocks a plan with no steps', () => {
    expect(decide([plan([])], snapshot(), roleTable, course)).toMatchObject([{
      decision: 'block',
      ruleId: 'plan_step_count',
      reasonCode: 'PLAN_WITHOUT_STEPS',
      move: null,
    }])
  })

  it('blocks a plan with more than five steps', () => {
    const steps = Array.from({ length: 6 }, () => ({ kind: 'materials' as const, ref: '' }))
    expect(decide([plan(steps)], snapshot(), roleTable, course)).toMatchObject([{
      decision: 'block',
      ruleId: 'plan_step_count',
      reasonCode: 'PLAN_TOO_LONG',
      move: null,
    }])
  })

  it('drops a step that points at another module', () => {
    const verdict = decide(
      [plan([
        { kind: 'exercise', ref: 'sum_of_a_list' },
        { kind: 'exercise', ref: 'hello_name' },
      ])],
      snapshot(),
      roleTable,
      course,
    )[0]
    expect(verdict).toMatchObject({
      decision: 'downgrade',
      ruleId: 'plan_steps_in_module',
      reasonCode: 'PLAN_STEPS_DROPPED',
      move: { type: 'propose_plan', steps: [{ kind: 'exercise', ref: 'sum_of_a_list' }] },
    })
  })

  it('blocks a plan whose every step points at another module', () => {
    expect(decide(
      [plan([{ kind: 'quiz', ref: 'string-slicing' }])],
      snapshot(),
      roleTable,
      course,
    )).toMatchObject([{
      decision: 'block',
      ruleId: 'plan_steps_in_module',
      reasonCode: 'PLAN_NO_STEPS_IN_MODULE',
      move: null,
    }])
  })

  it('keeps a misconception step only when the learning pattern calls it a weak spot', () => {
    const steps = [{ kind: 'misconception' as const, ref: 'accumulator_reset_inside_loop' }]
    expect(decide([plan(steps)], snapshot(), roleTable, course)[0]).toMatchObject({
      decision: 'block',
      reasonCode: 'PLAN_NO_STEPS_IN_MODULE',
    })
    expect(decide(
      [plan(steps)],
      snapshot({ weakSpotMisconceptionIds: ['accumulator_reset_inside_loop'] }),
      roleTable,
      course,
    )[0]).toMatchObject({ decision: 'allow', move: { type: 'propose_plan', steps } })
  })

  it('drops a repeated step', () => {
    const verdict = decide(
      [plan([{ kind: 'materials', ref: '' }, { kind: 'materials', ref: '' }])],
      snapshot(),
      roleTable,
      course,
    )[0]
    expect(verdict).toMatchObject({
      decision: 'downgrade',
      reasonCode: 'PLAN_STEPS_DROPPED',
      move: { type: 'propose_plan', steps: [{ kind: 'materials', ref: '' }] },
    })
  })

  it('allows any plan when the VerifyShield is off', () => {
    expect(decide(
      [plan([{ kind: 'quiz', ref: 'string-slicing' }])],
      snapshot({ verifyShieldOn: false }),
      roleTable,
      course,
    )[0]).toMatchObject({ decision: 'allow', reasonCode: 'VERIFYSHIELD_OFF' })
  })

  it('never lets the Deskmate propose a plan', () => {
    expect(decide(
      [{ agent: 'deskmate', move: { type: 'propose_plan', steps: [{ kind: 'materials', ref: '' }] } }],
      snapshot(),
      roleTable,
      course,
    )[0]).toMatchObject({ decision: 'block', ruleId: 'role_table', reasonCode: 'ROLE_FORBIDDEN' })
  })
})

describe('decide on revising a plan and checking in', () => {
  const revise = (steps: { kind: 'materials' | 'quiz' | 'exercise' | 'misconception' | 'approach' | 'try', ref: string }[]) =>
    ({ agent: 'teacher' as const, move: { type: 'revise_plan' as const, steps } })
  const steps = [{ kind: 'exercise' as const, ref: 'sum_of_a_list' }]

  it('revises a plan when a trigger happened since the last revision', () => {
    const [verdict] = decide([revise(steps)], snapshot({ planInForce: true, planTriggers: ['failed_submissions'] }), roleTable, course)

    expect(verdict).toMatchObject({ decision: 'allow', move: { type: 'revise_plan', steps } })
    expect(verdict!.ruleChecks).toContainEqual({ ruleId: 'plan_revision_needs_trigger', passed: true, reasonCode: 'PLAN_TRIGGER_SEEN' })
  })

  it('turns a revision with nothing new behind it into a check-in', () => {
    const [verdict] = decide([revise(steps)], snapshot({ planInForce: true, planTriggers: [] }), roleTable, course)

    expect(verdict).toMatchObject({
      decision: 'downgrade',
      ruleId: 'plan_revision_needs_trigger',
      reasonCode: 'PLAN_NO_TRIGGER',
      move: { type: 'continue_plan' },
    })
  })

  it('turns a revision of a module with no plan into a check-in refusal', () => {
    expect(decide([revise(steps)], snapshot({ planInForce: false, planTriggers: ['wrong_quiz_answer'] }), roleTable, course)[0])
      .toMatchObject({ decision: 'block', reasonCode: 'NO_PLAN_IN_FORCE' })
  })

  it('holds a revision to the same step rules as a proposal', () => {
    expect(decide(
      [revise([{ kind: 'quiz', ref: 'string-slicing' }])],
      snapshot({ planInForce: true, planTriggers: ['wrong_quiz_answer'] }),
      roleTable,
      course,
    )[0]).toMatchObject({ decision: 'block', reasonCode: 'PLAN_NO_STEPS_IN_MODULE' })
  })

  it('allows a check-in only while a plan is in force', () => {
    const checkIn = [{ agent: 'teacher' as const, move: { type: 'continue_plan' as const } }]
    expect(decide(checkIn, snapshot({ planInForce: true }), roleTable, course)[0]).toMatchObject({ decision: 'allow' })
    expect(decide(checkIn, snapshot({ planInForce: false }), roleTable, course)[0])
      .toMatchObject({ decision: 'block', reasonCode: 'NO_PLAN_IN_FORCE' })
  })

  it('lets the approach be tried before a hint corrects it', () => {
    const hint = [{ agent: 'teacher' as const, move: { type: 'hint_level_N' as const, level: 1 as const, scope: 'loops' } }]

    expect(decide(hint, snapshot({ planInForce: true, approachAwaitingTry: true }), roleTable, course)[0]).toMatchObject({
      decision: 'downgrade',
      ruleId: 'approach_before_correction',
      reasonCode: 'APPROACH_NOT_TRIED',
      move: { type: 'continue_plan' },
    })
    expect(decide(hint, snapshot({ planInForce: true, approachAwaitingTry: false }), roleTable, course)[0])
      .toMatchObject({ decision: 'allow' })
  })

  it('lets the approach be tried before a misconception is corrected', () => {
    const correction = [{ agent: 'teacher' as const, move: { type: 'address_misconception' as const, misconceptionId: 'accumulator_reset_inside_loop', scope: 'loops' } }]

    expect(decide(correction, snapshot({ planInForce: true, approachAwaitingTry: true }), roleTable, course)[0])
      .toMatchObject({ decision: 'downgrade', ruleId: 'approach_before_correction', move: { type: 'continue_plan' } })
  })

  it('never lets the Deskmate revise or check in', () => {
    for (const move of [{ type: 'continue_plan' as const }, { type: 'revise_plan' as const, steps }]) {
      expect(decide([{ agent: 'deskmate', move }], snapshot({ planInForce: true, planTriggers: ['failed_submissions'] }), roleTable, course)[0])
        .toMatchObject({ decision: 'block', reasonCode: 'ROLE_FORBIDDEN' })
    }
  })

  it('allows them unchecked when the VerifyShield is off', () => {
    expect(decide([revise(steps)], snapshot({ verifyShieldOn: false }), roleTable, course)[0])
      .toMatchObject({ decision: 'allow', reasonCode: 'VERIFYSHIELD_OFF' })
  })
})
