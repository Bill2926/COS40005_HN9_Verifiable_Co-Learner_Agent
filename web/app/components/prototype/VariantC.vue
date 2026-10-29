<script setup lang="ts">
// Variant C, "Map canvas": knowledge map as the full-screen background, working area and conversation docked over it.
import Conversation from '~/components/prototype/Conversation.vue'
import WorkingArea from '~/components/prototype/WorkingArea.vue'
import { currentTopicId, knowledgeMap, topicStateLabel } from '~/prototype/an-scenario'
import type { MapTopic } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

defineProps<{
  state: PrototypeState
}>()

const placement: Record<string, string> = {
  variable: 'left-[6%] top-[16%] w-52',
  if_else: 'left-[34%] top-[12%] w-52',
  for_loop: 'left-[12%] top-[28%] w-64',
  nested_loop: 'left-[46%] top-[62%] w-56',
}

function place(topic: MapTopic): string {
  return placement[topic.id] ?? 'left-4 top-4 w-52'
}
</script>

<template>
  <div
    data-layout="map-canvas"
    class="relative h-dvh min-w-[960px] overflow-hidden bg-[#e4ebf0]"
  >
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="background-image: radial-gradient(#c5d0d8 1px, transparent 1px); background-size: 22px 22px;"
    />

    <svg
      class="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points="16,22 44,18 24,42 54,68"
        fill="none"
        stroke="#94a3b8"
        stroke-width="0.35"
      />
    </svg>

    <h2 class="absolute top-4 left-6 z-[1] text-sm font-medium text-slate-700">
      Knowledge map
    </h2>

    <ul class="absolute inset-0">
      <li
        v-for="topic in knowledgeMap"
        :key="topic.id"
        class="absolute z-[1] rounded-lg border bg-default px-3 py-3 shadow-sm"
        :class="[
          place(topic),
          topic.id === currentTopicId ? 'border-indigo-700' : 'border-default',
        ]"
        :aria-current="topic.id === currentTopicId ? 'true' : undefined"
      >
        <p class="text-sm font-medium">
          {{ topic.name }}
        </p>
        <p class="mt-1 text-xs text-muted">
          {{ topicStateLabel(topic.state) }}
          <template v-if="topic.id === currentTopicId">
            · Current
          </template>
        </p>
        <p
          v-if="topic.closedReason"
          class="mt-2 text-xs"
        >
          {{ topic.closedReason }}
        </p>
      </li>
    </ul>

    <aside class="absolute bottom-16 left-4 z-10 h-[min(28rem,calc(100dvh-14rem))] w-[min(36rem,42vw)] overflow-hidden rounded-xl border border-default shadow-xl">
      <WorkingArea
        class="h-full"
        :state="state"
      />
    </aside>

    <aside class="absolute top-4 right-4 z-10 h-[calc(100dvh-6.5rem)] w-[min(22rem,34vw)] overflow-hidden rounded-xl border border-default shadow-xl">
      <Conversation
        class="h-full"
        :state="state"
      />
    </aside>
  </div>
</template>
