// The learning pattern: where the student's work says they struggle and how they
// study. One pure function of the student's records in one course, nothing else:
// the same records always give the same pattern. Nothing here writes anything or
// moves mastery; a snapshot goes on each decision for audit, and the student sees
// the weak spots in plain words.

export interface WeakSpot {
  misconceptionId: string
  count: number
  lastSeen: string
}

export interface RecurringError {
  kind: string
  count: number
}

export interface ExerciseAttempts {
  exerciseId: string
  attempts: number
  passed: boolean
}

export interface ModuleHintRungs {
  moduleId: string
  rungs: readonly number[]
}

export interface ModuleMaterialsSeconds {
  moduleId: string
  seconds: number
}

export interface LearningPattern {
  weakSpots: readonly WeakSpot[]
  recurringErrors: readonly RecurringError[]
  exerciseAttempts: readonly ExerciseAttempts[]
  hintRungs: readonly ModuleHintRungs[]
  materialsSeconds: readonly ModuleMaterialsSeconds[]
}

// The records the pattern reads, in the shapes the stores hand over: one entry
// per sandbox-checked submission, per submission evidence row, per wrong quiz
// answer that names a misconception, per activity event and per decision.
export interface LearningPatternRecords {
  evidence: readonly {
    time: string
    exerciseId: string
    allPassed: boolean
  }[]
  submissions: readonly {
    time: string
    moduleId: string
    exerciseId: string
    outcome: 'passed' | 'failed' | 'refused'
    findings: readonly string[]
  }[]
  quizAnswers: readonly {
    time: string
    moduleId: string
    misconceptionId: string
  }[]
  activity: readonly {
    time: string
    type: string
    moduleId: string | null
    payload: Record<string, unknown>
  }[]
  decisions: readonly {
    moduleId: string | null
    ruledMove: string | null
  }[]
}

export function learningPattern(records: LearningPatternRecords): LearningPattern {
  return {
    weakSpots: weakSpots(records),
    recurringErrors: recurringErrors(records),
    exerciseAttempts: exerciseAttempts(records.evidence),
    hintRungs: hintRungs(records.decisions),
    materialsSeconds: materialsSeconds(records.activity),
  }
}

// A misconception the submissions' findings or the wrong quiz answers keep
// meeting. Each sighting counts once; the last one seen decides the recency.
function weakSpots(records: LearningPatternRecords): WeakSpot[] {
  const sightings = new Map<string, { count: number, lastSeen: string }>()
  const seen = (id: string, time: string) => {
    const spot = sightings.get(id) ?? { count: 0, lastSeen: time }
    spot.count += 1
    if (Date.parse(time) >= Date.parse(spot.lastSeen)) spot.lastSeen = time
    sightings.set(id, spot)
  }
  for (const submission of records.submissions) {
    for (const id of submission.findings) seen(id, submission.time)
  }
  for (const answer of records.quizAnswers) seen(answer.misconceptionId, answer.time)
  return [...sightings]
    .map(([misconceptionId, spot]) => ({ misconceptionId, ...spot }))
    .sort((left, right) => right.count - left.count || compare(left.misconceptionId, right.misconceptionId))
}

// The kinds of error that recur: a run that stopped, errored (under the name the
// browser reported) or failed its tests, and a submission that failed its tests.
function recurringErrors(records: LearningPatternRecords): RecurringError[] {
  const counts = new Map<string, number>()
  const count = (kind: string) => counts.set(kind, (counts.get(kind) ?? 0) + 1)
  for (const event of records.activity) {
    if (event.type !== 'run_finished') continue
    const outcome = typeof event.payload.outcome === 'string' ? event.payload.outcome : null
    if (outcome === 'completed' || outcome === null) continue
    const errorType = typeof event.payload.errorType === 'string' ? event.payload.errorType : null
    count(errorType ?? outcome)
  }
  for (const submission of records.submissions) {
    if (submission.outcome === 'failed') count('failed')
  }
  return [...counts]
    .map(([kind, total]) => ({ kind, count: total }))
    .sort((left, right) => right.count - left.count || compare(left.kind, right.kind))
}

// The verified attempts an exercise took to pass: every evidence row up to the
// first pass. Rows after the first pass are practice, not attempts.
function exerciseAttempts(
  evidence: readonly { time: string, exerciseId: string, allPassed: boolean }[],
): ExerciseAttempts[] {
  const ordered = [...evidence].sort((left, right) =>
    Date.parse(left.time) - Date.parse(right.time) || compare(left.exerciseId, right.exerciseId))
  const attempts = new Map<string, { attempts: number, passed: boolean }>()
  for (const row of ordered) {
    const tally = attempts.get(row.exerciseId) ?? { attempts: 0, passed: false }
    if (!tally.passed) {
      tally.attempts += 1
      if (row.allPassed) tally.passed = true
    }
    attempts.set(row.exerciseId, tally)
  }
  return [...attempts]
    .map(([exerciseId, tally]) => ({ exerciseId, ...tally }))
    .sort((left, right) => compare(left.exerciseId, right.exerciseId))
}

// The hint rungs a module has used, read back from the decisions the VerifyShield
// approved there. Only a hint move is a rung; anything else is ignored.
function hintRungs(
  decisions: readonly { moduleId: string | null, ruledMove: string | null }[],
): ModuleHintRungs[] {
  const rungs = new Map<string, Set<number>>()
  for (const decision of decisions) {
    if (!decision.moduleId) continue
    const rung = /^hint_level_(\d)$/.exec(decision.ruledMove ?? '')?.[1]
    if (!rung) continue
    const set = rungs.get(decision.moduleId) ?? new Set<number>()
    set.add(Number(rung))
    rungs.set(decision.moduleId, set)
  }
  return [...rungs]
    .map(([moduleId, set]) => ({ moduleId, rungs: [...set].sort((left, right) => left - right) }))
    .sort((left, right) => compare(left.moduleId, right.moduleId))
}

// Time on materials per module: each module_opened starts a stretch on that
// module's materials, a mode_switched away from materials or another
// module_opened ends it. A stretch back to materials belongs to the module that
// is open. The last stretch ends at the last event, so no clock is needed.
function materialsSeconds(
  activity: readonly { time: string, type: string, moduleId: string | null, payload: Record<string, unknown> }[],
): ModuleMaterialsSeconds[] {
  const ordered = [...activity]
    .map((event, index) => ({ event, index }))
    .sort((left, right) => Date.parse(left.event.time) - Date.parse(right.event.time) || left.index - right.index)
  const seconds = new Map<string, number>()
  const add = (moduleId: string, from: string, to: string) => {
    const span = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
    seconds.set(moduleId, (seconds.get(moduleId) ?? 0) + span)
  }

  let openModule: string | null = null
  let onMaterialsSince: string | null = null
  for (const { event } of ordered) {
    if (event.type === 'module_opened') {
      if (onMaterialsSince && openModule) add(openModule, onMaterialsSince, event.time)
      openModule = event.moduleId
      onMaterialsSince = event.moduleId ? event.time : null
      continue
    }
    if (event.type !== 'mode_switched') continue
    const mode = typeof event.payload.mode === 'string' ? event.payload.mode : null
    if (mode === 'materials') {
      if (openModule && !onMaterialsSince) onMaterialsSince = event.time
      continue
    }
    if (onMaterialsSince && openModule) {
      add(openModule, onMaterialsSince, event.time)
      onMaterialsSince = null
    }
  }
  const last = ordered.at(-1)?.event.time
  if (onMaterialsSince && openModule && last) add(openModule, onMaterialsSince, last)

  return [...seconds]
    .map(([moduleId, total]) => ({ moduleId, seconds: total }))
    .filter(item => item.seconds > 0)
    .sort((left, right) => compare(left.moduleId, right.moduleId))
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
