import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { createMemoryActivityLog, type ActivityEventType } from '../server/activity-recorder'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemoryEvidenceStore, createMemoryUnlockStore } from '../server/student-model'
import { createMemoryStudySuggestionStore } from '../server/storage/study-suggestion-store'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-3333-4333-8333-333333333333'
const gs = 'getting_started'
const moduleName = 'Getting Started with Programming and Python'
const full = { testsPassed: 3, testsTotal: 3 }
const some = { testsPassed: 1, testsTotal: 3 }
const none = { testsPassed: 0, testsTotal: 3 }

type Payload = Record<string, unknown>

// One student whose activity log is seeded by the test, and whose redraw is read through the turn handler.
function session(options: { agents?: ReturnType<typeof createFakeAgents>, unlocked?: string[] } = {}) {
  const conversation = createMemoryConversationStore({ [student]: 'An' })
  const activity = createMemoryActivityLog()
  const studySuggestions = createMemoryStudySuggestionStore()
  const unlocks = createMemoryUnlockStore()
  if (options.unlocked) void unlocks.record(student, options.unlocked)
  const agents = options.agents ?? createFakeAgents({ proposal: { type: 'answer_question', scope: gs }, text: 'A plain answer.' })
  const turnOptions = { activity, studySuggestions, unlocks, evidence: createMemoryEvidenceStore() }
  const turn = (body: unknown) => handleTurn({ sessionStudentId: student, body }, conversation, agents, turnOptions)
  return {
    agents,
    activity,
    studySuggestions,
    log: async (type: ActivityEventType, payload: Payload = {}, courseId = 'intro_python') => {
      await activity.record({ studentId: student, courseId, type, payload })
    },
    open: () => turn({ event: 'open' }),
    turn,
    dismiss: async (key: string) => turn({ event: 'dismiss_study_suggestion', key }),
  }
}

type Session = ReturnType<typeof session>

// Practice has been chosen on the module, so reading is not the only thing the log shows.
async function practising(s: Session, moduleId = gs) {
  await s.log('module_opened', { moduleId })
  await s.log('mode_switched', { mode: 'practice', moduleId })
}

async function fullPass(s: Session, exerciseId = 'say_hello', moduleId = gs) {
  await s.log('submitted', { moduleId, exerciseId, ...full })
}

describe('the study suggestion in the redraw', () => {
  it('shows none when no situation is true', async () => {
    const s = session()

    expect((await s.open()).studySuggestion).toBeNull()
  })

  it('chooses the same step from the same log every time', async () => {
    const s = session()
    await s.log('module_opened', { moduleId: gs })

    expect((await s.open()).studySuggestion).toEqual((await s.open()).studySuggestion)
  })

  describe('each situation', () => {
    it('1. a pasted pass sends the student to the Learn materials', async () => {
      const s = session()
      await s.log('pasted', { exerciseId: 'say_hello', characters: 40 })
      await fullPass(s)

      const state = await s.open()

      expect(state.studySuggestion).toMatchObject({
        sentence: `Read the Learn materials for ${moduleName} before you go on.`,
        button: 'Read the materials',
        action: { kind: 'learn', moduleId: gs },
      })
    })

    it('1. a paste of 39 characters does not count', async () => {
      const s = session()
      await s.log('pasted', { exerciseId: 'say_hello', characters: 39 })
      await fullPass(s)

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('1. a pasted pass ends when the module has been switched to Learn', async () => {
      const s = session()
      await s.log('pasted', { exerciseId: 'say_hello', characters: 80 })
      await fullPass(s)
      await s.log('mode_switched', { mode: 'learn', moduleId: gs })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('1. a paste after the first submission is not the pasted pass', async () => {
      const s = session()
      await fullPass(s)
      await s.log('pasted', { exerciseId: 'say_hello', characters: 80 })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('2. three runs with the same error type keep the student on the exercise and name it', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) {
        await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
      }

      const state = await s.open()

      expect(state.studySuggestion).toMatchObject({
        sentence: 'Stay on Say hello. Your runs keep ending in a NameError.',
        button: 'Stay here',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('2. two runs with that error, or two different error types, are one short', async () => {
      const s = session()
      await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
      await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
      await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'SyntaxError' })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('2. a full pass after the first of the three ends it', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) {
        await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
      }
      await fullPass(s)

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('3. two submissions that did not pass keep the student on the exercise', async () => {
      const s = session()
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: 'Stay on Say hello and look at the tests that failed.',
        button: 'Stay here',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('3. two failures before a full pass are over', async () => {
      const s = session()
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })
      await fullPass(s)

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('4. one partial submission asks the student to finish the tests', async () => {
      const s = session()
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...some })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: 'Stay on Say hello and finish the tests that failed.',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('4. one submission that passed nothing is not a partial pass', async () => {
      const s = session()
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('3 outranks 4 once there are two submissions that did not pass', async () => {
      const s = session()
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...some })
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...some })

      expect((await s.open()).studySuggestion?.sentence).toBe('Stay on Say hello and look at the tests that failed.')
    })

    it('5. three runs and no submission send the student to submit, without submitting', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: 'Submit Say hello so it can be checked.',
        button: 'Go to the exercise',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('5. two runs are one short, and a submission after the first run ends it', async () => {
      const short = session()
      await short.log('code_run', { exerciseId: 'say_hello' })
      await short.log('code_run', { exerciseId: 'say_hello' })
      expect((await short.open()).studySuggestion).toBeNull()

      const ended = session()
      await ended.log('code_run', { exerciseId: 'say_hello' })
      await ended.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...full })
      await ended.log('code_run', { exerciseId: 'say_hello' })
      await ended.log('code_run', { exerciseId: 'say_hello' })
      expect((await ended.open()).studySuggestion).toBeNull()
    })

    it('6. a message before any run or submission tells the student to try an exercise, and the Teacher still answers', async () => {
      const s = session()
      await s.log('message_sent', { moduleId: gs })

      const state = await s.turn({ event: 'message', text: 'How do I start?', moduleId: gs, exerciseId: 'say_hello' })

      expect(state.studySuggestion).toMatchObject({
        sentence: `Try running or submitting an exercise in ${moduleName} before asking.`,
        button: 'Try an exercise',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
      expect(state.conversation.some(message => message.author === 'teacher')).toBe(true)
    })

    it('7. quiz answers with no passed exercise send the student to an exercise', async () => {
      const s = session()
      await s.log('quiz_answered', { moduleId: gs, questionId: 'q1', correct: true })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: `Do an exercise in ${moduleName}. A quiz on its own does not master it.`,
        button: 'Do an exercise',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('7. a full pass of an exercise of the module ends it, and the next exercise is the first without a pass', async () => {
      const s = session()
      await s.log('quiz_answered', { moduleId: gs, questionId: 'q1', correct: true })
      await fullPass(s)

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('8. opening a module and staying in Learn counts as reading only', async () => {
      const s = session()
      await s.log('module_opened', { moduleId: gs })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: `Switch to Practice and do an exercise in ${moduleName}.`,
        button: 'Go to Practice',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('8. a switch to Practice, a run or a submission ends it', async () => {
      const switched = session()
      await practising(switched)
      expect((await switched.open()).studySuggestion).toBeNull()

      const ran = session()
      await ran.log('module_opened', { moduleId: gs })
      await ran.log('code_run', { exerciseId: 'say_hello' })
      expect((await ran.open()).studySuggestion).toBeNull()
    })

    it('9. leaving a module for another before submitting sends the student back, to its first exercise with no pass', async () => {
      const s = session({ unlocked: ['variables'] })
      await practising(s)
      await s.log('module_opened', { moduleId: 'variables' })
      await s.log('mode_switched', { mode: 'practice', moduleId: 'variables' })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: `Go back to ${moduleName}. You left it before submitting.`,
        button: 'Go back',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('9. leaving for the Mindmap layout also abandons the module, and a submission ends it', async () => {
      const left = session()
      await practising(left)
      await left.log('layout_switched', { layout: 'mindmap', moduleId: gs })
      expect((await left.open()).studySuggestion?.sentence).toBe(`Go back to ${moduleName}. You left it before submitting.`)

      const submitted = session()
      await practising(submitted)
      await submitted.log('layout_switched', { layout: 'mindmap', moduleId: gs })
      await submitted.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...full })
      await submitted.log('layout_switched', { layout: 'study', moduleId: gs })
      expect((await submitted.open()).studySuggestion).toBeNull()
    })

    it('9. a closed module is skipped and the next situation is considered', async () => {
      const s = session()
      await practising(s)
      await s.log('module_opened', { moduleId: 'loops' })
      await s.log('mode_switched', { mode: 'practice', moduleId: 'loops' })

      expect((await s.open()).studySuggestion?.sentence ?? '').not.toMatch(/loops/i)
    })

    it('10. three module openings with no submission between them keep the student on the current module', async () => {
      const s = session({ unlocked: ['variables'] })
      await fullPass(s, 'say_hello', gs)
      await fullPass(s, 'total_cost', 'variables')
      await s.log('module_opened', { moduleId: gs })
      await s.log('module_opened', { moduleId: 'variables' })
      await s.log('module_opened', { moduleId: gs })

      // A student with variables unlocked opens on it, so it is the current module.
      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: 'Stay on Variables, Data Types, and Operators and do an exercise.',
        button: 'Stay here',
        action: { kind: 'practice', moduleId: 'variables', exerciseId: 'whole_number' },
      })
    })

    it('10. two openings are one short, and a submission after the last ends it', async () => {
      const short = session({ unlocked: ['variables'] })
      await fullPass(short, 'say_hello', gs)
      await fullPass(short, 'total_cost', 'variables')
      await short.log('module_opened', { moduleId: 'variables' })
      await short.log('module_opened', { moduleId: gs })
      expect((await short.open()).studySuggestion).toBeNull()

      const ended = session({ unlocked: ['variables'] })
      await fullPass(ended, 'say_hello', gs)
      await fullPass(ended, 'total_cost', 'variables')
      await ended.log('module_opened', { moduleId: gs })
      await ended.log('module_opened', { moduleId: 'variables' })
      await ended.log('module_opened', { moduleId: gs })
      await ended.log('submitted', { moduleId: gs, exerciseId: 'join_words', ...full })
      expect((await ended.open()).studySuggestion).toBeNull()
    })

    it('11. switching to the Mindmap layout with the exercise unfinished returns the student to the Study layout', async () => {
      const s = session()
      await fullPass(s, 'say_hello')
      await s.log('layout_switched', { layout: 'study', moduleId: gs })
      await s.log('code_run', { exerciseId: 'say_hello' })
      await s.log('submitted', { moduleId: gs, exerciseId: 'join_words', ...full })
      await s.log('layout_switched', { layout: 'mindmap', moduleId: gs })
      await s.turn({ event: 'select_exercise', exerciseId: 'sign_the_program' })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: 'Come back to the Study layout and finish Sign the program.',
        button: 'Back to Study',
        action: { kind: 'study', moduleId: gs, exerciseId: 'sign_the_program' },
      })
    })

    it('11. returning to the Study layout ends it', async () => {
      const s = session()
      await fullPass(s, 'say_hello')
      await s.log('layout_switched', { layout: 'mindmap', moduleId: gs })
      await s.log('layout_switched', { layout: 'study', moduleId: gs })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('12. coming back to the same exercise after going quiet asks the student to continue', async () => {
      const s = session()
      await s.log('went_idle', { moduleId: gs, exerciseId: 'say_hello' })
      await s.log('returned', { moduleId: gs, exerciseId: 'say_hello' })

      expect((await s.open()).studySuggestion).toMatchObject({
        sentence: 'Continue Say hello.',
        button: 'Continue',
        action: { kind: 'practice', moduleId: gs, exerciseId: 'say_hello' },
      })
    })

    it('12. a run, a submission or a message after the return ends it', async () => {
      const s = session()
      await s.log('went_idle', { moduleId: gs, exerciseId: 'say_hello' })
      await s.log('returned', { moduleId: gs, exerciseId: 'say_hello' })
      await s.log('code_run', { exerciseId: 'say_hello' })

      expect((await s.open()).studySuggestion).toBeNull()
    })
  })

  describe('what the rules leave alone', () => {
    it('ignores signing in, profile changes, mindmap moves and notes', async () => {
      const s = session()
      for (const type of ['signed_in', 'profile_changed', 'mindmap_moved', 'note_created', 'note_changed', 'note_linked', 'note_unlinked', 'note_deleted'] as const) {
        await s.log(type, { noteId: 'n1' })
      }

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('ignores one failed run, one failed submission and an unknown exercise', async () => {
      const s = session()
      await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'no_such_exercise' })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it("does not count another course's activity", async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' }, 'another_course')

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('leaves the roadmap and mastery as they were', async () => {
      const quiet = session()
      const noisy = session()
      for (let run = 0; run < 3; run += 1) await noisy.log('code_run', { exerciseId: 'say_hello' })

      const before = await quiet.open()
      const after = await noisy.open()

      expect(after.studySuggestion).not.toBeNull()
      expect(after.courseRoadmap).toEqual(before.courseRoadmap)
    })
  })

  describe('priority and dismissal', () => {
    async function twoSituations(s: Session) {
      // 5 (three runs, no submission) on one exercise, and the higher 2 (three NameErrors) on another.
      for (let run = 0; run < 3; run += 1) {
        await s.log('code_run', { exerciseId: 'join_words' })
        await s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
      }
    }

    it('shows the higher situation when two are true', async () => {
      const s = session()
      await twoSituations(s)

      expect((await s.open()).studySuggestion?.sentence).toContain('Your runs keep ending in a NameError')
    })

    it('hides a dismissed step and does not put the runner-up in its place', async () => {
      const s = session()
      await twoSituations(s)
      const shown = (await s.open()).studySuggestion!

      const dismissed = await s.dismiss(shown.key)

      expect(dismissed.studySuggestion).toBeNull()
      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('shows the runner-up later, once the winner has ended', async () => {
      const s = session()
      await twoSituations(s)
      await s.dismiss((await s.open()).studySuggestion!.key)

      await fullPass(s) // ends 2; situation 5 on the other exercise is still true

      expect((await s.open()).studySuggestion?.sentence).toBe('Submit Join two words so it can be checked.')
    })

    it('keeps a dismissal hidden while the same episode continues, and an unrelated row does not revive it', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })
      await s.dismiss((await s.open()).studySuggestion!.key)

      await s.log('code_run', { exerciseId: 'say_hello' })
      await s.log('message_sent', { moduleId: gs })
      await s.log('layout_switched', { layout: 'study', moduleId: gs })

      expect((await s.open()).studySuggestion).toBeNull()
    })

    it('shows the same step again when it has ended and a later episode begins', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })
      await s.dismiss((await s.open()).studySuggestion!.key)
      await s.log('submitted', { moduleId: gs, exerciseId: 'say_hello', ...none })
      await s.open()

      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })

      expect((await s.open()).studySuggestion?.sentence).toBe('Submit Say hello so it can be checked.')
    })

    it('remembers a dismissal for the student and the course, not for the device', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })
      await s.dismiss((await s.open()).studySuggestion!.key)

      const elsewhere = handleTurn({ sessionStudentId: student, body: { event: 'open' } }, createMemoryConversationStore({ [student]: 'An' }), s.agents, {
        activity: s.activity,
        studySuggestions: s.studySuggestions,
        evidence: createMemoryEvidenceStore(),
      })

      expect((await elsewhere).studySuggestion).toBeNull()
    })

    it('dismissal changes no mastery, no module state and no current module', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })
      const before = await s.open()

      const after = await s.dismiss(before.studySuggestion!.key)

      expect(after.courseRoadmap).toEqual(before.courseRoadmap)
      expect(after.workingArea.moduleId).toBe(before.workingArea.moduleId)
    })

    it('ignores a dismissal of a key the rules no longer choose', async () => {
      const s = session()
      for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'say_hello' })

      await s.dismiss('not-a-step')

      expect((await s.open()).studySuggestion).not.toBeNull()
    })
  })

  it('shows none on a module preview', async () => {
    const s = session({ unlocked: ['variables'] })
    for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'total_cost' })

    const preview = await s.turn({ event: 'preview_module', moduleId: 'variables' })

    expect(preview.studySuggestion).toBeNull()
  })

  it('also shows on a module selected from the roadmap', async () => {
    const s = session({ unlocked: ['variables'] })
    for (let run = 0; run < 3; run += 1) await s.log('code_run', { exerciseId: 'total_cost' })

    const selected = await s.turn({ event: 'select_module', moduleId: 'variables' })

    expect(selected.studySuggestion?.sentence).toBe('Submit Total cost so it can be checked.')
  })
})

// The page logs a module opening on every load of the workspace, so a reload must not look like new activity.
describe('the study suggestion across reloads', () => {
  it('keeps a dismissed reading-only step hidden after the page reloads the module', async () => {
    const s = session()
    await s.log('module_opened', { moduleId: gs })
    await s.dismiss((await s.open()).studySuggestion!.key)

    await s.log('module_opened', { moduleId: gs })

    expect((await s.open()).studySuggestion).toBeNull()
  })

  it('keeps a dismissed abandoned module hidden when the student comes back and leaves it again', async () => {
    const s = session({ unlocked: ['variables'] })
    await practising(s)
    await s.log('layout_switched', { layout: 'mindmap', moduleId: gs })
    expect((await s.open()).studySuggestion?.sentence).toBe(`Go back to ${moduleName}. You left it before submitting.`)
    await s.dismiss((await s.open()).studySuggestion!.key)

    await s.log('layout_switched', { layout: 'study', moduleId: gs })
    await s.log('module_opened', { moduleId: gs })
    await s.log('layout_switched', { layout: 'mindmap', moduleId: gs })

    expect((await s.open()).studySuggestion?.sentence ?? '').not.toContain('Go back to')
  })

  it('sends the student back to the module they left most recently', async () => {
    const s = session({ unlocked: ['variables'] })
    await practising(s, gs)
    await practising(s, 'variables')
    await s.log('module_opened', { moduleId: gs })
    await s.log('module_opened', { moduleId: 'variables' })

    expect((await s.open()).studySuggestion?.sentence).toBe(`Go back to ${moduleName}. You left it before submitting.`)
  })

  it('does not count three reloads of one module as hopping', async () => {
    const s = session()
    await fullPass(s, 'say_hello', gs)
    for (let load = 0; load < 3; load += 1) await s.log('module_opened', { moduleId: gs })

    expect((await s.open()).studySuggestion).toBeNull()
  })

  it('counts only openings that change module as hops', async () => {
    const s = session({ unlocked: ['variables'] })
    await fullPass(s, 'say_hello', gs)
    await fullPass(s, 'total_cost', 'variables')
    await s.log('module_opened', { moduleId: gs })
    await s.log('module_opened', { moduleId: gs })
    await s.log('module_opened', { moduleId: 'variables' })
    await s.log('module_opened', { moduleId: 'variables' })

    expect((await s.open()).studySuggestion).toBeNull()

    await s.log('module_opened', { moduleId: gs })
    expect((await s.open()).studySuggestion?.sentence).toMatch(/^Stay on .* and do an exercise\.$/)
  })
})

describe('the repeated error with two error types', () => {
  it('names the error type the student hit most recently', async () => {
    const s = session()
    const error = (errorType: string) => s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType })
    for (let run = 0; run < 3; run += 1) await error('TypeError')
    for (let run = 0; run < 3; run += 1) await error('NameError')
    await error('TypeError')

    expect((await s.open()).studySuggestion?.sentence).toBe('Stay on Say hello. Your runs keep ending in a TypeError.')
  })

  it('keeps the dismissal when the same error happens again', async () => {
    const s = session()
    const error = () => s.log('run_finished', { exerciseId: 'say_hello', outcome: 'error', errorType: 'NameError' })
    for (let run = 0; run < 3; run += 1) await error()
    await s.dismiss((await s.open()).studySuggestion!.key)

    await error()

    expect((await s.open()).studySuggestion).toBeNull()
  })
})
