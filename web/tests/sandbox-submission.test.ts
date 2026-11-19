import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { pythonCourse, studyModule } from '../server/course'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemorySubmissionStore } from '../server/storage/submission-store'
import { createFakeSandbox, libraryRefusal, printedTooMuch, tookTooLong, usedTooMuchMemory, type SandboxRequest } from '../server/sandbox'
import { createMemoryEvidenceStore } from '../server/student-model'
import { handleTurn } from '../server/turn/handle-turn'

const student = '6f1b0c1e-1111-4111-8111-111111111111'
const otherStudent = '6f1b0c1e-2222-4222-8222-222222222222'
const gettingStarted = studyModule(pythonCourse, 'getting_started')
if (!gettingStarted) throw new Error('Getting Started is missing.')
const sayHello = gettingStarted.exercises[0]
if (!sayHello) throw new Error('Say hello is missing.')

const code = 'def hello(name):\n    return "no"\n'

function store() {
  return createMemoryConversationStore({
    [student]: 'An',
    [otherStudent]: 'Binh',
  })
}

function teacher() {
  return createFakeAgents({
    proposal: { type: 'explain_concept', scope: 'getting_started' },
    text: 'The greeting is built from the name.',
  })
}

function forgedPass() {
  return sayHello.tests.map(test => ({
    name: test.name,
    passed: true,
    expected: test.expected,
    actual: test.expected,
  }))
}

describe('a submission counted by the sandbox', () => {
  it('records the sandbox result and leaves a forged pass out of mastery', async () => {
    const evidence = createMemoryEvidenceStore()
    const submissions = createMemorySubmissionStore()
    let checked: SandboxRequest | null = null
    const failed = sayHello.tests.map(test => ({
      name: test.name,
      passed: false,
      expected: test.expected,
      actual: 'no',
    }))
    const sandbox = createFakeSandbox((request) => {
      checked = request
      return { outcome: 'checked', results: failed }
    })

    const before = await handleTurn({
      sessionStudentId: student,
      body: { event: 'open' },
    }, store(), undefined, { evidence })
    const after = await handleTurn({
      sessionStudentId: student,
      body: { event: 'submission', code, results: forgedPass() },
    }, store(), teacher(), { evidence, sandbox, submissions })

    expect(checked).toEqual({
      code,
      tests: sayHello.tests.map(test => ({
        name: test.name,
        expression: test.expression,
        expected: test.expected,
      })),
    })
    expect(await evidence.forStudent(student)).toEqual([
      expect.objectContaining({
        kind: 'submission',
        moduleId: 'getting_started',
        exerciseId: 'say_hello',
        allPassed: false,
      }),
    ])
    // One failed submission from the prior 0.1: posterior 1/73, then the learning
    // step, which is 59/365. Shown mastery rounds down to the hundredth.
    expect(before.courseRoadmap[0]?.mastery).toBe(0.1)
    expect(after.courseRoadmap[0]?.mastery).toBe(0.16)
    const saved = await submissions.forStudent(student)
    expect(saved).toEqual([
      expect.objectContaining({
        studentId: student,
        moduleId: 'getting_started',
        exerciseId: 'say_hello',
        code,
        results: failed,
        outcome: 'failed',
        message: null,
      }),
    ])
    expect(await submissions.read(student, saved[0]!.id)).toMatchObject({ code, results: failed, outcome: 'failed' })
    await expect(submissions.read(otherStudent, saved[0]!.id)).rejects.toMatchObject({
      name: 'SubmissionRefusedError',
      statusCode: 403,
    })
  })

  it('keeps a sandbox pass, and the browser counts do not change that mastery', async () => {
    const passed = sayHello.tests.map(test => ({
      name: test.name,
      passed: true,
      expected: test.expected,
      actual: test.expected,
    }))
    const failedCounts = sayHello.tests.map(test => ({
      name: test.name,
      passed: false,
      expected: test.expected,
      actual: 'no',
    }))
    async function submit(browserResults: ReturnType<typeof forgedPass>) {
      const evidence = createMemoryEvidenceStore()
      const conversation = store()
      const submitted = await handleTurn({
        sessionStudentId: student,
        body: { event: 'submission', code, results: browserResults },
      }, conversation, teacher(), {
        evidence,
        sandbox: createFakeSandbox({ outcome: 'checked', results: passed }),
      })
      return { submitted, evidence }
    }

    const honest = await submit(passed)
    const forged = await submit(failedCounts)
    expect(honest.submitted.courseRoadmap[0]?.mastery).toBe(0.43)
    expect(forged.submitted.courseRoadmap[0]?.mastery).toBe(honest.submitted.courseRoadmap[0]?.mastery)
    expect(await forged.evidence.forStudent(student)).toEqual([
      expect.objectContaining({ exerciseId: 'say_hello', allPassed: true }),
    ])
  })

  it('shows the sandbox message and records no pass when the run is stopped or refused', async () => {
    const messages = [
      tookTooLong,
      usedTooMuchMemory,
      printedTooMuch,
      libraryRefusal('os'),
    ]
    for (const message of messages) {
      const evidence = createMemoryEvidenceStore()
      const submissions = createMemorySubmissionStore()
      const agents = teacher()
      const before = await handleTurn({
        sessionStudentId: student,
        body: { event: 'open' },
      }, store(), undefined, { evidence })
      const after = await handleTurn({
        sessionStudentId: student,
        body: { event: 'submission', code: 'import os\n', results: forgedPass() },
      }, store(), agents, {
        evidence,
        submissions,
        sandbox: createFakeSandbox({ outcome: 'refused', message }),
      })

      expect(after.courseRoadmap[0]?.mastery).toBe(before.courseRoadmap[0]?.mastery)
      expect(await evidence.forStudent(student)).toEqual([])
      expect(after.notice).toBe(message)
      expect(after.conversation.map(entry => entry.text)).toEqual([message])
      expect(agents.exchanges).toEqual([])
      const saved = await submissions.forStudent(student)
      expect(saved).toEqual([
        expect.objectContaining({
          code: 'import os\n',
          results: [],
          outcome: 'refused',
          message,
        }),
      ])
      await expect(submissions.read(otherStudent, saved[0]!.id)).rejects.toMatchObject({
        name: 'SubmissionRefusedError',
      })
    }
  })
})
