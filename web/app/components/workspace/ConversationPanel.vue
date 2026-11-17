<script setup lang="ts">
import type { ConversationMessage, TurnTrace } from '#shared/turn'
import { dateMessages } from '~/workspace/conversation-dates'
import BusySpinner from '../BusySpinner.vue'
import ChatMarkdown from './ChatMarkdown.vue'

const props = defineProps<{
  messages: ConversationMessage[]
  displayName: string
  trace: TurnTrace | null
  sending: boolean
  sendError: string
  streamingTeacher: string
  streamingDeskmate: string
  loading?: boolean
  floating?: boolean
  verifyShieldOn: boolean
  verifyShieldBusy?: boolean
  verifyShieldError?: string
}>()

const emit = defineEmits<{
  send: [text: string]
  openLearn: []
  close: []
  toggleVerifyShield: [enabled: boolean]
}>()

interface BubbleRow {
  key: string
  kind: 'bubble'
  author: 'student' | 'teacher' | 'deskmate'
  name: string
  role: string
  text: string
  openInLearn: boolean
  writing: boolean
  day: string | null
  time: string | null
}

interface TypingRow {
  key: string
  kind: 'typing'
  author: 'teacher' | 'deskmate'
  name: string
}

interface EventRow {
  key: string
  kind: 'event'
  name: string
  text: string
  day: string | null
  time: string | null
}

const bubbleClass = {
  student: 'rounded-tl-2xl rounded-tr-[2px] rounded-br-2xl rounded-bl-2xl bg-self px-[14px] py-[10px] text-on-self shadow-[0px_1px_1px_rgba(0,0,0,0.05)]',
  teacher: 'rounded-tl-[2px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-brand-200/80 bg-brand-50 px-[15px] py-[11px] text-brand-950',
  deskmate: 'rounded-tl-[2px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-amber-200/80 bg-amber-50 px-[15px] py-[11px] text-amber-950',
} as const

const portraitSrc = {
  student: '/portraits/student.png',
  teacher: '/portraits/teacher.png',
  deskmate: '/portraits/deskmate.png',
} as const

const portraitClass = {
  student: 'border-ink-300 bg-ink-100 shadow-[-2px_2px_0_0_var(--color-ink-400)]',
  teacher: 'border-brand-200 bg-brand-50 shadow-[2px_2px_0_0_var(--color-brand-300)]',
  deskmate: 'border-amber-200 bg-amber-50 shadow-[2px_2px_0_0_var(--color-amber-300)]',
} as const

const nameClass = {
  student: 'text-on-self',
  teacher: 'text-brand-900',
  deskmate: 'text-amber-950',
} as const

const roleClass = {
  student: 'text-on-self/70',
  teacher: 'text-brand-600',
  deskmate: 'text-amber-700',
} as const

const text = ref('')
const pending = ref('')
const scroller = ref<HTMLElement | null>(null)
let revealObserver: IntersectionObserver | null = null
const mounted = ref(false)

function scrollToNewest() {
  const element = scroller.value
  if (!element || element.clientHeight === 0) return
  element.scrollTop = element.scrollHeight
}

const rows = computed(() => {
  // Dated in the browser's time zone. On the server the times are hidden so
  // the first render cannot disagree with the student's clock.
  const dates = mounted.value
    ? dateMessages(props.messages)
    : props.messages.map(() => ({ day: null, time: null }))
  const shown: Array<BubbleRow | EventRow | TypingRow> = props.messages.map((message, index) => {
    const { day, time } = dates[index]!
    if (message.author === 'event') {
      return {
        key: message.id,
        kind: 'event' as const,
        name: message.name,
        text: message.text,
        day,
        time,
      }
    }
    return {
      key: message.id,
      kind: 'bubble' as const,
      author: message.author,
      name: message.name,
      role: message.role,
      text: message.text,
      openInLearn: message.openInLearn,
      writing: false,
      day,
      time,
    }
  })

  if (props.sending && pending.value) {
    shown.push({
      key: 'pending-student',
      kind: 'bubble',
      author: 'student',
      name: props.displayName,
      role: 'Student',
      text: pending.value,
      openInLearn: false,
      writing: false,
      day: null,
      time: null,
    })
  }
  if (props.streamingTeacher) {
    shown.push({
      key: 'streaming-teacher',
      kind: 'bubble',
      author: 'teacher',
      name: 'Teacher',
      role: '',
      text: props.streamingTeacher,
      openInLearn: false,
      writing: true,
      day: null,
      time: null,
    })
  }
  else if (props.sending) {
    shown.push({
      key: 'typing-teacher',
      kind: 'typing',
      author: 'teacher',
      name: 'Teacher',
    })
  }
  if (props.streamingDeskmate) {
    shown.push({
      key: 'streaming-deskmate',
      kind: 'bubble',
      author: 'deskmate',
      name: 'Mai',
      role: 'Deskmate',
      text: props.streamingDeskmate,
      openInLearn: false,
      writing: true,
      day: null,
      time: null,
    })
  }
  else if (props.sending) {
    shown.push({
      key: 'typing-deskmate',
      kind: 'typing',
      author: 'deskmate',
      name: 'Mai',
    })
  }
  return shown
})

watch(() => [rows.value.length, props.streamingTeacher, props.streamingDeskmate, props.sending] as const, () => {
  nextTick(scrollToNewest)
})

onMounted(() => {
  mounted.value = true
  const element = scroller.value
  if (!element) return
  let wasHidden = element.clientHeight === 0
  revealObserver = new IntersectionObserver((entries) => {
    const visible = entries.some(entry => entry.isIntersecting)
    if (visible && wasHidden) {
      scrollToNewest()
      nextTick(scrollToNewest)
    }
    wasHidden = !visible
  })
  revealObserver.observe(element)
})

onBeforeUnmount(() => {
  revealObserver?.disconnect()
  revealObserver = null
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
    class="flex h-full min-h-0 min-w-0 flex-col bg-ink-50/40"
    aria-label="Conversation"
  >
    <header class="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-paper px-4 md:h-14 md:flex-nowrap lg:px-6">
      <div class="flex min-w-0 flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <h2 class="text-xs leading-4 font-semibold tracking-[-0.2px] text-ink-800">
            Conversation
          </h2>
          <span
            v-if="floating"
            class="hidden size-1.5 shrink-0 rounded-full bg-emerald-500 lg:block"
            aria-hidden="true"
          />
        </div>
        <p class="font-mono text-[10px] leading-[15px] text-ink-400 max-md:hidden">
          Teacher + Deskmate
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span
          id="conversation-shield"
          class="text-[11px] leading-[16.5px] text-ink-500"
        >VerifyShield</span>
        <button
          type="button"
          role="switch"
          class="relative h-11 w-11 shrink-0 md:h-4 md:w-7 md:rounded-full"
          :class="verifyShieldOn ? 'md:bg-brand-600' : 'md:bg-ink-200'"
          :aria-checked="verifyShieldOn"
          :disabled="verifyShieldBusy"
          aria-labelledby="conversation-shield"
          @click="emit('toggleVerifyShield', !verifyShieldOn)"
        >
          <span
            class="absolute top-1/2 left-1/2 h-4 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full md:hidden"
            :class="verifyShieldOn ? 'bg-brand-600' : 'bg-ink-200'"
            aria-hidden="true"
          />
          <span
            class="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-paper shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            :class="verifyShieldOn ? 'left-[22px] md:left-3.5' : 'left-[10px] md:left-0.5'"
          />
        </button>
        <button
          v-if="floating"
          type="button"
          class="ml-1 inline-flex size-11 items-center justify-center rounded-sm text-ink-500 hover:bg-ink-100 hover:text-ink-900 md:size-7"
          aria-label="Close conversation"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </header>

    <p
      v-if="verifyShieldError"
      class="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
      role="alert"
    >
      {{ verifyShieldError }}
    </p>

    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-5"
    >
      <p
        v-if="loading"
        role="status"
        class="text-sm text-ink-400"
      >
        Loading conversation
      </p>
      <p
        v-else-if="rows.length === 0"
        class="text-sm text-ink-400"
      >
        No messages yet.
      </p>
      <ol
        v-else
        class="flex flex-col gap-4"
      >
        <template
          v-for="row in rows"
          :key="row.key"
        >
        <li
          v-if="row.kind !== 'typing' && row.day"
          class="flex w-full items-center gap-3"
          data-day-separator
        >
          <span class="h-px flex-1 bg-ink-200" aria-hidden="true" />
          <span class="text-[11px] leading-4 font-medium text-ink-500">{{ row.day }}</span>
          <span class="h-px flex-1 bg-ink-200" aria-hidden="true" />
        </li>
        <li
          class="flex w-full"
          :class="row.kind === 'event' ? 'justify-center' : row.author === 'student' ? 'justify-end' : 'justify-start'"
        >
          <p
            v-if="row.kind === 'event'"
            class="rounded-full bg-ink-100 px-2.5 py-0.5 text-center font-mono text-[10px] leading-[15px] text-ink-500"
          >
            {{ row.name }} · {{ row.text }}<template v-if="row.time">
              · <time data-message-time>{{ row.time }}</time></template>
          </p>
          <div
            v-else-if="row.kind === 'typing'"
            class="flex max-w-[96%] items-start gap-3"
            role="status"
            :aria-label="`${row.name} is writing`"
          >
            <span
              class="mt-0.5 size-11 shrink-0 overflow-hidden rounded-[4px] border"
              :class="portraitClass[row.author]"
              aria-hidden="true"
            >
              <img
                :src="portraitSrc[row.author]"
                alt=""
                class="size-full object-cover [image-rendering:pixelated]"
              >
            </span>
            <article
              class="w-fit max-w-full min-w-0 text-[13px] leading-5"
              :class="bubbleClass[row.author]"
            >
              <p class="mb-0.5 text-[12px] leading-4 font-semibold" :class="nameClass[row.author]">
                {{ row.name }}
              </p>
              <p class="flex items-center gap-1 py-1" aria-hidden="true">
                <span class="size-1.5 animate-pulse rounded-full bg-current opacity-70" />
                <span class="size-1.5 animate-pulse rounded-full bg-current opacity-70 [animation-delay:150ms]" />
                <span class="size-1.5 animate-pulse rounded-full bg-current opacity-70 [animation-delay:300ms]" />
              </p>
            </article>
          </div>
          <div
            v-else
            class="flex max-w-[96%] items-start gap-3"
            :class="row.author === 'student' ? 'flex-row-reverse' : 'flex-row'"
          >
            <span
              class="mt-0.5 size-11 shrink-0 overflow-hidden rounded-[4px] border"
              :class="portraitClass[row.author]"
              :data-portrait="row.author"
              aria-hidden="true"
            >
              <img
                :src="portraitSrc[row.author]"
                alt=""
                class="size-full object-cover [image-rendering:pixelated]"
              >
            </span>
            <article
              class="w-fit max-w-full min-w-0 text-[13px] leading-5 break-words"
              :class="bubbleClass[row.author]"
            >
              <p class="mb-0.5 flex items-baseline gap-1.5">
                <span
                  class="text-[12px] leading-4 font-semibold"
                  :class="nameClass[row.author]"
                >{{ row.name }}</span>
                <span
                  v-if="row.role"
                  class="text-[11px] leading-4"
                  :class="roleClass[row.author]"
                >{{ row.role }}</span>
                <time
                  v-if="row.time"
                  class="ml-auto pl-2 font-mono text-[10px] leading-4 opacity-60"
                  data-message-time
                >{{ row.time }}</time>
              </p>
              <p v-if="row.author === 'student'">
                {{ row.text }}
              </p>
              <ChatMarkdown
                v-else
                :text="row.text"
                :writing="row.writing"
              />
              <button
                v-if="row.openInLearn"
                type="button"
                class="mt-2 text-[11px] leading-4 font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-700"
                @click="emit('openLearn')"
              >
                Open in Learn
              </button>
            </article>
          </div>
        </li>
        </template>
      </ol>
    </div>

    <form
      class="shrink-0 border-t border-ink-200 bg-paper p-3 md:px-4"
      @submit.prevent="submit"
    >
      <div class="flex items-center gap-2">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Message</span>
          <input
            v-model="text"
            name="message"
            placeholder="Message"
            :disabled="sending"
            class="h-11 w-full rounded-[4px] border border-ink-200 bg-ink-50 px-[13px] text-base text-ink-800 outline-none placeholder:text-ink-400 focus-visible:border-brand-500 disabled:opacity-60 md:h-[34px] md:text-xs"
          >
        </label>
        <button
          type="submit"
          class="h-11 min-w-11 shrink-0 rounded-[4px] bg-accent px-3 text-xs leading-4 font-medium text-on-accent shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:bg-accent-hover disabled:bg-accent disabled:text-on-accent disabled:opacity-100 md:h-[34px] md:min-w-0 md:px-3.5"
          :disabled="sending || text.trim().length === 0"
          :aria-busy="sending"
        >
          <span class="inline-flex items-center gap-1.5">
            <BusySpinner v-if="sending" />
            Send
          </span>
        </button>
      </div>
      <p
        v-if="sendError"
        role="alert"
        class="mt-2 text-sm text-rose-600"
      >
        {{ sendError }}
      </p>
    </form>
  </section>
</template>
