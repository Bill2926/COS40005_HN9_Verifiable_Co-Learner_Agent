import { isRunResult, isTestReport, type ExerciseCheck, type FromWorker, type RunResult, type TestReport, type ToWorker } from './protocol'

export type { RunResult, TestReport } from './protocol'

export class RunStopped extends Error {
  constructor() {
    super('Stopped')
    this.name = 'RunStopped'
  }
}

export interface WorkerPort {
  post: (message: ToWorker) => void
  onMessage: (handler: (message: FromWorker) => void) => void
  onError: (handler: (error: Error) => void) => void
  terminate: () => void
}

export interface RunHandle {
  started: Promise<void>
  result: Promise<RunResult>
}

export interface TestHandle {
  started: Promise<void>
  result: Promise<TestReport>
}

export interface PythonRunner {
  run: (code: string) => RunHandle
  runTests: (code: string, tests: readonly ExerciseCheck[]) => TestHandle
  stop: () => void
}

interface PendingRun {
  id: number
  kind: 'run' | 'test'
  resolveStarted: () => void
  rejectStarted: (error: unknown) => void
  resolve: (result: unknown) => void
  reject: (error: unknown) => void
}

export function createPythonRunner(spawn: () => WorkerPort): PythonRunner {
  let port: WorkerPort | null = null
  let ready: Promise<void> | null = null
  let rejectReady: ((error: unknown) => void) | null = null
  let pending: PendingRun | null = null
  let nextId = 0

  function failBoot(error: unknown) {
    port?.terminate()
    port = null
    ready = null
    rejectReady = null
    if (pending) {
      const rejectStarted = pending.rejectStarted
      const reject = pending.reject
      pending = null
      rejectStarted(error)
      reject(error)
    }
  }

  function start(): Promise<void> {
    if (ready) return ready

    const spawned = spawn()
    port = spawned
    ready = new Promise((resolve, reject) => {
      rejectReady = reject
      spawned.onMessage((message) => {
        if (port !== spawned) return
        if (message.type === 'ready') {
          rejectReady = null
          resolve()
          return
        }
        if (message.type === 'started' && pending?.id === message.id) {
          pending.resolveStarted()
          return
        }
        if (message.type === 'failed') {
          failBoot(new Error(message.message))
          reject(new Error(message.message))
          return
        }
        if (message.type === 'result' && pending?.kind === 'run' && pending.id === message.id) {
          if (!isRunResult(message.result)) {
            const rejectRun = pending.reject
            pending = null
            rejectRun(new Error('Python returned an unexpected result.'))
            return
          }
          const resolveRun = pending.resolve
          pending = null
          resolveRun(message.result)
          return
        }
        if (message.type === 'checked' && pending?.kind === 'test' && pending.id === message.id) {
          if (!isTestReport(message.result)) {
            const rejectRun = pending.reject
            pending = null
            rejectRun(new Error('Python returned an unexpected result.'))
            return
          }
          const resolveRun = pending.resolve
          pending = null
          resolveRun(message.result)
        }
      })
      spawned.onError((error) => {
        if (port !== spawned) return
        failBoot(error)
        reject(error)
      })
    })

    return ready
  }

  function request(kind: 'run' | 'test', code: string, tests?: readonly ExerciseCheck[]) {
    const id = ++nextId
    let startedSettled = false
    let resolveStarted!: () => void
    let rejectStarted!: (error: unknown) => void
    const started = new Promise<void>((resolve, reject) => {
      resolveStarted = resolve
      rejectStarted = reject
    })
    started.catch(() => {})

    const result = new Promise<RunResult | TestReport>((resolve, reject) => {
      let settled = false
      pending = {
        id,
        kind,
        resolveStarted: () => {
          if (startedSettled) return
          startedSettled = true
          resolveStarted()
        },
        rejectStarted: (error) => {
          if (startedSettled) return
          startedSettled = true
          rejectStarted(error)
        },
        resolve: (value) => {
          if (settled) return
          settled = true
          resolve(value as RunResult | TestReport)
        },
        reject: (error) => {
          if (settled) return
          settled = true
          reject(error)
        },
      }

      start().then(() => {
        if (pending?.id !== id || port === null) return
        const message: ToWorker = kind === 'run'
          ? { type: 'run', id, code }
          : {
              type: 'check',
              id,
              code,
              tests: (tests ?? []).map(test => ({
                name: test.name,
                expression: test.expression,
                expected: test.expected,
              })),
            }
        port.post(message)
      }).catch((error: unknown) => {
        if (pending?.id !== id) return
        const rejectStartedRun = pending.rejectStarted
        const rejectRun = pending.reject
        pending = null
        rejectStartedRun(error)
        rejectRun(error)
      })
    })
    result.catch(() => {})

    return { started, result }
  }

  return {
    run(code) {
      return request('run', code) as RunHandle
    },

    runTests(code, tests) {
      return request('test', code, tests) as TestHandle
    },

    stop() {
      const error = new RunStopped()
      if (pending) {
        const rejectStarted = pending.rejectStarted
        const reject = pending.reject
        pending = null
        rejectStarted(error)
        reject(error)
      }
      rejectReady?.(error)
      rejectReady = null
      port?.terminate()
      port = null
      ready = null
    },
  }
}
