<script setup lang="ts">
import type { ProgressView } from '#shared/turn'

// What the student has finished and where to focus. Mastery per module is the
// roadmap's bar above; this adds the passed exercises with their attempts and the
// weak spots in plain words. It shows nothing of the review signals or the activity log.
defineProps<{
  progress: ProgressView
  weakSpots: readonly string[]
}>()

function attemptsLabel(attempts: number): string {
  return attempts === 1 ? '1 attempt' : `${attempts} attempts`
}
</script>

<template>
  <section
    class="flex flex-col gap-3 border-t border-ink-200 pt-4 md:max-lg:w-64 md:max-lg:shrink-0 md:max-lg:border-t-0 md:max-lg:border-l md:max-lg:pt-0 md:max-lg:pl-4"
    aria-label="Your progress"
  >
    <h3 class="text-[10px] font-semibold tracking-[0.4px] text-ink-400 uppercase lg:px-1">
      Your progress
    </h3>
    <div class="flex flex-col gap-1.5 lg:px-1">
      <h4 class="text-xs leading-4 font-semibold text-ink-800">
        Exercises completed
      </h4>
      <p
        v-if="progress.completedExercises.length === 0"
        class="text-[11px] leading-4 text-ink-500"
      >
        None yet. Pass an exercise and it appears here.
      </p>
      <ul
        v-else
        class="flex flex-col gap-1"
      >
        <li
          v-for="item in progress.completedExercises"
          :key="`${item.moduleId}/${item.exerciseId}`"
          class="flex items-start justify-between gap-2 text-[11px] leading-4"
        >
          <span class="min-w-0 text-ink-700">
            {{ item.title }}
            <span class="block text-ink-400">{{ item.moduleName }}</span>
          </span>
          <span class="shrink-0 font-mono text-[10px] text-ink-500 tabular-nums">{{ attemptsLabel(item.attempts) }}</span>
        </li>
      </ul>
    </div>
    <div class="flex flex-col gap-1.5 lg:px-1">
      <h4 class="text-xs leading-4 font-semibold text-ink-800">
        Weak spots
      </h4>
      <p
        v-if="weakSpots.length === 0"
        class="text-[11px] leading-4 text-ink-500"
      >
        None found in your work so far.
      </p>
      <ul
        v-else
        class="flex flex-col gap-1.5"
      >
        <li
          v-for="spot in weakSpots"
          :key="spot"
          class="rounded-[4px] border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-4 text-ink-700 text-pretty"
        >
          {{ spot }}
        </li>
      </ul>
    </div>
  </section>
</template>
