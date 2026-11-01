<script setup lang="ts">
import type { ConversationMessage } from '#shared/turn'

const props = defineProps<{
  messages: ConversationMessage[]
  sending: boolean
  sendError: string
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const traceOpen = ref(false)
const text = ref('')
const pending = ref('')

function submit() {
  const value = text.value.trim()
  if (!value || props.sending) return
  pending.value = value
  emit('send', value)
}

watch(() => props.sending, (sending) => {
  if (sending) return
  if (!props.sendError && text.value.trim() === pending.value) text.value = ''
  pending.value = ''
})
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
          <p
            v-if="message.author === 'event'"
            class="text-center text-sm text-muted"
          >
            Exercise · {{ message.text }}
          </p>
          <template v-else>
            <p class="text-sm">
              <span class="font-medium">{{ message.name }}</span>
              <span class="text-muted"> · {{ message.role }}</span>
            </p>
            <p class="mt-1 text-sm leading-6">
              {{ message.text }}
            </p>
          </template>
        </li>
      </ol>
    </div>

    <form
      class="shrink-0 space-y-2 border-t border-default px-4 py-3"
      @submit.prevent="submit"
    >
      <label class="block text-sm">
        <span class="sr-only">Message</span>
        <UInput
          v-model="text"
          name="message"
          placeholder="Message"
          class="w-full"
          :disabled="sending"
        />
      </label>
      <p
        v-if="sendError"
        role="alert"
        class="text-sm text-error"
      >
        {{ sendError }}
      </p>
      <UButton
        type="submit"
        :loading="sending"
        :disabled="sending || text.trim().length === 0"
      >
        Send
      </UButton>
    </form>
  </section>
</template>
