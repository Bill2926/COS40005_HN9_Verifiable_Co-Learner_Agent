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
  floating?: boolean
}>()

const agentName = {
  teacher: 'Teacher',
  deskmate: 'Mai',
} as const

const emit = defineEmits<{
  send: [text: string]
  openLearn: []
}>()

interface BubbleRow {
  key: string
  kind: 'bubble'
  author: 'student' | 'teacher' | 'deskmate'
  name: string
  role: string
  text: string
  openInLearn: boolean
}

interface EventRow {
  key: string
  kind: 'event'
  name: string
  text: string
}

const bubbleClass = {
  student: 'rounded-tl-2xl rounded-tr-[2px] rounded-br-2xl rounded-bl-2xl bg-slate-700 px-[14px] py-[10px] text-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)]',
  teacher: 'rounded-tl-[2px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-indigo-200/80 bg-indigo-50 px-[15px] py-[11px] text-indigo-950',
  deskmate: 'rounded-tl-[2px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-amber-200/80 bg-amber-50 px-[15px] py-[11px] text-amber-950',
} as const

const portraitSrc = {
  student: '/portraits/student.png',
  teacher: '/portraits/teacher.png',
  deskmate: '/portraits/deskmate.png',
} as const

const portraitClass = {
  student: 'border-slate-300 bg-slate-100 shadow-[-2px_2px_0_0_var(--color-slate-400)]',
  teacher: 'border-indigo-200 bg-indigo-50 shadow-[2px_2px_0_0_var(--color-indigo-300)]',
  deskmate: 'border-amber-200 bg-amber-50 shadow-[2px_2px_0_0_var(--color-amber-300)]',
} as const

const nameClass = {
  student: 'text-white',
  teacher: 'text-indigo-900',
  deskmate: 'text-amber-950',
} as const

const roleClass = {
  student: 'text-slate-300',
  teacher: 'text-indigo-600',
  deskmate: 'text-amber-700',
} as const

const traceOpen = ref(false)
const traceHeading = computed(() => {
  if (!props.trace) return 'VerifyShield: not active yet'
  return props.trace.verifyShieldOn ? 'VerifyShield: on' : 'VerifyShield: off'
})
const masteryLine = computed(() => {
  if (!props.trace) return ''
  return props.trace.masteries.map(item => `${item.moduleId} ${item.mastery.toFixed(2)}`).join(', ')
})
const text = ref('')
const pending = ref('')
const scroller = ref<HTMLElement | null>(null)
let revealObserver: IntersectionObserver | null = null

function scrollToNewest() {
  const element = scroller.value
  if (!element || element.clientHeight === 0) return
  element.scrollTop = element.scrollHeight
}

const rows = computed(() => {
  const shown: Array<BubbleRow | EventRow> = props.messages.map((message) => {
    if (message.author === 'event') {
      return {
        key: message.id,
        kind: 'event' as const,
        name: message.name,
        text: message.text,
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
    })
  }
  return shown
})

watch(() => [rows.value.length, props.streamingTeacher, props.streamingDeskmate] as const, () => {
  nextTick(scrollToNewest)
})

onMounted(() => {
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
    class="flex h-full min-h-0 min-w-0 flex-col bg-slate-50/40"
    aria-label="Conversation"
  >
    <header class="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 md:h-14">
      <div class="flex min-w-0 items-center gap-[10px]">
        <h2 class="text-xs font-semibold leading-4 tracking-[-0.3px] text-slate-800">
          Conversation
        </h2>
        <span
          v-if="floating"
          class="hidden size-1.5 shrink-0 rounded-full bg-[#10b981] lg:block"
          aria-hidden="true"
        />
        <p class="font-mono text-[10px] leading-[15px] text-slate-400 max-md:hidden">
          Teacher + Deskmate
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span
          id="conversation-trace"
          class="text-[11px] leading-[16.5px] text-slate-400"
        >VerifyShield trace</span>
        <button
          type="button"
          role="switch"
          class="relative h-11 w-11 shrink-0 md:h-4 md:w-7 md:rounded-full"
          :class="traceOpen ? 'md:bg-indigo-600' : 'md:bg-slate-200'"
          :aria-checked="traceOpen"
          aria-labelledby="conversation-trace"
          @click="traceOpen = !traceOpen"
        >
          <span
            class="absolute top-1/2 left-1/2 h-4 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full md:hidden"
            :class="traceOpen ? 'bg-indigo-600' : 'bg-slate-200'"
            aria-hidden="true"
          />
          <span
            class="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            :class="traceOpen ? 'left-[22px] md:left-3.5' : 'left-[10px] md:left-0.5'"
          />
        </button>
      </div>
    </header>

    <section
      v-if="traceOpen"
      class="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-3"
      aria-label="VerifyShield trace"
    >
      <h3 class="text-sm font-semibold">
        {{ traceHeading }}
      </h3>
      <p
        v-if="trace"
        class="mt-1 text-xs leading-4 text-slate-600"
      >
        Mastery: {{ masteryLine }}. Unlocked: {{ trace.unlockedModuleIds.join(', ') }}
      </p>
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
            <template v-if="entry.scope">
              · scope
              <code class="font-mono text-xs">{{ entry.scope }}</code>
            </template>
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
      class="min-h-0 flex-1 overflow-y-auto p-4"
    >
      <p
        v-if="rows.length === 0"
        class="text-sm text-slate-400"
      >
        No messages yet.
      </p>
      <ol
        v-else
        class="flex flex-col gap-4"
      >
        <li
          v-for="row in rows"
          :key="row.key"
          class="flex w-full"
          :class="row.kind === 'event' ? 'justify-center' : row.author === 'student' ? 'justify-end' : 'justify-start'"
        >
          <p
            v-if="row.kind === 'event'"
            class="rounded-[4px] bg-slate-100 px-2 text-center font-mono text-[10px] leading-[15px] text-slate-400"
          >
            {{ row.name }} · {{ row.text }}
          </p>
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
              class="w-fit max-w-full min-w-0 text-[12px] leading-[19.5px] break-words"
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
              </p>
              <p>{{ row.text }}</p>
              <button
                v-if="row.openInLearn"
                type="button"
                class="mt-2 text-[11px] leading-4 font-medium text-indigo-700"
                @click="emit('openLearn')"
              >
                Open in Learn
              </button>
            </article>
          </div>
        </li>
      </ol>
    </div>

    <form
      class="shrink-0 border-t border-slate-200 bg-white px-3 pt-[13px] pb-3"
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
            class="h-11 w-full rounded-[4px] border border-slate-200 bg-slate-50 px-[13px] text-base text-slate-800 outline-none placeholder:text-slate-400 focus-visible:border-indigo-500 disabled:opacity-60 md:h-[34px] md:text-xs"
          >
        </label>
        <button
          type="submit"
          class="h-11 min-w-11 shrink-0 rounded-[4px] bg-indigo-600 px-3 text-xs leading-4 font-medium text-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)] disabled:bg-indigo-600 disabled:text-white disabled:opacity-100 md:h-8 md:min-w-0"
          :disabled="sending || text.trim().length === 0"
          :aria-busy="sending"
        >
          Send
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
