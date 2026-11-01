<script setup lang="ts">
import type { WorkingAreaView } from '#shared/turn'
import PracticePanel from './PracticePanel.vue'

defineProps<{
  area: WorkingAreaView
  selecting: boolean
  selectError: string
}>()

const emit = defineEmits<{
  selectExercise: [exerciseId: string]
}>()

const mode = ref<'learn' | 'practice'>('learn')
const practiceOpened = ref(false)

function choose(next: 'learn' | 'practice') {
  if (next === 'practice') practiceOpened.value = true
  mode.value = next
}
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col border-x border-default bg-default"
    aria-label="Working area"
  >
    <header class="shrink-0 border-b border-default px-5 py-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted">
          Working area
        </p>
        <div
          class="flex gap-2"
          role="group"
          aria-label="Working area mode"
        >
          <UButton
            label="Learn"
            color="neutral"
            :variant="mode === 'learn' ? 'solid' : 'outline'"
            :aria-pressed="mode === 'learn'"
            @click="choose('learn')"
          />
          <UButton
            label="Practice"
            color="neutral"
            :variant="mode === 'practice' ? 'solid' : 'outline'"
            :aria-pressed="mode === 'practice'"
            @click="choose('practice')"
          />
        </div>
      </div>
      <h1 class="mt-1 text-lg font-semibold">
        {{ area.topicName }}
      </h1>
      <p
        v-if="mode === 'learn'"
        class="mt-1 text-sm leading-6"
      >
        {{ area.materials.scopeNote }}
      </p>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <article v-if="mode === 'learn'">
        <h2 class="text-base font-medium">
          {{ area.materials.heading }}
        </h2>
        <p class="mt-2 text-sm leading-6">
          {{ area.materials.body }}
        </p>
        <h3 class="mt-4 text-sm font-medium">
          Example
        </h3>
        <pre class="mt-2 overflow-x-auto rounded-md bg-elevated px-3 py-2 font-mono text-sm leading-6"><code>{{ area.materials.example }}</code></pre>
      </article>

      <PracticePanel
        v-if="practiceOpened"
        v-show="mode === 'practice'"
        :exercise="area.exercise"
        :exercises="area.exercises"
        :active="mode === 'practice'"
        :selecting="selecting"
        :select-error="selectError"
        @select-exercise="emit('selectExercise', $event)"
      />
    </div>
  </section>
</template>
