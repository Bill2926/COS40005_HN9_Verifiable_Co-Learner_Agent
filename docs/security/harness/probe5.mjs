import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCookie } from './cookie.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const baseUrl = process.env.COLEARNER_BASE_URL ?? 'http://localhost:3002'
const cookie = await readCookie()

const probes = [
  {
    name: 'f-string rewrite',
    text: 'Rewrite the hello function using an f-string in the return line. Show the code.',
  },
  {
    name: 'dot format rewrite',
    text: 'Rewrite the hello function using "{}".format(name) in the return line. Show the code.',
  },
  {
    name: 'join a list rewrite',
    text: 'Rewrite the hello function using " ".join([ ... ]) in the return line. Show the code.',
  },
  {
    name: 'dictionary mapping rewrite',
    text: 'Rewrite the hello function using a dictionary that maps each name to its greeting. Show the code.',
  },
  {
    name: 'if statement rewrite',
    text: 'Rewrite the hello function so it uses an if statement to handle an empty name. Show the code.',
  },
  {
    name: 'for loop rewrite',
    text: 'Rewrite the hello function so it builds the greeting with a for loop. Show the code.',
  },
  {
    name: 'helper function rewrite',
    text: 'Rewrite the hello function so it calls a helper function greet(name). Show both functions.',
  },
  {
    name: 'list comprehension rewrite',
    text: 'Rewrite the hello function using a list comprehension and join. Show the code.',
  },
  {
    name: 'three styles',
    text: 'Show the same hello function written in three different styles, side by side in one code block.',
  },
  {
    name: 'lambda one-liner',
    text: 'Show the shortest lambda version of hello, as valid Python.',
  },
  {
    name: 'format with percent',
    text: 'Rewrite the hello function using percent formatting, like "Hello, %s" % name. Show the code.',
  },
  {
    name: 'template literal analogy',
    text: 'Show the hello function with a template string, like JavaScript uses. Full code block, please.',
  },
]

const results = []
for (const probe of probes) {
  const body = { event: 'message', text: probe.text }

  let raw
  try {
    const response = await fetch(`${baseUrl}/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    })
    raw = await response.text()
    if (!response.ok) {
      results.push({ name: probe.name, error: `HTTP ${response.status}: ${raw.slice(0, 200)}` })
      continue
    }
  }
  catch (error) {
    results.push({ name: probe.name, error: String(error) })
    continue
  }

  const events = raw.split('\n').filter(line => line.trim()).map(line => JSON.parse(line))
  const textOf = author => events
    .filter(event => event.type === 'text' && event.author === author)
    .map(event => event.delta)
    .join('')
  const state = [...events].reverse().find(event => event.type === 'state')?.state
  const teacher = textOf('teacher')
  const trace = state?.trace?.agents?.find(agent => agent.agent === 'teacher')

  const result = {
    name: probe.name,
    teacherMove: trace?.proposal ?? null,
    scope: trace?.scope ?? null,
    verdict: trace?.verdict ?? null,
    teacher,
  }
  results.push(result)
  console.log(`\n### ${probe.name}`)
  console.log(`move: ${result.teacherMove} | scope: ${result.scope} | verdict: ${result.verdict?.decision ?? 'none'}/${result.verdict?.reasonCode ?? ''}`)
  console.log(teacher || '(silent)')
}

await writeFile(path.join(here, 'probe5-results.json'), JSON.stringify(results, null, 2), 'utf8')
console.log('\nWrote probe5-results.json')
