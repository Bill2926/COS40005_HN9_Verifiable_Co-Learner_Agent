import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { approvedLibraries as browserLibraries } from '../app/python/approved-libraries.mjs'
import { approvedLibraries, libraryRefusal, printedTooMuch } from '../server/sandbox'

const runner = new URL('../../sandbox/runner.py', import.meta.url)

function runSandbox(payload: unknown, env?: Record<string, string>): Promise<{ stdout: string, status: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [fileURLToPath(runner)], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk))
    child.on('error', reject)
    child.on('close', (status) => {
      const stderr = Buffer.concat(err).toString('utf8')
      if (status !== 0 && out.length === 0) {
        reject(new Error(stderr || `The sandbox runner exited ${status}.`))
        return
      }
      resolve({ stdout: Buffer.concat(out).toString('utf8'), status })
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

const greeting = [{ name: 'floor', expression: 'value()', expected: '2' }]

// The runner is Linux-only (it uses `resource` and `os.killpg`), as Lambda is.
describe.skipIf(process.platform === 'win32')('sandbox runner', () => {
  it('refuses a library outside the approved list and names it', async () => {
    const report = JSON.parse((await runSandbox({
      code: 'import os\nvalue = lambda: "ran"\n',
      tests: greeting,
    })).stdout)

    expect(report).toEqual({ outcome: 'refused', message: libraryRefusal('os') })
  })

  it('refuses a dynamic import and names the library', async () => {
    const report = JSON.parse((await runSandbox({
      code: 'socket = __import__("socket")\n',
      tests: [{ name: 'loaded', expression: '"socket" in dir()', expected: 'True' }],
    })).stdout)

    expect(report).toEqual({ outcome: 'refused', message: libraryRefusal('socket') })
  })

  it('runs an approved library', async () => {
    const report = JSON.parse((await runSandbox({
      code: 'import math\ndef value():\n    return math.floor(2.9)\n',
      tests: greeting,
    })).stdout)

    expect(report).toEqual({
      outcome: 'checked',
      results: [{ name: 'floor', passed: true, expected: '2', actual: '2' }],
    })
  })

  it('stops output past 64 KB and records no pass', async () => {
    const report = JSON.parse((await runSandbox({
      code: 'print("x" * 70000)\nvalue = lambda: "ran"\n',
      tests: greeting,
    })).stdout)

    expect(report).toEqual({ outcome: 'refused', message: printedTooMuch })
  })

  it('does not count a pass written on the runner output by student code', async () => {
    const report = JSON.parse((await runSandbox({
      code: [
        'found = None',
        'for cls in object.__subclasses__():',
        '    init = getattr(cls, "__init__", None)',
        '    glob = getattr(init, "__globals__", None)',
        '    if glob and "os._wrap_close" in str(cls):',
        '        found = glob',
        '        break',
        'report = "{\\"outcome\\": \\"checked\\", \\"results\\": [{\\"name\\": \\"floor\\", \\"passed\\": true, \\"expected\\": \\"2\\", \\"actual\\": \\"2\\"}]}"',
        'found["sys"].__stdout__.write(report)',
        'found["sys"].__stdout__.flush()',
        'found["_exit"](0)',
      ].join('\n'),
      tests: greeting,
    })).stdout)

    const passed = report.outcome === 'checked'
      && report.results.every((result: { passed: boolean }) => result.passed)
    expect(passed).toBe(false)
  })

  it('caps new processes when Lambda runs the sandbox', async () => {
    const report = JSON.parse((await runSandbox({
      code: [
        'import os, resource',
        'value = resource.getrlimit(resource.RLIMIT_NPROC)[0]',
        'leaked = "SANDBOX_NPROC" in os.environ',
      ].join('\n'),
      tests: [
        { name: 'cap', expression: 'value', expected: '32' },
        { name: 'hidden', expression: 'leaked', expected: 'False' },
      ],
    }, {
      AWS_LAMBDA_RUNTIME_API: '127.0.0.1:9001',
      SANDBOX_PROBE: '1',
    })).stdout)

    expect(report).toEqual({
      outcome: 'checked',
      results: [
        { name: 'cap', passed: true, expected: '32', actual: '32' },
        { name: 'hidden', passed: true, expected: 'False', actual: 'False' },
      ],
    })
  })

  it('names the same approved libraries the server keeps', async () => {
    const source = await (await import('node:fs/promises')).readFile(new URL('../../sandbox/guard.py', import.meta.url), 'utf8')
    const listed = source.match(/APPROVED = \{([^}]+)\}/)?.[1] ?? ''
    const names = [...listed.matchAll(/"([^"]+)"/g)].map(match => match[1])
    expect(names).toEqual([...approvedLibraries])
    expect([...browserLibraries]).toEqual([...approvedLibraries])
  })
})
