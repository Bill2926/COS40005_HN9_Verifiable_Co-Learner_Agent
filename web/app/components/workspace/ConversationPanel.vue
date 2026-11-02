<script setup lang="ts">
import type { ConversationMessage } from '#shared/turn'

const props = defineProps<{
  messages: ConversationMessage[]
  sending: boolean
  sendError: string
  streamingTeacher: string
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const appearance = {
  teacher: {
    row: 'justify-start',
    bubble: 'border-indigo-200 bg-indigo-50',
    avatar: 'bg-indigo-800',
  },
  deskmate: {
    row: 'justify-start',
    bubble: 'border-amber-200 bg-amber-50',
    avatar: 'bg-amber-700',
  },
  student: {
    row: 'justify-end',
    bubble: 'border-slate-200 bg-slate-100',
    avatar: 'bg-slate-600',
  },
} as const

const traceOpen = ref(false)
const text = ref('')
const pending = ref('')
const scroller = ref<HTMLElement | null>(null)

function rowFor(author: ConversationMessage['author']) {
  if (author === 'event') return 'justify-center'
  return appearance[author].row
}

function bubbleFor(author: ConversationMessage['author']) {
  if (author === 'event') return appearance.teacher
  return appearance[author]
}

watch(() => [props.messages.length, props.streamingTeacher, props.sending] as const, () => {
  nextTick(() => {
    const element = scroller.value
    if (element) element.scrollTop = element.scrollHeight
  })
})

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

    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <p
        v-if="messages.length === 0 && !sending && streamingTeacher.length === 0"
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
          class="flex"
          :class="rowFor(message.author)"
        >
          <p
            v-if="message.author === 'event'"
            class="text-center text-sm text-muted"
          >
            Exercise · {{ message.text }}
          </p>
          <article
            v-else
            class="flex max-w-[85%] gap-2 rounded-lg border px-3 py-2"
            :class="bubbleFor(message.author).bubble"
          >
            <span
              class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
              :class="bubbleFor(message.author).avatar"
              aria-hidden="true"
            >
              {{ message.name.slice(0, 1) }}
            </span>
            <div class="min-w-0">
              <p class="text-sm">
                <span class="font-medium">{{ message.name }}</span>
                <span class="text-muted"> · {{ message.role }}</span>
              </p>
              <p class="mt-1 text-sm leading-6">
                {{ message.text }}
              </p>
            </div>
          </article>
        </li>
        <li
          v-if="sending && pending"
          class="flex justify-end"
        >
          <article class="flex max-w-[85%] gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
            <span
              class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-sm font-medium text-white"
              aria-hidden="true"
            >Y</span>
            <div class="min-w-0">
              <p class="text-sm">
                <span class="font-medium">You</span>
                <span class="text-muted"> · Student</span>
              </p>
              <p class="mt-1 text-sm leading-6">
                {{ pending }}
              </p>
            </div>
          </article>
        </li>
        <li
          v-if="streamingTeacher"
          class="flex justify-start"
        >
          <article class="flex max-w-[85%] gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span
              class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-sm font-medium text-white"
              aria-hidden="true"
            >T</span>
            <div class="min-w-0">
              <p class="text-sm">
                <span class="font-medium">Teacher</span>
                <span class="text-muted"> · Teacher</span>
              </p>
              <p class="mt-1 text-sm leading-6">
                {{ streamingTeacher }}
              </p>
            </div>
          </article>
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
