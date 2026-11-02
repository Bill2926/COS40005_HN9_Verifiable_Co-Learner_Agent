<script setup lang="ts">
import type { CurrentExercise, ExerciseChoice, PracticeTestResult } from '#shared/turn'
import { createDraftStore, draftAfterSwitch } from '~/drafts/store'
import { RunStopped, type PythonRunner, type RunResult, type TestReport } from '~/python/runner'
import PythonEditor from './PythonEditor.vue'

const props = defineProps<{
  exercise: CurrentExercise
  exercises: readonly ExerciseChoice[]
  studentId: string
  active: boolean
  selecting: boolean
  selectError: string
  submitting: boolean
}>()

const emit = defineEmits<{
  selectExercise: [exerciseId: string]
  draft: [code: string]
  run: [result: RunResult | null]
  submit: [submission: { code: string, results: PracticeTestResult[] }]
}>()

const drafts = createDraftStore(localStorage, props.studentId)
const draft = ref(drafts.read(props.exercise.id) ?? props.exercise.starterCode)
const status = ref<'idle' | 'loading' | 'running' | 'checking' | 'stopped' | 'failed'>('idle')
const outcome = ref<RunResult | null>(null)
const submission = ref<TestReport | null>(null)
const pythonReady = ref(false)
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

watch(() => props.exercise.id, (next, previous) => {
  if (!previous || previous === next) return
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
})

onBeforeUnmount(() => {
  alive = false
  drafts.write(props.exercise.id, draft.value)
  runner?.stop()
})

function chooseExercise(exerciseId: string) {
  if (exerciseId === props.exercise.id || props.selecting) return
  emit('selectExercise', exerciseId)
}

async function onRun() {
  if (busy.value) return
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
  }
  catch (error) {
    if (!alive || generation !== runGeneration) return
    outcome.value = null
    pythonReady.value = false
    status.value = error instanceof RunStopped ? 'stopped' : 'failed'
  }
}

async function onSubmit() {
  if (busy.value) return
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

function onStop() {
  runGeneration += 1
  pythonReady.value = false
  outcome.value = null
  status.value = 'stopped'
  runner?.stop()
}
</script>

<template>
  <div
    class="flex flex-col gap-4"
    :aria-busy="busy"
  >
    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Exercises"
    >
      <UButton
        v-for="choice in exercises"
        :key="choice.id"
        :label="choice.title"
        color="neutral"
        :variant="choice.id === exercise.id ? 'solid' : 'outline'"
        :aria-pressed="choice.id === exercise.id"
        :disabled="selecting"
        @click="chooseExercise(choice.id)"
      />
    </div>
    <p
      v-if="selectError"
      class="text-sm text-error"
    >
      {{ selectError }}
    </p>

    <article>
      <h2 class="text-base font-medium">
        {{ exercise.title }}
      </h2>
      <p class="mt-2 text-sm leading-6">
        {{ exercise.statement }}
      </p>
    </article>

    <div>
      <p class="text-sm font-medium">
        Draft
      </p>
      <div class="mt-1 h-72 overflow-hidden rounded-md border border-default bg-default">
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
        :disabled="busy"
        @click="onRun"
      />
      <UButton
        label="Submit"
        color="neutral"
        :disabled="busy || submitting"
        @click="onSubmit"
      />
      <UButton
        v-if="busy"
        label="Stop"
        color="error"
        variant="outline"
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
