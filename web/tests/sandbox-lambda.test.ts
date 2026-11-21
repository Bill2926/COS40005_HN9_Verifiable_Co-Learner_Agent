import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createFakeAgents } from '../server/agents'
import { pythonCourse, studyModule } from '../server/course'
import { couldNotCheck, createLambdaSandbox, createSdkInvoke, createSubmissionGate, createSubmissionSandbox, tryAgainInAMoment, usedTooMuchMemory, type LambdaInvoke, type SandboxProcessResult } from '../server/sandbox'
import { createMemoryConversationStore } from '../server/storage/conversation-store'
import { createMemorySubmissionStore } from '../server/storage/submission-store'
import { createMemoryEvidenceStore } from '../server/student-model'
import { handleTurn } from '../server/turn/handle-turn'

const request = {
  code: 'value = 1\n',
  tests: [{ name: 'value', expression: 'value', expected: '1' }],
}

const checked = {
  outcome: 'checked' as const,
  results: [{ name: 'value', passed: true, expected: '1', actual: '1' }],
}

describe('sandbox on Lambda', () => {
  it('uses the Lambda function result as the sandbox result', async () => {
    let sent = ''
    const invoke: LambdaInvoke = async (invocation) => {
      sent = invocation.payload
      return { payload: JSON.stringify(checked) }
    }
    const sandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke,
      gate: createSubmissionGate(5),
    })

    const report = await sandbox.check(request)

    expect(report).toEqual(checked)
    expect(JSON.parse(sent)).toEqual(request)
  })

  it('asks the sixth submission to try again and records no evidence', async () => {
    let calls = 0
    let release: () => void = () => {}
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const invoke: LambdaInvoke = async () => {
      calls += 1
      await blocked
      return { payload: JSON.stringify(checked) }
    }
    const sandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke,
      gate: createSubmissionGate(5),
    })
    const flights = Array.from({ length: 5 }, () => sandbox.check(request))

    const student = '6f1b0c1e-1111-4111-8111-111111111111'
    const gettingStarted = studyModule(pythonCourse, 'getting_started')
    const sayHello = gettingStarted?.exercises[0]
    if (!sayHello) throw new Error('Say hello is missing.')
    const evidence = createMemoryEvidenceStore()
    const submissions = createMemorySubmissionStore()
    const agents = createFakeAgents({
      proposal: { type: 'explain_concept', scope: 'getting_started' },
      text: 'The greeting is built from the name.',
    })
    const store = createMemoryConversationStore({ [student]: 'An' })
    const before = await handleTurn({
      sessionStudentId: student,
      body: { event: 'open' },
    }, store, undefined, { evidence })
    const sixth = await handleTurn({
      sessionStudentId: student,
      body: {
        event: 'submission',
        code: request.code,
        results: sayHello.tests.map(test => ({
          name: test.name,
          passed: true,
          expected: test.expected,
          actual: test.expected,
        })),
      },
    }, store, agents, { evidence, submissions, sandbox })

    expect(calls).toBe(5)
    expect(sixth.notice).toBe(tryAgainInAMoment)
    expect(sixth.courseRoadmap[0]?.mastery).toBe(before.courseRoadmap[0]?.mastery)
    expect(await evidence.forStudent(student)).toEqual([])
    expect(agents.exchanges).toEqual([])
    expect(await submissions.forStudent(student)).toEqual([
      expect.objectContaining({ outcome: 'refused', message: tryAgainInAMoment, results: [] }),
    ])

    release()
    await Promise.all(flights)
  })

  it('treats a busy function as try again and still takes the next submission', async () => {
    const busy = new Error('Rate Exceeded')
    busy.name = 'TooManyRequestsException'
    const gate = createSubmissionGate(1)
    const busySandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: async () => {
        throw busy
      },
      gate,
    })

    expect(await busySandbox.check(request)).toEqual({ outcome: 'refused', message: tryAgainInAMoment })

    const next = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: async () => ({ payload: JSON.stringify(checked) }),
      gate,
    })
    expect(await next.check(request)).toEqual(checked)

    const throttled = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: async () => ({ payload: JSON.stringify(checked), statusCode: 429 }),
      gate: createSubmissionGate(5),
    })
    expect(await throttled.check(request)).toEqual({ outcome: 'refused', message: tryAgainInAMoment })
  })

  it('does not turn an invoke failure into a pass or repeat the student code', async () => {
    const sandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: async () => {
        throw new Error('payload was SECRET_STUDENT_CODE')
      },
      gate: createSubmissionGate(5),
    })

    const report = await sandbox.check({ ...request, code: 'SECRET_STUDENT_CODE = 1\n' })

    expect(report).toEqual({ outcome: 'refused', message: couldNotCheck })
    expect(JSON.stringify(report)).not.toContain('SECRET_STUDENT_CODE')
  })

  it('turns a killed function into the memory message and does not repeat the payload', async () => {
    const sandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: async () => ({
        payload: JSON.stringify({ errorMessage: 'Runtime exited with error: signal: killed SECRET_STUDENT_CODE' }),
        functionError: 'Unhandled',
      }),
      gate: createSubmissionGate(5),
    })

    const report = await sandbox.check({ ...request, code: 'SECRET_STUDENT_CODE = 1\n' })

    expect(report).toEqual({ outcome: 'refused', message: usedTooMuchMemory })
    expect(JSON.stringify(report)).not.toContain('SECRET_STUDENT_CODE')
  })

  it('does not count a function error as a pass', async () => {
    const sandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: async () => ({ payload: JSON.stringify(checked), functionError: 'Unhandled' }),
      gate: createSubmissionGate(5),
    })

    expect(await sandbox.check(request)).toEqual({ outcome: 'refused', message: couldNotCheck })
  })
})

const sandboxDir = fileURLToPath(new URL('../../sandbox/', import.meta.url))

function runHandler(code: string): Promise<{ out: string, err: string, report: { outcome: string, results?: { actual: string }[], message?: string }, processErr: string }> {
  const script = [
    'import contextlib, io, json, sys',
    'sys.path.insert(0, sys.argv[1])',
    'import handler',
    'code = sys.stdin.read()',
    'out, err = io.StringIO(), io.StringIO()',
    'with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):',
    '    report = handler.handler({"code": code, "tests": [{"name": "value", "expression": "value", "expected": "1"}]}, None)',
    'sys.stdout.write(json.dumps({"out": out.getvalue(), "err": err.getvalue(), "report": report}))',
  ].join('\n')
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', script, sandboxDir], { stdio: ['pipe', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (status) => {
      const text = Buffer.concat(stdout).toString('utf8')
      if (status !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || text || `The handler exited ${status}.`))
        return
      }
      const parsed = JSON.parse(text) as { out: string, err: string, report: { outcome: string } }
      resolve({ ...parsed, processErr: Buffer.concat(stderr).toString('utf8') })
    })
    child.stdin.end(code)
  })
}

const quietRun = async (): Promise<SandboxProcessResult> => ({ stdout: '', stderr: '', status: 0, signal: null })

describe('the deployed sandbox', () => {
  it('checks a submission by invoking the Lambda function in Sydney', async () => {
    let invoked = false
    let ran = false
    const sandbox = createSubmissionSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      image: 'colearner-sandbox',
      invoke: async (invocation) => {
        invoked = true
        expect(invocation.functionName).toBe('colearner-sandbox')
        expect(invocation.region).toBe('ap-southeast-2')
        return { payload: JSON.stringify(checked) }
      },
      run: async () => {
        ran = true
        return quietRun()
      },
    })

    expect(await sandbox.check(request)).toEqual(checked)
    expect(invoked).toBe(true)
    expect(ran).toBe(false)
  })

  it('keeps the local image when the deployed function is not configured', async () => {
    let invoked = false
    let ran = false
    const sandbox = createSubmissionSandbox({
      functionName: '  ',
      region: 'ap-southeast-2',
      image: 'colearner-sandbox',
      invoke: async () => {
        invoked = true
        return { payload: JSON.stringify(checked) }
      },
      run: async () => {
        ran = true
        return {
          stdout: JSON.stringify(checked),
          stderr: '',
          status: 0,
          signal: null,
        }
      },
    })

    expect(await sandbox.check(request)).toEqual(checked)
    expect(ran).toBe(true)
    expect(invoked).toBe(false)
  })

  it('runs at most five submissions across checks on the deployed server', async () => {
    let calls = 0
    let release: () => void = () => {}
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const invoke: LambdaInvoke = async () => {
      calls += 1
      await blocked
      return { payload: JSON.stringify(checked) }
    }
    const first = createSubmissionSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      image: 'colearner-sandbox',
      invoke,
    })
    const second = createSubmissionSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      image: 'colearner-sandbox',
      invoke,
    })
    const flights = [
      first.check(request),
      second.check(request),
      first.check(request),
      second.check(request),
      first.check(request),
    ]
    try {
      const sixth = await second.check(request)
      expect(sixth).toEqual({ outcome: 'refused', message: tryAgainInAMoment })
      expect(calls).toBe(5)
    }
    finally {
      release()
      await Promise.all(flights)
    }
  })
})

describe('the Lambda invoke', () => {
  it('sends the submission to the named function and does not repeat it when the call fails', async () => {
    let sent: { input: { FunctionName?: string, InvocationType?: string, Payload?: Uint8Array } } | undefined
    let region = ''
    const invoke = createSdkInvoke((asked) => {
      region = asked
      return async (command) => {
        sent = command
        return { Payload: new TextEncoder().encode(JSON.stringify(checked)), StatusCode: 200 }
      }
    })
    const sandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke,
      gate: createSubmissionGate(5),
    })

    expect(await sandbox.check(request)).toEqual(checked)
    expect(region).toBe('ap-southeast-2')
    expect(sent?.input.FunctionName).toBe('colearner-sandbox')
    expect(sent?.input.InvocationType).toBe('RequestResponse')
    expect(JSON.parse(new TextDecoder().decode(sent?.input.Payload))).toEqual(request)

    const busy = createSdkInvoke(() => async () => {
      const error = new Error('body was SECRET_STUDENT_CODE')
      error.name = 'TooManyRequestsException'
      throw error
    })
    const busySandbox = createLambdaSandbox({
      functionName: 'colearner-sandbox',
      region: 'ap-southeast-2',
      invoke: busy,
      gate: createSubmissionGate(5),
    })
    const report = await busySandbox.check({ ...request, code: 'SECRET_STUDENT_CODE = 1\n' })
    expect(report).toEqual({ outcome: 'refused', message: tryAgainInAMoment })
    expect(JSON.stringify(report)).not.toContain('SECRET_STUDENT_CODE')
  })
})

// The handler runs the Linux-only runner, as Lambda does.
describe.skipIf(process.platform === 'win32')('Lambda handler logs', () => {
  it('returns the sandbox result and writes no student code', async () => {
    const source = 'SENTINEL_STUDENT_CODE = 1\nvalue = 1\n'
    const ran = await runHandler(source)
    expect(ran.report).toEqual({
      outcome: 'checked',
      results: [{ name: 'value', passed: true, expected: '1', actual: '1' }],
    })
    expect(ran.out).not.toContain('SENTINEL_STUDENT_CODE')
    expect(ran.err).not.toContain('SENTINEL_STUDENT_CODE')
    expect(ran.processErr).not.toContain('SENTINEL_STUDENT_CODE')

    const crashed = await runHandler('SENTINEL_STUDENT_CODE = 1\nvalue = 1 / 0\n')
    expect(crashed.report.outcome).toBe('checked')
    expect(crashed.out + crashed.err + crashed.processErr).not.toContain('SENTINEL_STUDENT_CODE')

    const printed = await runHandler('print("SENTINEL_STUDENT_CODE")\nvalue = 1\n')
    expect(printed.out + printed.err + printed.processErr).not.toContain('SENTINEL_STUDENT_CODE')
  })
})
