// The study suggestion: the one next step the student is shown, chosen by fixed
// rules over their activity log for the current course. Nothing is stored but
// the student's dismissals, the language model never chooses, and the log is not
// evidence: nothing here changes mastery, an unlock or the roadmap.
import type { ActivityRow } from '../activity-recorder'
import type { Course } from '../course'
import { canonicalModuleId } from '../course'
import type { StudySuggestionAction, StudySuggestionView } from '../../shared/turn'

// A student's paste of at least this many characters is a pasted solution.
const pastedSolutionCharacters = 40
// The runs, failed submissions, runs without a submission and module openings that make a pattern.
const patternSize = 3
const failedSubmissionsInARow = 2

export interface StudyStep {
  // The situation, module, exercise and error type: the same step in a later episode has the same identity.
  identity: string
  // The id of the activity row this episode is anchored on.
  anchor: number
  sentence: string
  button: string
  action: StudySuggestionAction
  // The module the step names, which the VerifyShield holds the Teacher to.
  moduleId: string
}

export interface StudyStepInput {
  course: Pick<Course, 'id' | 'modules' | 'studyModules'>
  rows: readonly ActivityRow[]
  // Where the student is now.
  currentModuleId: string
  currentExerciseId: string
  unlockedModuleIds: readonly string[]
}

// What the student is shown: the step, unless this episode of it was dismissed.
// A dismissed step is not replaced by the next situation.
export function visibleStudySuggestion(step: StudyStep | null, dismissed: ReadonlyMap<string, number>): StudySuggestionView | null {
  if (!step || dismissed.get(step.identity) === step.anchor) return null
  return { key: studySuggestionKey(step), sentence: step.sentence, button: step.button, action: step.action }
}

export function studySuggestionKey(step: Pick<StudyStep, 'identity' | 'anchor'>): string {
  return `${step.identity}@${step.anchor}`
}

interface Entry {
  id: number
  type: ActivityRow['type']
  moduleId: string | null
  exerciseId: string | null
  payload: Record<string, unknown>
}

// One situation that is true: where it is, and the row its episode is anchored on.
interface Candidate {
  moduleId: string
  exerciseId?: string
  errorType?: string
  anchor: number
}

interface Situation {
  name: string
  find: (log: Log) => Candidate[]
  say: (log: Log, candidate: Candidate) => { sentence: string, button: string, action: StudySuggestionAction } | null
}

export function chooseStudyStep(input: StudyStepInput): StudyStep | null {
  const log = new Log(input)
  for (const situation of situations) {
    const found = situation.find(log)
      .filter(candidate => input.unlockedModuleIds.includes(candidate.moduleId))
      .sort((a, b) => b.anchor - a.anchor)
    for (const candidate of found) {
      const said = situation.say(log, candidate)
      if (!said) continue
      return {
        identity: [situation.name, candidate.moduleId, candidate.exerciseId ?? '', candidate.errorType ?? ''].join('|'),
        anchor: candidate.anchor,
        moduleId: said.action.moduleId,
        ...said,
      }
    }
  }
  return null
}

class Log {
  readonly entries: Entry[]
  readonly input: StudyStepInput
  private readonly moduleOfExercise = new Map<string, string>()

  constructor(input: StudyStepInput) {
    this.input = input
    for (const module of input.course.studyModules) {
      for (const exercise of module.exercises) this.moduleOfExercise.set(exercise.id, module.id)
    }
    this.entries = this.read(input.rows)
  }

  // The course's rows in the log's order, each with the module it belongs to. A row with no
  // module of its own (a mode or layout switch) belongs to the module the student was in.
  private read(rows: readonly ActivityRow[]): Entry[] {
    const entries: Entry[] = []
    let inModule: string | null = null
    for (const row of rows) {
      if (row.courseId !== this.input.course.id) continue
      if (!relevantTypes.has(row.type)) continue
      const exerciseId = typeof row.payload.exerciseId === 'string' ? row.payload.exerciseId : null
      const named = typeof row.payload.moduleId === 'string' ? canonicalModuleId(row.payload.moduleId) : null
      if (exerciseId !== null && !this.moduleOfExercise.has(exerciseId)) continue
      if (named !== null && !this.isStudyModule(named)) continue
      const moduleId = named ?? (exerciseId ? this.moduleOfExercise.get(exerciseId) ?? null : null)
      if (moduleId !== null) inModule = moduleId
      entries.push({
        id: row.id,
        type: row.type,
        moduleId: moduleId ?? (row.type === 'mode_switched' || row.type === 'layout_switched' ? inModule : null),
        exerciseId,
        payload: row.payload,
      })
    }
    return entries
  }

  isStudyModule(moduleId: string): boolean {
    return this.input.course.studyModules.some(module => module.id === moduleId)
  }

  moduleName(moduleId: string): string {
    return this.input.course.modules.find(module => module.id === moduleId)?.name ?? moduleId
  }

  exercisesOf(moduleId: string): readonly { id: string, title: string }[] {
    return this.input.course.studyModules.find(module => module.id === moduleId)?.exercises ?? []
  }

  exerciseTitle(exerciseId: string): string {
    const owner = this.moduleOfExercise.get(exerciseId)
    return this.exercisesOf(owner ?? '').find(exercise => exercise.id === exerciseId)?.title ?? exerciseId
  }

  of(type: ActivityRow['type'], where: (entry: Entry) => boolean = () => true): Entry[] {
    return this.entries.filter(entry => entry.type === type && where(entry))
  }

  // The rows of one exercise after the last full pass of it, which ends every earlier episode.
  afterLastFullPass(exerciseId: string): Entry[] {
    const lastPass = this.entries.findLastIndex(entry => isFullPass(entry) && entry.exerciseId === exerciseId)
    return this.entries.slice(lastPass + 1).filter(entry => entry.exerciseId === exerciseId)
  }

  hasFullPass(exerciseId: string): boolean {
    return this.entries.some(entry => isFullPass(entry) && entry.exerciseId === exerciseId)
  }

  // The module's first exercise the student has not fully passed, or null when every one is passed.
  firstUnfinished(moduleId: string): string | null {
    return this.exercisesOf(moduleId).find(exercise => !this.hasFullPass(exercise.id))?.id ?? null
  }
}

const relevantTypes = new Set<ActivityRow['type']>([
  'module_opened',
  'mode_switched',
  'layout_switched',
  'code_run',
  'run_finished',
  'pasted',
  'went_idle',
  'returned',
  'submitted',
  'quiz_answered',
  'message_sent',
])

function passed(entry: Entry): number {
  return typeof entry.payload.testsPassed === 'number' ? entry.payload.testsPassed : 0
}

function total(entry: Entry): number {
  return typeof entry.payload.testsTotal === 'number' ? entry.payload.testsTotal : 0
}

function isFullPass(entry: Entry): boolean {
  return entry.type === 'submitted' && total(entry) > 0 && passed(entry) === total(entry)
}

function practiceOn(moduleId: string, exerciseId: string | null, sentence: string, button: string) {
  if (exerciseId === null) return null
  return { sentence, button, action: { kind: 'practice', moduleId, exerciseId } satisfies StudySuggestionAction }
}

function perExercise(log: Log, find: (exerciseId: string, moduleId: string) => Candidate | null): Candidate[] {
  return log.input.course.studyModules.flatMap(module =>
    module.exercises.flatMap((exercise) => {
      const found = find(exercise.id, module.id)
      return found ? [found] : []
    }))
}

function perModule(log: Log, find: (moduleId: string) => Candidate | null): Candidate[] {
  return log.input.course.studyModules.flatMap((module) => {
    const found = find(module.id)
    return found ? [found] : []
  })
}

// Highest first. Each finds where it is true now; the rules pick the first that is.
const situations: readonly Situation[] = [
  {
    // 1. Passed on the first submission after pasting a solution, never having read the Learn materials.
    name: 'pasted_pass',
    find: log => perExercise(log, (exerciseId, moduleId) => {
      const first = log.of('submitted', entry => entry.exerciseId === exerciseId)[0]
      if (!first || !isFullPass(first)) return null
      const pasted = log.of('pasted', entry => entry.exerciseId === exerciseId && entry.id < first.id
        && typeof entry.payload.characters === 'number' && entry.payload.characters >= pastedSolutionCharacters)
      if (pasted.length === 0) return null
      if (log.of('mode_switched', entry => entry.moduleId === moduleId && entry.payload.mode === 'learn').length > 0) return null
      return { moduleId, exerciseId, anchor: first.id }
    }),
    say: (log, { moduleId }) => ({
      sentence: `Read the Learn materials for ${log.moduleName(moduleId)} before you go on.`,
      button: 'Read the materials',
      action: { kind: 'learn', moduleId },
    }),
  },
  {
    // 2. Three runs that failed with the same error type.
    name: 'repeated_error',
    find: log => perExercise(log, (exerciseId, moduleId) => {
      const errors = new Map<string, Entry[]>()
      for (const entry of log.afterLastFullPass(exerciseId)) {
        if (entry.type !== 'run_finished' || entry.payload.outcome !== 'error' || typeof entry.payload.errorType !== 'string') continue
        errors.set(entry.payload.errorType, [...errors.get(entry.payload.errorType) ?? [], entry])
      }
      const reached = [...errors].flatMap(([errorType, runs]) => runs.length >= patternSize ? [{ errorType, anchor: runs[patternSize - 1]!.id }] : [])
      const latest = reached.sort((a, b) => b.anchor - a.anchor)[0]
      return latest ? { moduleId, exerciseId, ...latest } : null
    }),
    say: (log, { moduleId, exerciseId, errorType }) => practiceOn(
      moduleId,
      exerciseId ?? null,
      `Stay on ${log.exerciseTitle(exerciseId ?? '')}. Your runs keep ending in a ${errorType}.`,
      'Stay here',
    ),
  },
  {
    // 3. Two submissions that did not pass every test.
    name: 'repeated_failed_submission',
    find: log => perExercise(log, (exerciseId, moduleId) => {
      const failed = log.afterLastFullPass(exerciseId).filter(entry => entry.type === 'submitted')
      return failed.length >= failedSubmissionsInARow ? { moduleId, exerciseId, anchor: failed[failedSubmissionsInARow - 1]!.id } : null
    }),
    say: (log, { moduleId, exerciseId }) => practiceOn(
      moduleId,
      exerciseId ?? null,
      `Stay on ${log.exerciseTitle(exerciseId ?? '')} and look at the tests that failed.`,
      'Stay here',
    ),
  },
  {
    // 4. One submission that passed some tests and not all.
    name: 'partial_submission',
    find: log => perExercise(log, (exerciseId, moduleId) => {
      const failed = log.afterLastFullPass(exerciseId).filter(entry => entry.type === 'submitted')
      const only = failed.length === 1 ? failed[0]! : null
      return only && passed(only) > 0 && passed(only) < total(only) ? { moduleId, exerciseId, anchor: only.id } : null
    }),
    say: (log, { moduleId, exerciseId }) => practiceOn(
      moduleId,
      exerciseId ?? null,
      `Stay on ${log.exerciseTitle(exerciseId ?? '')} and finish the tests that failed.`,
      'Stay here',
    ),
  },
  {
    // 5. Three runs and no submission after the first of them.
    name: 'runs_without_submission',
    find: log => perExercise(log, (exerciseId, moduleId) => {
      const lastSubmission = log.entries.findLastIndex(entry => entry.type === 'submitted' && entry.exerciseId === exerciseId)
      const runs = log.entries.slice(lastSubmission + 1).filter(entry => entry.type === 'code_run' && entry.exerciseId === exerciseId)
      return runs.length >= patternSize ? { moduleId, exerciseId, anchor: runs[patternSize - 1]!.id } : null
    }),
    say: (log, { moduleId, exerciseId }) => practiceOn(
      moduleId,
      exerciseId ?? null,
      `Submit ${log.exerciseTitle(exerciseId ?? '')} so it can be checked.`,
      'Go to the exercise',
    ),
  },
  {
    // 6. A message on a module with no run and no submission.
    name: 'asked_first',
    find: log => perModule(log, (moduleId) => {
      const worked = log.entries.some(entry => entry.moduleId === moduleId && (entry.type === 'code_run' || entry.type === 'submitted'))
      const asked = log.of('message_sent', entry => entry.moduleId === moduleId)[0]
      return asked && !worked ? { moduleId, anchor: asked.id } : null
    }),
    say: (log, { moduleId }) => practiceOn(
      moduleId,
      log.firstUnfinished(moduleId),
      `Try running or submitting an exercise in ${log.moduleName(moduleId)} before asking.`,
      'Try an exercise',
    ),
  },
  {
    // 7. Quiz answers and no exercise of the module passed.
    name: 'quiz_only',
    find: log => perModule(log, (moduleId) => {
      const answered = log.of('quiz_answered', entry => entry.moduleId === moduleId)[0]
      const passedAny = log.exercisesOf(moduleId).some(exercise => log.hasFullPass(exercise.id))
      return answered && !passedAny ? { moduleId, anchor: answered.id } : null
    }),
    say: (log, { moduleId }) => practiceOn(
      moduleId,
      log.firstUnfinished(moduleId),
      `Do an exercise in ${log.moduleName(moduleId)}. A quiz on its own does not master it.`,
      'Do an exercise',
    ),
  },
  {
    // 8. The module was opened and only read: the default Learn screen records no mode switch.
    name: 'reading_only',
    find: log => perModule(log, (moduleId) => {
      const opened = log.of('module_opened', entry => entry.moduleId === moduleId).at(-1)
      const worked = log.entries.some(entry => entry.moduleId === moduleId
        && (entry.type === 'code_run' || entry.type === 'submitted' || (entry.type === 'mode_switched' && entry.payload.mode === 'practice')))
      return opened && !worked ? { moduleId, anchor: opened.id } : null
    }),
    say: (log, { moduleId }) => practiceOn(
      moduleId,
      log.firstUnfinished(moduleId),
      `Switch to Practice and do an exercise in ${log.moduleName(moduleId)}.`,
      'Go to Practice',
    ),
  },
  {
    // 9. A module opened, then left for another module or the Mindmap layout, with nothing submitted or answered.
    name: 'abandoned_module',
    find: log => perModule(log, (moduleId) => {
      if (log.entries.some(entry => entry.moduleId === moduleId && (entry.type === 'submitted' || entry.type === 'quiz_answered'))) return null
      const lefts = log.entries.flatMap((entry, index) => {
        if (entry.type !== 'module_opened' || entry.moduleId !== moduleId) return []
        const left = log.entries.slice(index + 1).find(next =>
          (next.type === 'module_opened' && next.moduleId !== moduleId)
          || (next.type === 'layout_switched' && next.payload.layout === 'mindmap'))
        return left ? [left.id] : []
      })
      return lefts.length > 0 ? { moduleId, anchor: Math.max(...lefts) } : null
    }),
    say: (log, { moduleId }) => practiceOn(
      moduleId,
      log.firstUnfinished(moduleId),
      `Go back to ${log.moduleName(moduleId)}. You left it before submitting.`,
      'Go back',
    ),
  },
  {
    // 10. Three module openings in a row, with no submission between them or after.
    name: 'hopping',
    find: (log) => {
      const tail = log.entries.filter(entry => entry.type === 'module_opened' || entry.type === 'submitted')
      const lastSubmission = tail.findLastIndex(entry => entry.type === 'submitted')
      const openings = tail.slice(lastSubmission + 1)
      return openings.length >= patternSize
        ? [{ moduleId: log.input.currentModuleId, anchor: openings.at(-1)!.id }]
        : []
    },
    say: (log, { moduleId }) => practiceOn(
      moduleId,
      log.firstUnfinished(moduleId),
      `Stay on ${log.moduleName(moduleId)} and do an exercise.`,
      'Stay here',
    ),
  },
  {
    // 11. The latest layout switch is to the Mindmap layout and the current exercise is unfinished.
    name: 'left_study_layout',
    find: (log) => {
      const latest = log.of('layout_switched').at(-1)
      const exerciseId = log.input.currentExerciseId
      return latest && latest.payload.layout === 'mindmap' && !log.hasFullPass(exerciseId)
        ? [{ moduleId: log.input.currentModuleId, exerciseId, anchor: latest.id }]
        : []
    },
    say: (log, { moduleId, exerciseId }) => ({
      sentence: `Come back to the Study layout and finish ${log.exerciseTitle(exerciseId ?? '')}.`,
      button: 'Back to Study',
      action: { kind: 'study', moduleId, exerciseId: exerciseId ?? '' },
    }),
  },
  {
    // 12. Went quiet in Practice and came back to the same exercise, with nothing done since.
    name: 'returned_to_exercise',
    find: (log) => {
      const returnedAt = log.entries.findLastIndex(entry => entry.type === 'returned')
      const returned = log.entries[returnedAt]
      if (!returned || !returned.exerciseId || !returned.moduleId) return []
      const quiet = log.entries.slice(0, returnedAt).findLast(entry => entry.type === 'went_idle')
      if (!quiet || quiet.exerciseId !== returned.exerciseId || quiet.moduleId !== returned.moduleId) return []
      const since = log.entries.slice(returnedAt + 1)
      if (since.some(entry => entry.type === 'code_run' || entry.type === 'submitted' || entry.type === 'message_sent')) return []
      return [{ moduleId: returned.moduleId, exerciseId: returned.exerciseId, anchor: returned.id }]
    },
    say: (log, { moduleId, exerciseId }) => practiceOn(
      moduleId,
      exerciseId ?? null,
      `Continue ${log.exerciseTitle(exerciseId ?? '')}.`,
      'Continue',
    ),
  },
]
