<script setup lang="ts">
import type { ConversationMessage } from '#shared/turn'

defineProps<{
  messages: ConversationMessage[]
}>()

const traceOpen = ref(false)
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col bg-default"
    aria-label="Conversation"
  >
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-default px-4 py-3">
      <h2 class="text-sm font-medium">
        Conversation
      </h2>
      <USwitch
        v-model="traceOpen"
        label="Shield trace"
        size="sm"
      />
    </header>

    <div
      v-if="traceOpen"
      class="shrink-0 border-b border-default px-4 py-3"
      aria-label="Shield trace"
    >
      <p class="text-sm text-muted">
        Shield trace is not available yet.
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p
        v-if="messages.length === 0"
        class="text-sm text-muted"
      >
        No messages yet.
      </p>
      <ol
        v-else
        class="space-y-3"
      >
        <li
          v-for="message in messages"
          :key="message.id"
        >
          <p class="text-sm">
            <span class="font-medium">{{ message.name }}</span>
            <span class="text-muted"> · {{ message.role }}</span>
          </p>
          <p class="mt-1 text-sm leading-6">
            {{ message.text }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
