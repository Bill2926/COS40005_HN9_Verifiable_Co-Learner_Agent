import { describe, expect, it } from 'vitest'
import { pythonCourse, type StudyModule } from '../server/course'
import { showsCodeMisconception } from '../server/turn/code-findings'

function module(id: string): StudyModule {
  const found = pythonCourse.studyModules.find(item => item.id === id)
  if (!found) throw new Error(`Module ${id} is missing.`)
  return found
}

function declared(id: string) {
  const declared = module(id).codeMisconception
  if (!declared) throw new Error(`Module ${id} declares no code misconception.`)
  return declared
}

function shows(id: string, code: string): boolean {
  return showsCodeMisconception(code, declared(id))
}

describe('the misconceptions the course declares for submitted code', () => {
  it('gives each of Modules 1 to 5 one misconception, and one its module names', () => {
    const studied = pythonCourse.studyModules
    expect(studied.map(item => item.id)).toEqual([
      'getting_started',
      'variables',
      'strings',
      'conditionals',
      'loops',
    ])
    for (const item of studied) {
      expect(item.codeMisconception).toBeDefined()
      expect(item.misconceptionResponses.map(response => response.id)).toContain(item.codeMisconception?.id)
    }
  })

  it('finds no misconception in any reference solution', () => {
    for (const item of pythonCourse.studyModules) {
      for (const exercise of item.exercises) {
        expect([item.id, exercise.id, shows(item.id, exercise.referenceSolution)])
          .toEqual([item.id, exercise.id, false])
      }
    }
  })

  it('reports text printed or returned without quotes', () => {
    expect(shows('getting_started', 'def hello(name):\n    return Hello, name\n')).toBe(true)
    expect(shows('getting_started', 'print(Goodbye)\n')).toBe(true)
    expect(shows('getting_started', 'def hello(name):\n    print(Hello)\n    return "Hello, " + name\n')).toBe(true)
  })

  it('does not report a quoted greeting, a name it knows, or another module\'s mistake', () => {
    expect(shows('getting_started', 'def hello(name):\n    return "Hello, " + name\n')).toBe(false)
    expect(shows('getting_started', 'name = "An"\nprint(name)\n')).toBe(false)
    expect(shows('getting_started', 'age = input("Age: ")\nprint(age + 1)\n')).toBe(false)
    expect(shows('getting_started', 'for x in ds:\n    s = 0\n    s = s + x\n')).toBe(false)
  })

  it('reports text added to a number', () => {
    expect(shows('variables', 'age = input("Age: ")\nprint(age + 1)\n')).toBe(true)
    expect(shows('variables', 'count = int(input("How many? "))\nprint("Total: " + count)\n')).toBe(true)
    expect(shows('variables', 'print("Total: " + 5)\n')).toBe(true)
  })

  it('does not report text added to text, or a number converted first', () => {
    expect(shows('variables', 'age = int(input("Age: "))\nprint(age + 1)\n')).toBe(false)
    expect(shows('variables', 'name = input("Name: ")\nprint("Hello, " + name)\n')).toBe(false)
    expect(shows('variables', 'def total_cost(price, count):\n    return price * count\n')).toBe(false)
  })

  it('reports three separate branches that each print instead of choosing one', () => {
    expect(shows('conditionals', [
      'def sign_of(number):',
      '    if number > 0:',
      '        print("positive")',
      '    if number < 0:',
      '        print("negative")',
      '    if number == 0:',
      '        print("zero")',
    ].join('\n'))).toBe(true)
  })

  it('does not report branches that return, a chain with elif, or two branches', () => {
    expect(shows('conditionals', [
      'def sign_of(number):',
      '    if number > 0:',
      '        return "positive"',
      '    if number < 0:',
      '        return "negative"',
      '    return "zero"',
    ].join('\n'))).toBe(false)
    expect(shows('conditionals', [
      'def sign_of(number):',
      '    if number > 0:',
      '        print("positive")',
      '    elif number < 0:',
      '        print("negative")',
      '    else:',
      '        print("zero")',
    ].join('\n'))).toBe(false)
    expect(shows('conditionals', [
      'if a:',
      '    print(1)',
      'if b:',
      '    print(2)',
    ].join('\n'))).toBe(false)
  })

  it('reports a running total reset inside its loop', () => {
    expect(shows('loops', 'def total(ds):\n    for x in ds:\n        s = 0\n        s = s + x\n    return s\n')).toBe(true)
    expect(shows('loops', 'def count_even(ds):\n    n = 0\n    for x in ds:\n        n = 0\n        if x % 2 == 0:\n            n += 1\n    return n\n')).toBe(true)
  })

  it('does not report a total created before its loop', () => {
    expect(shows('loops', [
      'def total(ds):',
      '    s = 0',
      '    for x in ds:',
      '        s = s + x',
      '    return s',
    ].join('\n'))).toBe(false)
    expect(shows('loops', 'for x in ds:\n    print(x)\n')).toBe(false)
  })

  it('reports a pass won with sum instead of a loop', () => {
    expect(shows('loops', 'def total(ds):\n    return sum(ds)\n')).toBe(true)
    expect(shows('loops', 'def total(ds):\n    # loop\n    return sum(ds)\n')).toBe(true)
  })

  it('does not report sum when the code also writes the loop', () => {
    expect(shows('loops', 'def count(ds):\n    return sum(1 for x in ds if x % 2 == 0)\n')).toBe(false)
  })

  it('reports a first character read at index one', () => {
    expect(shows('strings', 'def first_character(word):\n    return word[1]\n')).toBe(true)
    expect(shows('strings', 'def first_character(word):\n    return word[1:]\n')).toBe(true)
  })

  it('does not report a first character read at index zero', () => {
    expect(shows('strings', 'def first_character(word):\n    return word[0]\n')).toBe(false)
    expect(shows('strings', 'def shout(word):\n    return word.upper()\n')).toBe(false)
  })
})
