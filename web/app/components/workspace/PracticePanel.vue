<script setup lang="ts">
import type { CurrentExercise } from '#shared/turn'
import { RunStopped, type PythonRunner, type RunResult } from '~/python/runner'
import PythonEditor from './PythonEditor.vue'

const props = defineProps<{
  exercise: CurrentExercise
  active: boolean
}>()

const draft = ref(props.exercise.starterCode)
const status = ref<'idle' | 'loading' | 'running' | 'stopped' | 'failed'>('idle')
const outcome = ref<RunResult | null>(null)
const pythonReady = ref(false)
const busy = computed(() => status.value === 'loading' || status.value === 'running')

let runner: PythonRunner | null = null
let alive = true
let runGeneration = 0

onBeforeUnmount(() => {
  alive = false
  runner?.stop()
})

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
        v-else-if="status === 'stopped'"
        class="text-sm"
      >
        Stopped.
      </p>
      <p
        v-else-if="status === 'failed'"
        class="text-sm"
      >
        Python could not be started. Try Run again.
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
    </div>
  </div>
</template>
