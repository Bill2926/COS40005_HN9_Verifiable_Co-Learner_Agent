<script setup lang="ts">
// Variant B, "Chat-first": conversation in the centre, working area as a right-side slide-out, knowledge map as a top strip.
import Conversation from '~/components/prototype/Conversation.vue'
import WorkingArea from '~/components/prototype/WorkingArea.vue'
import { currentTopicId, knowledgeMap, topicStateLabel } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

const props = defineProps<{
  state: PrototypeState
}>()

function toggleDrawer() {
  props.state.drawerOpen = !props.state.drawerOpen
}
</script>

<template>
  <div
    data-layout="chat-first"
    class="flex h-dvh flex-col bg-elevated"
  >
    <header class="shrink-0 border-b border-default bg-default px-4 py-3">
      <h2 class="text-xs font-medium tracking-wide text-muted uppercase">
        Knowledge map
      </h2>
      <ul class="mt-2 flex gap-2 overflow-x-auto pb-1">
        <li
          v-for="topic in knowledgeMap"
          :key="topic.id"
          class="w-44 shrink-0 rounded-md border bg-default px-3 py-2"
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
    </header>

    <div class="flex min-h-0 flex-1">
      <Conversation
        class="min-w-0 flex-1"
        :state="state"
      />

      <div class="flex h-full shrink-0 border-l border-default bg-default">
        <button
          type="button"
          class="flex w-11 shrink-0 items-center justify-center text-sm font-medium"
          :aria-expanded="state.drawerOpen"
          @click="toggleDrawer"
        >
          <span class="[writing-mode:vertical-rl]">
            {{ state.drawerOpen ? 'Hide working area' : 'Working area' }}
          </span>
        </button>
        <aside
          class="h-full overflow-hidden border-l border-default transition-[width] duration-200 motion-reduce:transition-none"
          :class="state.drawerOpen ? 'w-[min(28rem,calc(100vw-20rem))]' : 'w-0 border-l-0'"
          :inert="!state.drawerOpen"
        >
          <div class="h-full w-[min(28rem,calc(100vw-20rem))]">
            <WorkingArea
              class="h-full"
              :state="state"
            />
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
