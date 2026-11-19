<script setup lang="ts">
import type { LearningPlanView } from '#shared/turn'
import BusySpinner from '../BusySpinner.vue'
import InlineText from './InlineText.vue'

const props = defineProps<{
  plan: LearningPlanView
  // True while the student's agreement is being recorded.
  starting: boolean
}>()

const emit = defineEmits<{
  start: []
}>()

// The view marks the current step on the step itself, so a hidden stale step
// cannot shift the mark. Steps before it were worked through in order.
const currentIndex = computed(() => props.plan.steps.findIndex(step => step.current))

function stepState(index: number): 'done' | 'current' | 'next' {
  if (index === currentIndex.value) return 'current'
  if (currentIndex.value >= 0 && index < currentIndex.value) return 'done'
  return 'next'
}

function stepClass(state: 'done' | 'current' | 'next'): string {
  if (state === 'current') return 'border-brand-300 bg-brand-50'
  return 'border-ink-200 bg-paper'
}
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-[8px] border border-ink-200 bg-ink-50/70 px-4 py-4 md:px-5"
    aria-label="Learning plan"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="text-sm leading-5 font-semibold text-ink-900">
          {{ plan.agreed ? 'Your plan for this module' : 'The Teacher suggests this plan' }}
        </h3>
        <p class="text-xs leading-5 text-ink-500">
          {{ plan.agreed ? 'Work through the steps in order.' : 'Agree to it when you are ready to start.' }}
        </p>
      </div>
      <button
        v-if="!plan.agreed"
        type="button"
        class="inline-flex min-h-11 items-center gap-2 rounded-[6px] bg-accent px-3.5 text-xs font-medium text-on-accent hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70 md:min-h-8"
        :disabled="starting"
        :aria-busy="starting ? true : undefined"
        @click="emit('start')"
      >
        <BusySpinner v-if="starting" />
        Start
      </button>
      <span
        v-else
        class="rounded-[4px] bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] leading-[15px] tracking-[0.25px] text-brand-700 uppercase"
      >In progress</span>
    </div>

    <ol class="flex flex-col gap-1.5">
      <li
        v-for="(step, index) in plan.steps"
        :key="step.id"
        class="flex items-start gap-2 rounded-[6px] border px-3 py-2 text-[13px] leading-5"
        :class="stepClass(stepState(index))"
      >
        <span
          class="mt-0.5 font-mono text-[11px] leading-5"
          :class="stepState(index) === 'current' ? 'text-brand-600' : 'text-ink-400'"
        >{{ stepState(index) === 'done' ? '✓' : index + 1 }}</span>
        <span
          class="min-w-0 flex-1"
          :class="stepState(index) === 'done' ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-800'"
        ><InlineText :text="step.title" /></span>
        <span
          v-if="stepState(index) === 'current'"
          class="shrink-0 rounded-[4px] bg-brand-100 px-1.5 py-0.5 text-[10px] leading-[15px] font-medium text-brand-700"
        >Now</span>
      </li>
    </ol>
  </section>
</template>
