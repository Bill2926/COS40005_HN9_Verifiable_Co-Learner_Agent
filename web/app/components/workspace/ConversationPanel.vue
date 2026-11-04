<script setup lang="ts">
import type { ConversationMessage, TurnTrace } from '#shared/turn'

const props = defineProps<{
  messages: ConversationMessage[]
  displayName: string
  trace: TurnTrace | null
  sending: boolean
  sendError: string
  streamingTeacher: string
  streamingDeskmate: string
}>()

const agentName = {
  teacher: 'Teacher',
  deskmate: 'Mai',
} as const

const emit = defineEmits<{
  send: [text: string]
  openLearn: []
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

const streamingBubbles = computed(() => {
  const bubbles: { author: 'teacher' | 'deskmate', name: string, role: string, text: string }[] = []
  if (props.streamingTeacher) {
    bubbles.push({ author: 'teacher', name: 'Teacher', role: 'Teacher', text: props.streamingTeacher })
  }
  if (props.streamingDeskmate) {
    bubbles.push({ author: 'deskmate', name: 'Mai', role: 'Deskmate', text: props.streamingDeskmate })
  }
  return bubbles
})

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

watch(() => [props.messages.length, props.streamingTeacher, props.streamingDeskmate, props.sending] as const, () => {
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

    <section
      v-if="traceOpen"
      class="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-3"
      aria-label="Shield trace"
    >
      <h3 class="text-sm font-semibold">
        Shield: not active yet
      </h3>
      <ul
        v-if="trace"
        class="mt-2 space-y-1 text-sm"
      >
        <li
          v-for="entry in trace.agents"
          :key="entry.agent"
        >
          <span class="font-medium">{{ agentName[entry.agent] }}</span>
          <template v-if="entry.proposal">
            proposed
            <code class="font-mono text-xs">{{ entry.proposal }}</code>
            <template v-if="entry.verdict">
              · {{ entry.verdict.decision }}
              · {{ entry.verdict.ruleId }}
              · {{ entry.verdict.reasonCode }}
            </template>
          </template>
          <template v-else>
            made no proposal
          </template>
        </li>
      </ul>
    </section>

    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      <p
        v-if="messages.length === 0 && !sending && streamingTeacher.length === 0 && streamingDeskmate.length === 0"
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
            {{ message.name }} · {{ message.text }}
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
              <UButton
                v-if="message.openInLearn"
                type="button"
                class="mt-2"
                size="sm"
                color="neutral"
                variant="outline"
                label="Open in Learn"
                @click="emit('openLearn')"
              />
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
            >{{ props.displayName.slice(0, 1) }}</span>
            <div class="min-w-0">
              <p class="text-sm">
                <span class="font-medium">{{ props.displayName }}</span>
                <span class="text-muted"> · Student</span>
              </p>
              <p class="mt-1 text-sm leading-6">
                {{ pending }}
              </p>
            </div>
          </article>
        </li>
        <li
          v-for="bubble in streamingBubbles"
          :key="bubble.author"
          class="flex"
          :class="appearance[bubble.author].row"
        >
          <article
            class="flex max-w-[85%] gap-2 rounded-lg border px-3 py-2"
            :class="appearance[bubble.author].bubble"
          >
            <span
              class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
              :class="appearance[bubble.author].avatar"
              aria-hidden="true"
            >
              {{ bubble.name.slice(0, 1) }}
            </span>
            <div class="min-w-0">
              <p class="text-sm">
                <span class="font-medium">{{ bubble.name }}</span>
                <span class="text-muted"> · {{ bubble.role }}</span>
              </p>
              <p class="mt-1 text-sm leading-6">
                {{ bubble.text }}
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
