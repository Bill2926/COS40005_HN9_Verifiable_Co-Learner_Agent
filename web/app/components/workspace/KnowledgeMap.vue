<script setup lang="ts">
import type { MapTopic } from '#shared/turn'

defineProps<{
  topics: MapTopic[]
}>()

const stateLabel = {
  mastered: 'Mastered',
  open: 'Open',
  closed: 'Closed',
} as const
</script>

<template>
  <aside class="flex h-full min-h-0 min-w-0 flex-col bg-default">
    <h2 class="shrink-0 px-3 py-3 text-sm font-medium">
      Knowledge map
    </h2>
    <ul class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
      <li
        v-for="topic in topics"
        :key="topic.id"
        class="rounded-md border px-2.5 py-2"
        :class="topic.current ? 'border-primary bg-elevated' : 'border-default'"
        :aria-current="topic.current ? 'true' : undefined"
      >
        <p class="text-sm font-medium">
          {{ topic.name }}
        </p>
        <p class="mt-1 text-xs text-muted">
          {{ stateLabel[topic.state] }}
          <template v-if="topic.current">
            · Current
          </template>
        </p>
        <p
          v-if="'closedReason' in topic"
          class="mt-1 text-xs"
        >
          {{ topic.closedReason }}
        </p>
      </li>
    </ul>
  </aside>
</template>
