import { spawn } from 'node:child_process'
import { couldNotCheck, sandboxMemoryMb, usedTooMuchMemory } from './messages'
import type { Sandbox, SandboxReport, SandboxTestResult } from './index'

export const sandboxImageName = 'colearner-sandbox'

export interface SandboxProcessResult {
  stdout: string
  stderr: string
  status: number | null
  signal: NodeJS.Signals | null
}

export function sandboxIsolationFlags(): string[] {
  return [
    '--network', 'none',
    '--read-only',
    // mode 1777: the jailed user is nobody, and a tmpfs otherwise belongs to root.
    '--tmpfs', '/opt/jail/tmp:rw,nosuid,mode=1777,size=64m',
    '--tmpfs', '/tmp:rw,nosuid,mode=1777,size=16m',
    '--memory', `${sandboxMemoryMb}m`,
    '--memory-swap', `${sandboxMemoryMb}m`,
    // Enough for the runner and the student process, not enough for an unlimited fork.
    '--pids-limit', '32',
    '--security-opt', 'no-new-privileges',
  ]
}

export function sandboxDockerArgs(image: string, extras: readonly string[] = []): string[] {
  return ['run', '--rm', '-i', ...sandboxIsolationFlags(), ...extras, image]
}

export function interpretSandboxOutput(result: Pick<SandboxProcessResult, 'stdout' | 'status' | 'signal'>): SandboxReport {
  if (result.signal === 'SIGKILL' || result.status === 137) {
    return { outcome: 'refused', message: usedTooMuchMemory }
  }
  const text = result.stdout.trim()
  if (!text) return { outcome: 'refused', message: couldNotCheck }
  try {
    const parsed = JSON.parse(text) as unknown
    if (isReport(parsed)) return parsed
  }
  catch {
    return { outcome: 'refused', message: couldNotCheck }
  }
  return { outcome: 'refused', message: couldNotCheck }
}

export function createContainerSandbox(options?: {
  image?: string
  run?: (args: readonly string[], stdin: string) => Promise<SandboxProcessResult>
}): Sandbox {
  const image = options?.image || sandboxImageName
  const run = options?.run ?? runDocker
  return {
    async check(request) {
      try {
        const result = await run(sandboxDockerArgs(image), JSON.stringify({
          code: request.code,
          tests: request.tests.map(test => ({
            name: test.name,
            expression: test.expression,
            expected: test.expected,
          })),
        }))
        return interpretSandboxOutput(result)
      }
      catch {
        return { outcome: 'refused', message: couldNotCheck }
      }
    },
  }
}

function runDocker(args: readonly string[], stdin: string): Promise<SandboxProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('error', reject)
    child.on('close', (status, signal) => {
      resolve({
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        status,
        signal,
      })
    })
    child.stdin.end(stdin)
  })
}

function isReport(value: unknown): value is SandboxReport {
  if (typeof value !== 'object' || value === null || !('outcome' in value)) return false
  const record = value as { outcome?: unknown, message?: unknown, results?: unknown }
  if (record.outcome === 'refused') return typeof record.message === 'string' && record.message.length > 0
  if (record.outcome !== 'checked' || !Array.isArray(record.results)) return false
  return record.results.every(isTestResult)
}

function isTestResult(value: unknown): value is SandboxTestResult {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string'
    && typeof record.passed === 'boolean'
    && typeof record.expected === 'string'
    && typeof record.actual === 'string'
}
