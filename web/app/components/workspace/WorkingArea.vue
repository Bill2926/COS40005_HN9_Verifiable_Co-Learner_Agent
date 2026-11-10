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

function toggleExpanded() {
  emit('update:expanded', props.expanded === false)
}

const practiceOpened = ref(false)

function choose(next: 'learn' | 'practice') {
  if (next === 'practice') practiceOpened.value = true
  emit('update:mode', next)
}

function modeClass(selected: boolean): string {
  const shape = 'rounded-[4px] px-[14px] py-1.5 text-xs leading-4 font-medium'
  return selected
    ? `${shape} bg-white text-slate-900 shadow-[0px_1px_1px_rgba(0,0,0,0.05)]`
    : `${shape} text-slate-500`
}

watch(() => props.mode, (mode) => {
  if (mode === 'practice') practiceOpened.value = true
}, { immediate: true })
</script>

<template>
  <section
    class="flex min-h-0 min-w-0 flex-col bg-white"
    :class="[
      floating ? '' : 'border-r border-slate-200',
      floating && expanded === false ? 'h-auto' : 'h-full',
    ]"
    aria-label="Working area"
  >
    <header class="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 pt-5 pb-[21px]">
      <div class="flex min-w-0 flex-col gap-0.5">
        <p class="flex items-center gap-2 font-mono text-[11px] leading-[16.5px] tracking-[0.55px] text-slate-400 uppercase">
          Working area
          <span
            v-if="floating"
            class="rounded-[4px] bg-[#f1f5f9] px-1.5 py-0.5 font-sans text-[10px] leading-[15px] font-medium tracking-[0.25px] text-[#475569]"
          >ACTIVE</span>
        </p>
        <h1 class="text-[20px] leading-7 font-semibold tracking-[-0.5px] text-slate-900">
          {{ area.topicName }}
        </h1>
        <p
          v-if="mode === 'learn'"
          class="pt-0.5 text-xs leading-4 text-slate-500"
        >
          <InlineText :text="area.materials.scopeNote" />
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <div
          class="flex rounded-[6px] border border-slate-200/80 bg-slate-100 p-[5px]"
          role="group"
          aria-label="Working area mode"
        >
          <button
            type="button"
            :class="modeClass(mode === 'learn')"
            :aria-pressed="mode === 'learn'"
            @click="choose('learn')"
          >
            Learn
          </button>
          <button
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
          class="rounded-[4px] p-1"
          :aria-expanded="expanded !== false"
          :aria-label="bodyShown ? 'Collapse working area' : 'Expand working area'"
          @click="toggleExpanded"
        >
          <img
            src="/map-canvas-collapse.svg"
            alt=""
            width="16"
            height="16"
          >
        </button>
      </div>
    </header>

    <div
      v-show="bodyShown"
      class="min-h-0 flex-1 overflow-y-auto"
    >
      <article
        v-if="mode === 'learn'"
        class="flex w-full max-w-[672px] flex-col gap-6 p-8"
      >
        <div class="flex flex-col gap-[7px]">
          <h2 class="text-base leading-6 font-semibold tracking-[-0.4px] text-slate-900">
            <InlineText :text="area.materials.heading" />
          </h2>
          <p class="text-sm leading-[22.75px] text-slate-600">
            <InlineText :text="area.materials.body" />
          </p>
        </div>

        <div class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/90 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <div class="flex items-center justify-between border-b border-slate-200 bg-slate-100/60 px-4 pt-2 pb-[9px]">
            <p class="font-mono text-[11px] leading-[16.5px] text-slate-500">
              Example
            </p>
            <p class="font-mono text-[10px] leading-[15px] text-slate-400">
              Python
            </p>
          </div>
          <PythonExample :code="area.materials.example" />
        </div>

        <section
          class="flex flex-col gap-1.5 rounded-[6px] border border-slate-200/70 bg-slate-50 p-[17px]"
          aria-label="Key point"
        >
          <h3 class="text-xs leading-[19.5px] font-medium text-slate-800">
            Key point
          </h3>
          <p class="text-xs leading-[19.5px] text-slate-600">
            <InlineText :text="area.materials.keyPoint" />
          </p>
        </section>
      </article>

      <div
        v-if="practiceOpened && studentId"
        v-show="mode === 'practice'"
        class="w-full max-w-[768px] p-8"
      >
        <PracticePanel
          :exercise="area.exercise"
          :exercises="area.exercises"
          :student-id="studentId"
          :active="mode === 'practice'"
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
