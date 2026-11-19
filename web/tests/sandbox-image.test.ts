import { execFileSync, spawn } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  couldNotCheck,
  interpretSandboxOutput,
  libraryRefusal,
  printedTooMuch,
  sandboxDockerArgs,
  sandboxImageName,
  sandboxIsolationFlags,
  tookTooLong,
  usedTooMuchMemory,
  type SandboxProcessResult,
  type SandboxReport,
  type SandboxTest,
} from '../server/sandbox'

const imageContext = new URL('../../sandbox/', import.meta.url).pathname
const passed = [{ name: 'value', expression: 'value', expected: '1' }]

function docker(args: readonly string[], stdin?: string): Promise<SandboxProcessResult> {
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
    if (stdin === undefined) child.stdin.end()
    else child.stdin.end(stdin)
  })
}

async function runImage(code: string, tests: readonly SandboxTest[], extras: readonly string[] = []): Promise<SandboxReport> {
  const result = await docker(sandboxDockerArgs(sandboxImageName, extras), JSON.stringify({ code, tests }))
  const report = interpretSandboxOutput(result)
  if (report.outcome === 'refused' && report.message === couldNotCheck) {
    throw new Error(result.stderr || result.stdout || `The sandbox image exited ${result.status}.`)
  }
  return report
}

function dockerIsReady(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
}

describe.skipIf(!dockerIsReady())('sandbox container image', () => {
  const container = `colearner-sandbox-${process.pid}`

  beforeAll(async () => {
    const built = await docker(['build', '-t', sandboxImageName, imageContext])
    if (built.status !== 0) throw new Error(built.stderr || built.stdout)
  }, 300_000)

  afterAll(async () => {
    await docker(['rm', '-f', container])
  })

  it('refuses a library outside the approved list and names it', async () => {
    const report = await runImage('import os\nvalue = 1\n', passed)
    expect(report).toEqual({ outcome: 'refused', message: libraryRefusal('os') })
  }, 60_000)

  it('stops output past 64 KB without recording a pass', async () => {
    const report = await runImage('print("x" * 70000)\nvalue = 1\n', passed)
    expect(report).toEqual({ outcome: 'refused', message: printedTooMuch })
  }, 60_000)

  it('stops a run past 10 seconds without recording a pass', async () => {
    const report = await runImage('while True:\n    pass\nvalue = 1\n', passed)
    expect(report).toEqual({ outcome: 'refused', message: tookTooLong })
  }, 30_000)

  it('stops a run past 512 MB without recording a pass', async () => {
    const report = await runImage('value = bytearray(600 * 1024 * 1024)\n', passed)
    expect(report).toEqual({ outcome: 'refused', message: usedTooMuchMemory })
  }, 60_000)

  it('cannot reach the network, the environment, or the file system', async () => {
    const probe = ['-e', 'SANDBOX_PROBE=1', '-e', 'SECRET_SENTINEL=hunter2']
    const network = await runImage([
      'import socket',
      'reached = False',
      'try:',
      '    s = socket.socket()',
      '    s.settimeout(2)',
      '    s.connect(("1.1.1.1", 80))',
      '    reached = True',
      'except Exception:',
      '    reached = False',
      'value = 1',
    ].join('\n'), [{ name: 'offline', expression: 'reached', expected: 'False' }], probe)
    expect(network).toEqual({
      outcome: 'checked',
      results: [{ name: 'offline', passed: true, expected: 'False', actual: 'False' }],
    })

    const environment = await runImage([
      'import os',
      'seen = "hunter2" in os.environ.get("SECRET_SENTINEL", "")',
      'value = 1',
    ].join('\n'), [{ name: 'hidden', expression: 'seen', expected: 'False' }], probe)
    expect(environment).toEqual({
      outcome: 'checked',
      results: [{ name: 'hidden', passed: true, expected: 'False', actual: 'False' }],
    })

    const filesystem = await runImage([
      'try:',
      '    opened = "root:" in open("/etc/passwd").read()',
      'except Exception:',
      '    opened = False',
      'value = 1',
    ].join('\n'), [{ name: 'closed', expression: 'opened', expected: 'False' }])
    expect(filesystem).toEqual({
      outcome: 'checked',
      results: [{ name: 'closed', passed: true, expected: 'False', actual: 'False' }],
    })
  }, 60_000)

  it('cannot spawn processes without a limit', async () => {
    const report = await runImage([
      'import os, time',
      'spawned = 0',
      'try:',
      '    while spawned < 40:',
      '        pid = os.fork()',
      '        if pid == 0:',
      '            time.sleep(30)',
      '            os._exit(0)',
      '        spawned += 1',
      'except OSError:',
      '    pass',
      'value = 1',
    ].join('\n'), [{ name: 'limited', expression: '0 < spawned < 40', expected: 'True' }], ['-e', 'SANDBOX_PROBE=1'])
    expect(report).toEqual({
      outcome: 'checked',
      results: [{ name: 'limited', passed: true, expected: 'True', actual: 'True' }],
    })
  }, 60_000)

  it('cannot see an earlier student run in the same container', async () => {
    const started = await docker([
      'run', '-d', '--name', container,
      ...sandboxIsolationFlags(),
      '--entrypoint', 'sleep',
      sandboxImageName,
      '120',
    ])
    if (started.status !== 0) throw new Error(started.stderr || started.stdout)

    const first = await docker(
      ['exec', '-i', container, 'python3', '-I', '/opt/sandbox/runner.py'],
      JSON.stringify({
        code: 'open("/tmp/student-marker", "w").write("LEFTOVER_SENTINEL")\nvalue = "wrote"\n',
        tests: [{ name: 'wrote', expression: 'value', expected: 'wrote' }],
      }),
    )
    const second = await docker(
      ['exec', '-i', container, 'python3', '-I', '/opt/sandbox/runner.py'],
      JSON.stringify({
        code: 'try:\n    value = open("/tmp/student-marker").read()\nexcept Exception:\n    value = "gone"\n',
        tests: [{ name: 'gone', expression: 'value', expected: 'gone' }],
      }),
    )
    expect(interpretSandboxOutput(first)).toMatchObject({ outcome: 'checked' })
    expect(interpretSandboxOutput(second)).toEqual({
      outcome: 'checked',
      results: [{ name: 'gone', passed: true, expected: 'gone', actual: 'gone' }],
    })
  }, 60_000)
})
