<script setup lang="ts">
import { shieldTrace } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

const props = defineProps<{
  state: PrototypeState
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

function send() {
  const text = props.state.composer.trim()
  if (!text) return
  props.state.messages.push({
    id: `an-${props.state.messages.length + 1}`,
    author: 'student',
    name: 'An',
    role: 'Student',
    text,
  })
  props.state.composer = ''
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-default">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-default px-4 py-3">
      <h2 class="text-sm font-medium">
        Conversation
      </h2>
      <USwitch
        v-model="state.traceOpen"
        label="Shield trace"
        size="sm"
      />
    </header>

    <section
      v-if="state.traceOpen"
      class="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-3"
      aria-label="Shield trace"
    >
      <h3 class="text-sm font-semibold">
        {{ shieldTrace.heading }}
      </h3>
      <ul class="mt-2 space-y-1 text-sm">
        <li
          v-for="entry in shieldTrace.entries"
          :key="entry.agent"
        >
          <span class="font-medium">{{ entry.agent }}</span>
          proposed
          <code class="font-mono text-xs">{{ entry.move }}</code>
          · {{ entry.verdict }}
        </li>
      </ul>
    </section>

    <ol class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
      <li
        v-for="message in state.messages"
        :key="message.id"
        class="flex"
        :class="appearance[message.author].row"
      >
        <article
          class="flex max-w-[85%] gap-2 rounded-lg border px-3 py-2"
          :class="appearance[message.author].bubble"
        >
          <span
            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
            :class="appearance[message.author].avatar"
            aria-hidden="true"
          >
            {{ message.name.slice(0, 1) }}
          </span>
          <div class="min-w-0">
            <p class="text-sm">
              <span class="font-medium">{{ message.name }}</span>
              <span
                v-if="message.role !== message.name"
                class="text-muted"
              > · {{ message.role }}</span>
            </p>
            <p class="mt-1 text-sm leading-6">
              {{ message.text }}
            </p>
          </div>
        </article>
      </li>
    </ol>

    <form
      class="shrink-0 border-t border-default px-3 pt-3 pb-16"
      @submit.prevent="send"
    >
      <label
        class="sr-only"
        for="prototype-composer"
      >Message the Teacher and Mai</label>
      <textarea
        id="prototype-composer"
        v-model="state.composer"
        rows="2"
        placeholder="Message the Teacher and Mai"
        class="w-full resize-none rounded-md border border-default bg-default px-3 py-2 text-sm leading-6"
      />
      <div class="mt-2 flex justify-end">
        <UButton
          type="submit"
          label="Send"
          size="sm"
        />
      </div>
    </form>
  </section>
</template>
