import type { CodeCheck, CodeMisconception } from '../course'

// Reads a submission for the one misconception its module declares. Each check looks for the
// shape that mistake leaves in the source and reports nothing else. Nothing here runs the code:
// the sandbox does that, and a finding is about how the code is written, not only whether its
// tests pass, so a solution that passes with sum instead of a loop is still a finding.

export function showsCodeMisconception(code: string, declared: CodeMisconception): boolean {
  const lines = sourceLines(code)
  return declared.checks.some(check => checks[check](lines))
}

// One source line as written, once its comment is gone, and the same line with
// the contents of its string literals emptied, so a word inside a message is
// never read as code.
interface SourceLine {
  raw: string
  bare: string
}

type Check = (lines: readonly SourceLine[]) => boolean

const checks: Record<CodeCheck, Check> = {
  unquoted_text: unquotedText,
  text_plus_number: textPlusNumber,
  separate_branches: separateBranches,
  accumulator_reset: accumulatorReset,
  sum_instead_of_loop: sumInsteadOfLoop,
  index_from_one: indexFromOne,
}

// A word printed or returned with no quotes, and bound nowhere in the code, is
// text written for a string.
function unquotedText(lines: readonly SourceLine[]): boolean {
  const bound = boundNames(lines.map(line => line.bare))
  return lines.some((line) => {
    const match = /\b(?:print|return)\b\s*\(?\s*([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:,|\)|$)/.exec(line.bare)
    if (!match) return false
    const name = match[1] ?? ''
    return !bound.has(name) && !knownNames.has(name)
  })
}

// Text added to a number: a string literal or an input() call on one side of +,
// and a number literal, int() call or int-bound name on the other.
function textPlusNumber(lines: readonly SourceLine[]): boolean {
  const text: string[] = []
  const numeric: string[] = []
  for (const line of lines) {
    const fromInput = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:str\s*\(\s*)?input\s*\(/.exec(line.raw)
    if (fromInput?.[1]) text.push(escapeForRegExp(fromInput[1]))
    const fromNumber = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:int|float)\s*\(/.exec(line.raw)
    if (fromNumber?.[1]) numeric.push(escapeForRegExp(fromNumber[1]))
  }
  const textSide = ['input\\s*\\(', "'[^']*'", '"[^"]*"', ...text].join('|')
  const numberSide = ['\\d+(?:\\.\\d+)?', 'int\\s*\\(', 'float\\s*\\(', ...numeric].join('|')
  const left = new RegExp(`(?:${textSide})\\s*\\+\\s*(?:${numberSide})`)
  const right = new RegExp(`(?:${numberSide})\\s*\\+\\s*(?:${textSide})`)
  return lines.some(line => left.test(line.raw) || right.test(line.raw))
}

// Three or more if statements at one level, no elif or else, and no branch
// returning: each branch runs on its own instead of the first true one winning.
function separateBranches(lines: readonly SourceLine[]): boolean {
  const code = lines.map(line => line.bare)
  if (code.some(line => /^\s*(?:elif\b|else\s*:)/.test(line))) return false

  const siblings = new Map<number, number[]>()
  const parents = parentLines(code)
  code.forEach((line, index) => {
    if (!/^\s*if\b/.test(line)) return
    const parent = parents[index] ?? -1
    const group = siblings.get(parent) ?? []
    group.push(index)
    siblings.set(parent, group)
  })

  return [...siblings.values()].some((group) => {
    if (group.length < 3) return false
    return group.every(index => !bodyReturns(code, index))
  })
}

// A total set to zero inside the same loop that adds to it: each pass forgets
// the passes before. A reset in an outer loop with the adding in an inner one
// is a per-pass total, not this mistake.
function accumulatorReset(lines: readonly SourceLine[]): boolean {
  const code = lines.map(line => line.bare)
  const enclosing = innermostLoops(code)
  const resets = new Map<number, Set<string>>()
  const additions = new Map<number, Set<string>>()
  code.forEach((line, index) => {
    const loop = enclosing[index] ?? -1
    if (loop < 0) return
    const reset = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*0(?:\.0+)?\s*$/.exec(line)
    if (reset?.[1]) addName(resets, loop, reset[1])
    const addition = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\+=|=)\s*/.exec(line)
    if (!addition?.[1]) return
    const name = addition[1]
    const adds = addition[0].includes('+=')
      || new RegExp(`^\\s*${escapeForRegExp(name)}\\s*=\\s*${escapeForRegExp(name)}\\s*\\+`).test(line)
    if (adds) addName(additions, loop, name)
  })

  return [...resets].some(([loop, names]) => [...names].some(name => additions.get(loop)?.has(name)))
}

// A sum() call in code that writes no loop: the tests may pass, but the loop the
// module teaches was skipped.
function sumInsteadOfLoop(lines: readonly SourceLine[]): boolean {
  const code = lines.map(line => line.bare).join('\n')
  return /\bsum\s*\(/.test(code) && !/\b(?:for|while)\b/.test(code)
}

// A return that reads index one of a word, where the first character is asked
// for: indexing from one instead of zero.
function indexFromOne(lines: readonly SourceLine[]): boolean {
  return lines.some(line => /^\s*return\b/.test(line.bare) && /\[\s*1\s*[:\]]/.test(line.bare))
}

function addName<K>(map: Map<K, Set<string>>, key: K, name: string): void {
  const names = map.get(key) ?? new Set<string>()
  names.add(name)
  map.set(key, names)
}

// The line that opens each statement's block: the nearest earlier line with
// less indentation, or -1 at the top level.
function parentLines(code: readonly string[]): number[] {
  const parents: number[] = []
  const stack: number[] = []
  for (let index = 0; index < code.length; index++) {
    const line = code[index] ?? ''
    if (line.trim().length === 0) {
      parents.push(-1)
      continue
    }
    const indent = leading(line)
    while (stack.length > 0 && leading(code[stack.at(-1) ?? 0] ?? '') >= indent) stack.pop()
    parents.push(stack.at(-1) ?? -1)
    stack.push(index)
  }
  return parents
}

// For a line that opens a block, whether the block's first statement returns or
// raises, so the branches cannot all run.
function bodyReturns(code: readonly string[], index: number): boolean {
  const indent = leading(code[index] ?? '')
  for (let next = index + 1; next < code.length; next++) {
    const line = code[next] ?? ''
    if (line.trim().length === 0) continue
    if (leading(line) <= indent) return false
    return /^\s*(?:return|raise)\b/.test(line)
  }
  return false
}

// The innermost loop each line sits inside, by line index, or -1 outside every loop.
function innermostLoops(code: readonly string[]): number[] {
  const loops: number[] = []
  const stack: { indent: number, loop: number }[] = []
  for (let index = 0; index < code.length; index++) {
    const line = code[index] ?? ''
    if (line.trim().length === 0) {
      loops.push(-1)
      continue
    }
    const indent = leading(line)
    while (stack.length > 0 && indent <= (stack.at(-1)?.indent ?? 0)) stack.pop()
    loops.push(stack.at(-1)?.loop ?? -1)
    if (/^\s*(?:for|while)\b/.test(line)) stack.push({ indent, loop: index })
  }
  return loops
}

// The names the code binds: function parameters, assignment targets, for
// targets, imports and the names a with or except clause introduces.
function boundNames(lines: readonly string[]): Set<string> {
  const bound = new Set<string>()
  for (const line of lines) {
    const parameters = /^\s*def\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)/.exec(line)?.[1]
    if (parameters) {
      for (const part of parameters.split(',')) {
        const name = /^\s*\**([A-Za-z_][A-Za-z0-9_]*)/.exec(part)?.[1]
        if (name) bound.add(name)
      }
    }
    const assigned = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(line)?.[1]
    if (assigned) bound.add(assigned)
    const target = /\bfor\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:,|in\b)/.exec(line)?.[1]
    if (target) bound.add(target)
    const imported = /^\s*(?:from\s+\S+\s+)?import\s+(.+)$/.exec(line)?.[1]
    if (imported) {
      for (const part of imported.split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim()
        if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) bound.add(name)
      }
    }
    const introduced = /\b(?:with|except)\b.*\bas\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(line)?.[1]
    if (introduced) bound.add(introduced)
  }
  return bound
}

// Python's keywords and the builtins a beginner meets, which a bare word may be
// without meaning text was written for a string.
const knownNames = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
  'try', 'while', 'with', 'yield',
  'abs', 'bool', 'dict', 'enumerate', 'filter', 'float', 'input', 'int', 'len', 'list',
  'map', 'max', 'min', 'open', 'print', 'range', 'round', 'self', 'set', 'sorted', 'str',
  'sum', 'tuple', 'type', 'zip',
])

// Each line split into its raw form, comment removed, and its bare form, string
// contents emptied. A triple-quoted block is not code on any of its lines.
function sourceLines(code: string): SourceLine[] {
  const lines: SourceLine[] = []
  let triple: '"""' | "'''" | null = null
  for (const text of code.split('\n')) {
    let rest = text
    let raw = ''
    let bare = ''
    while (rest.length > 0) {
      if (triple) {
        const end = rest.indexOf(triple)
        if (end < 0) break
        rest = rest.slice(end + triple.length)
        triple = null
        continue
      }
      const opener = rest.startsWith('"""') ? '"""' : rest.startsWith("'''") ? "'''" : null
      if (opener) {
        triple = opener
        rest = rest.slice(opener.length)
        raw += ' '
        bare += ' '
        continue
      }
      const char = rest[0] ?? ''
      if (char === '#') break
      if (char === '"' || char === "'") {
        const end = closingQuote(rest, char)
        raw += rest.slice(0, end + 1)
        bare += char + char
        rest = rest.slice(end + 1)
        continue
      }
      raw += char
      bare += char
      rest = rest.slice(1)
    }
    lines.push({ raw: raw.trimEnd(), bare: bare.trimEnd() })
  }
  return lines
}

function closingQuote(text: string, quote: string): number {
  let at = 1
  while (at < text.length) {
    if (text[at] === '\\') {
      at += 2
      continue
    }
    if (text[at] === quote) return at
    at += 1
  }
  return text.length - 1
}

function leading(line: string): number {
  return line.length - line.trimStart().length
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
