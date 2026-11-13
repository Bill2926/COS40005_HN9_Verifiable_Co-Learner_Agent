import { afterEach, describe, expect, it } from 'vitest'
import { RunStopped, type PythonRunner } from '../app/python/runner'
import { studyModule, studyModules } from '../server/course'
import { createPythonRunner } from '../server/python/node-runner'

const loops = studyModule('loops')
if (!loops) throw new Error('Module 5 is missing.')
const sumOfAList = loops.exercises[0]

const accumulatorReset = [
  'def total(ds):',
  '    s = 0',
  '    for x in ds:',
  '        s = 0',
  '        s = s + x',
  '    return s',
].join('\n')

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

  it('passes every exercise when the reference solution is submitted', async () => {
    runner = createPythonRunner()

    for (const module of studyModules) {
      for (const exercise of module.exercises) {
        const check = runner.runTests(exercise.referenceSolution, exercise.tests)
        const report = await check.result
        expect(report.results, `${module.id} ${exercise.id}`).toEqual(
          exercise.tests.map(test => ({
            name: test.name,
            passed: true,
            expected: test.expected,
            actual: test.expected,
          })),
        )
      }
    }
  }, 120_000)

  it('fails the sum tests when the total is reset inside the loop', async () => {
    runner = createPythonRunner()

    const check = runner.runTests(accumulatorReset, sumOfAList.tests)

    await expect(check.result).resolves.toEqual({
      results: [
        { name: 'three numbers', passed: false, expected: '6', actual: '3' },
        { name: 'one number', passed: true, expected: '10', actual: '10' },
        { name: 'empty list', passed: true, expected: '0', actual: '0' },
      ],
    })
  }, 120_000)
})
