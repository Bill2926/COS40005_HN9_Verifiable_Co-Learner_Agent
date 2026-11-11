import { afterEach, describe, expect, it } from 'vitest'
import { forLoopModule } from '../server/content/for-loop'
import { createPythonRunner } from '../server/python/node-runner'
import { RunStopped, type PythonRunner } from '../app/python/runner'

const [sumOfAList, countTheEvenNumbers] = forLoopModule.exercises

const correctSum = [
  'def total(ds):',
  '    s = 0',
  '    for x in ds:',
  '        s = s + x',
  '    return s',
].join('\n')

const correctCount = [
  'def count_even(ds):',
  '    n = 0',
  '    for x in ds:',
  '        if x % 2 == 0:',
  '            n = n + 1',
  '    return n',
].join('\n')

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

  it('passes all three tests for a correct sum of a list', async () => {
    runner = createPythonRunner()

    const check = runner.runTests(correctSum, sumOfAList.tests)

    await expect(check.result).resolves.toEqual({
      results: [
        { name: 'three numbers', passed: true, expected: '6', actual: '6' },
        { name: 'one number', passed: true, expected: '10', actual: '10' },
        { name: 'empty list', passed: true, expected: '0', actual: '0' },
      ],
    })
  }, 120_000)

  it('passes all three tests for a correct count of the even numbers', async () => {
    runner = createPythonRunner()

    const check = runner.runTests(correctCount, countTheEvenNumbers.tests)

    await expect(check.result).resolves.toEqual({
      results: [
        { name: 'two evens', passed: true, expected: '2', actual: '2' },
        { name: 'all even', passed: true, expected: '3', actual: '3' },
        { name: 'none even', passed: true, expected: '0', actual: '0' },
      ],
    })
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
