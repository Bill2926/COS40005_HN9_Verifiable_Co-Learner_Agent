<script setup lang="ts">
// Variant A, "IDE": knowledge map as a narrow left rail, working area in the centre, conversation on the right.
import Conversation from '~/components/prototype/Conversation.vue'
import WorkingArea from '~/components/prototype/WorkingArea.vue'
import { currentTopicId, knowledgeMap, topicStateLabel } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

defineProps<{
  state: PrototypeState
}>()
</script>

<template>
  <div
    data-layout="ide"
    class="h-dvh overflow-auto bg-elevated"
  >
    <div class="grid h-full min-h-[640px] min-w-[960px] grid-cols-[13.5rem_minmax(0,1fr)_22rem]">
      <aside class="flex min-h-0 flex-col border-r border-default bg-default">
        <h2 class="shrink-0 px-3 py-3 text-sm font-medium">
          Knowledge map
        </h2>
        <ul class="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          <li
            v-for="topic in knowledgeMap"
            :key="topic.id"
            class="rounded-md border px-2.5 py-2"
            :class="topic.id === currentTopicId ? 'border-indigo-700' : 'border-default'"
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
              class="mt-1 text-xs"
            >
              {{ topic.closedReason }}
            </p>
          </li>
        </ul>
      </aside>

      <WorkingArea
        class="min-w-0 border-r border-default"
        :state="state"
      />
      <Conversation
        class="min-w-0"
        :state="state"
      />
    </div>
  </div>
</template>
