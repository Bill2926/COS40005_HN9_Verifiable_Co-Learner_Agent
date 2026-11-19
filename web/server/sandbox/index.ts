// The sandbox re-runs a submission. Only its report is evidence. A run in the
// browser is not. The turn tests use a fake. The deployed server invokes the
// Lambda function in Sydney; a machine with no function name runs the image.

export {
  approvedLibraries,
  couldNotCheck,
  libraryRefusal,
  tryAgainInAMoment,
  printedTooMuch,
  sandboxMemoryMb,
  sandboxConcurrency,
  sandboxOutputBytes,
  sandboxSeconds,
  tookTooLong,
  usedTooMuchMemory,
} from './messages'

export interface SandboxTest {
  name: string
  expression: string
  expected: string
}

export interface SandboxTestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
}

export interface SandboxRequest {
  code: string
  tests: readonly SandboxTest[]
}

export type SandboxReport =
  | { outcome: 'checked', results: SandboxTestResult[] }
  | { outcome: 'refused', message: string }

export interface Sandbox {
  check(request: SandboxRequest): Promise<SandboxReport>
}

export function createFakeSandbox(
  report: SandboxReport | ((request: SandboxRequest) => SandboxReport | Promise<SandboxReport>),
): Sandbox {
  return {
    async check(request) {
      const resolved = typeof report === 'function' ? await report(request) : report
      if (resolved.outcome === 'refused') return { outcome: 'refused', message: resolved.message }
      return { outcome: 'checked', results: resolved.results.map(result => ({ ...result })) }
    },
  }
}

export { createContainerSandbox, interpretSandboxOutput, interpretSandboxReport, sandboxDockerArgs, sandboxImageName, sandboxIsolationFlags } from './container'
export type { SandboxProcessResult } from './container'
export { createLambdaSandbox, createSdkInvoke, createSubmissionGate, createSubmissionSandbox } from './lambda'
export type { LambdaInvocation, LambdaInvocationResult, LambdaInvoke, SubmissionGate } from './lambda'
