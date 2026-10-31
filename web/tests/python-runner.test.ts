import { afterEach, describe, expect, it } from 'vitest'
import { createPythonRunner } from '../server/python/node-runner'
import { RunStopped, type PythonRunner } from '../app/python/runner'

describe('python runner', () => {
  let runner: PythonRunner | undefined

  afterEach(() => {
    runner?.stop()
  })

  it('returns printed stdout and stderr', async () => {
    runner = createPythonRunner()

    const run = runner.run([
      'import sys',
      'print("hello")',
      'print("warn", file=sys.stderr)',
    ].join('\n'))

    await expect(run.result).resolves.toEqual({
      stdout: 'hello\n',
      stderr: 'warn\n',
      error: null,
    })
  }, 120_000)

  it('returns the line of a runtime error', async () => {
    runner = createPythonRunner()

    const run = runner.run([
      'print("before")',
      'bad = 1 / 0',
      'print("after")',
    ].join('\n'))

    await expect(run.result).resolves.toEqual({
      stdout: 'before\n',
      stderr: '',
      error: {
        message: 'ZeroDivisionError: division by zero',
        line: 2,
      },
    })
  }, 120_000)

  it('returns the line of a syntax error', async () => {
    runner = createPythonRunner()

    const run = runner.run([
      'print("before")',
      'def =',
      'print("after")',
    ].join('\n'))

    await expect(run.result).resolves.toEqual({
      stdout: '',
      stderr: '',
      error: {
        message: 'SyntaxError: invalid syntax',
        line: 2,
      },
    })
  }, 120_000)

  it('stops a running program and runs again', async () => {
    runner = createPythonRunner()

    const hanging = runner.run('while True:\n    pass\n')
    expect(hanging.started).toBeInstanceOf(Promise)
    await hanging.started
    runner.stop()

    await expect(hanging.result).rejects.toBeInstanceOf(RunStopped)

    const again = runner.run('print("again")')
    await expect(again.result).resolves.toEqual({
      stdout: 'again\n',
      stderr: '',
      error: null,
    })
  }, 120_000)
})
