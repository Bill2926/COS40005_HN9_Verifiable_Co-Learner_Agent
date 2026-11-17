<script setup lang="ts">
import type { CurrentExercise, ExerciseChoice, PracticeTestResult } from '#shared/turn'
import { createDraftStore, draftAfterSwitch } from '~/drafts/store'
import { RunStopped, type PythonRunner, type RunResult, type TestReport } from '~/python/runner'
import BusySpinner from '../BusySpinner.vue'
import InlineText from './InlineText.vue'
import PythonEditor from './PythonEditor.vue'

const props = defineProps<{
  exercise: CurrentExercise
  exercises: readonly ExerciseChoice[]
  studentId: string
  active: boolean
  selecting: boolean
  // The exercise being opened, shown with a spinner on its chip.
  selectingExerciseId?: string
  selectError: string
  submitting: boolean
}>()

const emit = defineEmits<{
  selectExercise: [exerciseId: string]
  draft: [code: string]
  run: [result: RunResult | null]
  runFinished: [exerciseId: string]
  submit: [submission: { code: string, results: PracticeTestResult[] }]
}>()

const drafts = createDraftStore(localStorage, props.studentId)
const draft = ref(drafts.read(props.exercise.id) ?? props.exercise.starterCode)
const status = ref<'idle' | 'loading' | 'running' | 'checking' | 'stopped' | 'failed'>('idle')
const outcome = ref<RunResult | null>(null)
const submission = ref<TestReport | null>(null)
const pythonReady = ref(false)
// Which button started the current run, so only that one shows a spinner.
const action = ref<'run' | 'submit'>('run')
// The submission turn ends when the parent stops submitting; a later message
// turn must not spin the Submit button.
watch(() => props.submitting, (submitting) => {
  if (!submitting && !busy.value) action.value = 'run'
})
const busy = computed(() => status.value === 'loading' || status.value === 'running' || status.value === 'checking')

let runner: PythonRunner | null = null
let alive = true
let restoring = false
let runGeneration = 0

watch(draft, (code) => {
  if (restoring) return
  drafts.write(props.exercise.id, code)
}, { flush: 'sync' })

watch(draft, code => emit('draft', code), { immediate: true })
watch(outcome, result => emit('run', result))

function practiceRunInProgress(): boolean {
  return action.value === 'run' && (status.value === 'loading' || status.value === 'running')
}

watch(() => props.exercise.id, (next, previous) => {
  if (!previous || previous === next) return
  const reportRun = practiceRunInProgress()
  if (busy.value) {
    runGeneration += 1
    pythonReady.value = false
    runner?.stop()
  }
  const restored = draftAfterSwitch(drafts, {
    leavingId: previous,
    leavingCode: draft.value,
    enteringId: next,
    enteringStarter: props.exercise.starterCode,
  })
  outcome.value = null
  submission.value = null
  status.value = 'idle'
  restoring = true
  if (draft.value !== restored) draft.value = restored
  restoring = false
  if (reportRun) emit('runFinished', previous)
})

onBeforeUnmount(() => {
  alive = false
  drafts.write(props.exercise.id, draft.value)
  const reportRun = practiceRunInProgress()
  runner?.stop()
  if (reportRun) emit('runFinished', props.exercise.id)
})

function chooseExercise(exerciseId: string) {
  if (exerciseId === props.exercise.id || props.selecting) return
  emit('selectExercise', exerciseId)
}

async function onRun() {
  if (busy.value || props.submitting) return
  action.value = 'run'
  const generation = ++runGeneration
  outcome.value = null
  status.value = pythonReady.value ? 'running' : 'loading'

  try {
    const { createPythonRunner } = await import('~/python/browser-runner')
    if (!alive || generation !== runGeneration) return
    runner ??= createPythonRunner()

    const handle = runner.run(draft.value)
    await handle.started
    if (!alive || generation !== runGeneration) return
    pythonReady.value = true
    status.value = 'running'
    const result = await handle.result
    if (!alive || generation !== runGeneration) return
    outcome.value = result
    status.value = 'idle'
    emit('runFinished', props.exercise.id)
  }
  catch (error) {
    if (!alive || generation !== runGeneration) return
    outcome.value = null
    pythonReady.value = false
    status.value = error instanceof RunStopped ? 'stopped' : 'failed'
    emit('runFinished', props.exercise.id)
  }
}

async function onSubmit() {
  if (busy.value || props.submitting) return
  action.value = 'submit'
  const generation = ++runGeneration
  submission.value = null
  status.value = pythonReady.value ? 'checking' : 'loading'

  try {
    const { createPythonRunner } = await import('~/python/browser-runner')
    if (!alive || generation !== runGeneration) return
    runner ??= createPythonRunner()

    const handle = runner.runTests(draft.value, props.exercise.tests)
    await handle.started
    if (!alive || generation !== runGeneration) return
    pythonReady.value = true
    status.value = 'checking'
    const result = await handle.result
    if (!alive || generation !== runGeneration) return
    submission.value = result
    status.value = 'idle'
    emit('submit', { code: draft.value, results: result.results })
  }
  catch (error) {
    if (!alive || generation !== runGeneration) return
    submission.value = null
    pythonReady.value = false
    status.value = error instanceof RunStopped ? 'stopped' : 'failed'
  }
}

function chipClass(selected: boolean): string {
  const shape = 'rounded-[4px] px-3 py-1.5 text-center text-xs leading-4 font-medium disabled:cursor-not-allowed max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center'
  return selected
    ? `${shape} border border-brand-200 bg-brand-50 text-brand-800 shadow-[0px_1px_1px_rgba(0,0,0,0.04)] disabled:border-brand-200 disabled:bg-brand-50 disabled:text-brand-800`
    : `${shape} border border-ink-200 bg-paper text-ink-600 hover:border-ink-300 hover:text-ink-900 disabled:border-ink-200 disabled:bg-paper disabled:text-ink-600`
}

function onStop() {
  const reportRun = practiceRunInProgress()
  runGeneration += 1
  pythonReady.value = false
  outcome.value = null
  status.value = 'stopped'
  runner?.stop()
  if (reportRun) emit('runFinished', props.exercise.id)
}
</script>

<template>
  <div
    class="flex flex-col gap-6"
    :aria-busy="busy"
  >
    <div class="flex flex-col gap-2">
      <div
        class="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Exercises"
      >
        <button
          v-for="choice in exercises"
          :key="choice.id"
          type="button"
          :class="chipClass(choice.id === exercise.id)"
          :aria-pressed="choice.id === exercise.id"
          :disabled="selecting"
          :aria-busy="selectingExerciseId === choice.id ? true : undefined"
          @click="chooseExercise(choice.id)"
        >
          <span class="inline-flex items-center gap-1.5">
            {{ choice.title }}
            <BusySpinner v-if="selectingExerciseId === choice.id" />
          </span>
        </button>
      </div>
      <p
        v-if="selectError"
        class="text-sm text-error"
      >
        {{ selectError }}
      </p>
    </div>

    <section
      class="flex flex-col gap-1 rounded-[8px] border border-ink-200 bg-ink-50 px-4 py-3.5"
      aria-labelledby="exercise-statement"
    >
      <p
        id="exercise-statement"
        class="font-mono text-[11px] leading-[16.5px] text-ink-400 uppercase"
      >
        Problem statement
      </p>
      <p class="text-[13px] leading-5 text-ink-700">
        <InlineText
          :text="exercise.statement"
          code-style="statement"
        />
      </p>
    </section>

    <div>
      <p class="text-xs leading-4 font-semibold text-ink-800">
        Draft
      </p>
      <div class="mt-2 h-72 overflow-hidden rounded-[8px] border border-ink-200 bg-paper shadow-[0px_1px_2px_0px_rgba(0,0,0,0.04)]">
        <PythonEditor
          :key="exercise.id"
          v-model="draft"
          :active="active"
        />
      </div>
    </div>

    <div class="flex gap-2">
      <UButton
        label="Run"
        color="neutral"
        variant="outline"
        class="max-md:min-h-11 max-md:min-w-11"
        :disabled="busy || submitting"
        :loading="busy && action === 'run'"
        :aria-busy="busy && action === 'run'"
        @click="onRun"
      />
      <UButton
        label="Submit"
        color="primary"
        class="max-md:min-h-11 max-md:min-w-11"
        :disabled="busy || submitting"
        :loading="(busy || submitting) && action === 'submit'"
        :aria-busy="(busy || submitting) && action === 'submit'"
        @click="onSubmit"
      />
      <UButton
        v-if="busy"
        label="Stop"
        color="error"
        variant="outline"
        class="max-md:min-h-11 max-md:min-w-11"
        @click="onStop"
      />
    </div>

    <div aria-live="polite">
      <p
        v-if="status === 'loading'"
        class="text-sm"
      >
        Starting Python…
      </p>
      <p
        v-else-if="status === 'running'"
        class="text-sm"
      >
        Running…
      </p>
      <p
        v-else-if="status === 'checking'"
        class="text-sm"
      >
        Checking…
      </p>
      <p
        v-else-if="status === 'stopped'"
        class="text-sm"
      >
        Stopped.
      </p>
      <p
        v-else-if="status === 'failed'"
        class="text-sm"
      >
        Python could not be started. Try again.
      </p>

      <div
        v-if="outcome"
        class="space-y-3"
      >
        <div>
          <h3 class="text-sm font-medium">
            Printed output
          </h3>
          <pre class="mt-1 min-h-10 overflow-x-auto whitespace-pre-wrap rounded-md bg-elevated px-3 py-2 font-mono text-sm">{{ outcome.stdout }}</pre>
        </div>
        <div>
          <h3 class="text-sm font-medium">
            Error output
          </h3>
          <pre class="mt-1 min-h-10 overflow-x-auto whitespace-pre-wrap rounded-md bg-elevated px-3 py-2 font-mono text-sm">{{ outcome.stderr }}</pre>
        </div>
        <p
          v-if="outcome.error"
          class="text-sm font-medium text-error"
        >
          Line {{ outcome.error.line }}: {{ outcome.error.message }}
        </p>
      </div>

      <section
        v-if="submission"
        class="space-y-3"
        aria-label="Practice check"
      >
        <div>
          <h3 class="text-sm font-medium">
            Practice check
          </h3>
          <p class="mt-1 text-sm">
            This is not recorded as evidence.
          </p>
        </div>
        <ol class="space-y-3">
          <li
            v-for="test in submission.results"
            :key="test.name"
          >
            <p
              class="text-sm font-medium"
              :class="test.passed ? 'text-success' : 'text-error'"
            >
              {{ test.passed ? 'Passed' : 'Failed' }}: {{ test.name }}
            </p>
            <p class="mt-1 text-sm">
              Expected: <span class="font-mono">{{ test.expected }}</span>
            </p>
            <p class="text-sm">
              Actual: <span class="font-mono">{{ test.actual }}</span>
            </p>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
