<script setup lang="ts">
import type { PracticeTestResult, RunOutput, WorkingAreaView } from '#shared/turn'
import InlineText from './InlineText.vue'
import PracticePanel from './PracticePanel.vue'
import PythonExample from './PythonExample.vue'

const props = defineProps<{
  area: WorkingAreaView
  mode: 'learn' | 'practice'
  studentId: string
  selecting: boolean
  selectError: string
  pendingModuleName?: string
  submitting: boolean
  floating?: boolean
  expanded?: boolean
}>()

const emit = defineEmits<{
  selectExercise: [exerciseId: string]
  draft: [code: string]
  run: [result: RunOutput | null]
  submit: [submission: { code: string, results: PracticeTestResult[] }]
  'update:mode': [mode: 'learn' | 'practice']
  'update:expanded': [expanded: boolean]
}>()

const bodyShown = computed(() => !props.floating || props.expanded !== false)
const pendingName = computed(() => props.pendingModuleName ?? '')

function toggleExpanded() {
  emit('update:expanded', props.expanded === false)
}

const practiceOpened = ref(false)
// The Roadmap canvas is for reading a module, so it only ever shows Learn.
const shownMode = computed(() => props.floating ? 'learn' : props.mode)

function choose(next: 'learn' | 'practice') {
  if (next === 'practice') practiceOpened.value = true
  emit('update:mode', next)
}

function modeClass(selected: boolean): string {
  const shape = 'rounded-[4px] px-[14px] py-1.5 text-xs leading-4 font-medium max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center'
  return selected
    ? `${shape} bg-paper text-ink-900 shadow-[0px_1px_1px_rgba(0,0,0,0.05)]`
    : `${shape} text-ink-500`
}

watch(() => props.mode, (mode) => {
  if (mode === 'practice') practiceOpened.value = true
}, { immediate: true })
</script>

<template>
  <section
    class="flex min-h-0 min-w-0 flex-col bg-paper"
    :class="[
      floating ? 'md:max-lg:border-r md:max-lg:border-ink-200' : 'border-r border-ink-200',
      floating && expanded === false ? 'h-full lg:h-auto' : 'h-full',
    ]"
    aria-label="Working area"
    :aria-busy="pendingName.length > 0"
  >
    <header
      class="shrink-0 overflow-hidden border-b border-ink-200 bg-paper px-4 py-3 [scrollbar-gutter:stable_both-edges] md:px-8"
      :class="floating ? 'md:py-4' : 'md:flex md:min-h-14 md:items-center md:py-0'"
    >
      <div class="mx-auto flex w-full max-w-[656px] flex-wrap items-center justify-between gap-3 md:gap-4">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5 max-md:basis-full">
        <p class="flex items-center gap-2 font-mono text-[11px] leading-[16.5px] tracking-[0.55px] text-ink-400 uppercase">
          Working area
          <span
            v-if="floating"
            class="hidden rounded-[4px] bg-ink-100 px-1.5 py-0.5 font-sans text-[10px] leading-[15px] font-medium tracking-[0.25px] text-ink-600 lg:inline"
          >ACTIVE</span>
        </p>
        <h1 class="text-[18px] leading-6 font-semibold tracking-[-0.4px] text-balance text-ink-900">
          {{ pendingName || area.moduleName }}
        </h1>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <div
          v-if="!floating"
          class="flex rounded-[6px] border border-ink-200/80 bg-ink-100 p-[5px]"
          role="group"
          aria-label="Working area mode"
        >
          <button
            type="button"
            :class="modeClass(shownMode === 'learn')"
            :aria-pressed="shownMode === 'learn'"
            @click="choose('learn')"
          >
            Learn
          </button>
          <button
            v-if="!floating"
            type="button"
            :class="modeClass(mode === 'practice')"
            :aria-pressed="mode === 'practice'"
            @click="choose('practice')"
          >
            Practice
          </button>
        </div>
        <button
          v-if="floating"
          type="button"
          class="hidden rounded-[4px] p-1 hover:bg-ink-100 lg:block"
          :aria-expanded="expanded !== false"
          :aria-label="bodyShown ? 'Collapse working area' : 'Expand working area'"
          @click="toggleExpanded"
        >
          <img
            src="/roadmap-canvas-collapse.svg"
            alt=""
            width="16"
            height="16"
          >
        </button>
      </div>
      </div>
    </header>

    <div
      class="min-h-0 min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable_both-edges]"
      :class="floating && expanded === false ? 'lg:hidden' : ''"
    >
      <div
        v-if="pendingName"
        class="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-6 md:p-8"
        role="status"
        aria-live="polite"
      >
        <p class="text-sm text-ink-500">
          Loading {{ pendingName }}
        </p>
        <div class="h-4 w-2/3 animate-pulse rounded bg-ink-200" />
        <div class="h-28 animate-pulse rounded-lg bg-ink-100" />
        <div class="h-16 animate-pulse rounded-lg bg-ink-100" />
      </div>
      <p
        v-else-if="selectError && shownMode === 'learn'"
        role="alert"
        class="mx-auto w-full max-w-[720px] px-4 pt-4 text-sm text-rose-600 md:px-8"
      >
        {{ selectError }}
      </p>
      <article
        v-if="!pendingName && shownMode === 'learn'"
        class="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6 md:p-8"
      >
        <div class="flex flex-col gap-2">
          <p class="text-xs leading-4 text-ink-500 max-md:hidden">
            <InlineText :text="area.materials.scopeNote" />
          </p>
          <h2 class="text-base leading-6 font-semibold tracking-[-0.4px] text-ink-900">
            <InlineText :text="area.materials.heading" />
          </h2>
          <p class="text-sm leading-6 text-ink-600">
            <InlineText :text="area.materials.body" />
          </p>
        </div>

        <div class="overflow-hidden rounded-[8px] border border-ink-200 bg-ink-50/90 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <div class="flex h-9 items-center justify-between border-b border-ink-200 bg-ink-100/60 px-4">
            <p class="font-mono text-[11px] leading-[16.5px] text-ink-500">
              Example
            </p>
            <p class="font-mono text-[10px] leading-[15px] text-ink-400">
              Python
            </p>
          </div>
          <PythonExample :code="area.materials.example" />
        </div>

        <section
          class="flex flex-col gap-1 rounded-[8px] border border-ink-200 border-l-brand-400 border-l-2 bg-ink-50 px-4 py-3.5"
          aria-label="Key point"
        >
          <h3 class="text-xs leading-5 font-semibold text-ink-800">
            Key point
          </h3>
          <p class="text-[13px] leading-5 text-ink-600">
            <InlineText :text="area.materials.keyPoint" />
          </p>
        </section>
      </article>

      <div
        v-if="!pendingName && practiceOpened && studentId"
        v-show="shownMode === 'practice'"
        class="mx-auto w-full max-w-[720px] px-4 py-6 md:p-8"
      >
        <PracticePanel
          :exercise="area.exercise"
          :exercises="area.exercises"
          :student-id="studentId"
          :active="shownMode === 'practice'"
          :selecting="selecting"
          :select-error="selectError"
          :submitting="submitting"
          @select-exercise="emit('selectExercise', $event)"
          @draft="emit('draft', $event)"
          @run="emit('run', $event)"
          @submit="emit('submit', $event)"
        />
      </div>
    </div>
  </section>
</template>
