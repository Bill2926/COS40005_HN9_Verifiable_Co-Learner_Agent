import { readCookie, cookieFile as defaultCookieFile } from './cookie.mjs'

export default class ColearnerTurnProvider {
  constructor(options = {}) {
    this.config = options.config ?? {}
  }

  id() {
    return 'colearner-turn'
  }

  async callApi(prompt, context) {
    const baseUrl = this.config.baseUrl ?? 'http://localhost:3000'
    const cookieFile = this.config.cookieFile ?? defaultCookieFile
    const timeoutMs = this.config.timeoutMs ?? 120_000

    let cookie = process.env.COLEARNER_COOKIE
    if (!cookie) {
      try {
        cookie = await readCookie()
      }
      catch {
        return { error: `No session cookie. Run node capture-session.mjs first (expected ${cookieFile}).` }
      }
    }

    const body = { event: 'message', text: prompt }
    const draft = context?.vars?.draft
    if (typeof draft === 'string' && draft.length > 0) body.draft = draft

    let response
    try {
      response = await fetch(`${baseUrl}/turn`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    }
    catch (error) {
      return { error: `Could not reach ${baseUrl}/turn: ${error instanceof Error ? error.message : String(error)}` }
    }

    const raw = await response.text()
    if (!response.ok) {
      return { error: `HTTP ${response.status} from /turn: ${raw.slice(0, 300)}` }
    }

    const events = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        events.push(JSON.parse(line))
      }
      catch {
        return { error: `The /turn response was not NDJSON: ${line.slice(0, 200)}` }
      }
    }

    const teacher = events
      .filter(event => event.type === 'text' && event.author === 'teacher')
      .map(event => event.delta)
      .join('')
    const deskmate = events
      .filter(event => event.type === 'text' && event.author === 'deskmate')
      .map(event => event.delta)
      .join('')
    const state = [...events].reverse().find(event => event.type === 'state')?.state

    const currentMessage = (author, text) => {
      if (!text) return null
      return [...(state?.conversation ?? [])]
        .reverse()
        .find(message => message.author === author && message.text === text) ?? null
    }
    const teacherMessage = currentMessage('teacher', teacher)
    const deskmateMessage = currentMessage('deskmate', deskmate)

    const output = {
      teacher,
      deskmate,
      teacherLabel: teacherMessage?.role ?? null,
      teacherMove: teacherMessage?.approvedMove ?? null,
      deskmateLabel: deskmateMessage?.role ?? null,
      deskmateMove: deskmateMessage?.approvedMove ?? null,
      moduleId: state?.workingArea?.moduleId ?? null,
      verdicts: (state?.trace?.agents ?? []).map(agent => ({
        agent: agent.agent,
        proposal: agent.proposal,
        scope: agent.scope,
        verdict: agent.verdict,
      })),
    }

    return {
      output: JSON.stringify(output),
      metadata: { eventCount: events.length },
    }
  }
}
