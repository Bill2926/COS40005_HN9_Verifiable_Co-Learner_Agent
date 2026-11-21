<script setup lang="ts">
import type { StudySuggestionView } from '#shared/turn'

// The one next step the rules chose from the student's activity. Closing it and
// following it both dismiss this episode; only following it moves the student,
// and it never submits code.
const props = defineProps<{
  suggestion: StudySuggestionView
  busy: boolean
  error: string
}>()

const emit = defineEmits<{ close: [], follow: [] }>()

const followButton = ref<{ $el?: HTMLElement } | null>(null)

onMounted(() => {
  followButton.value?.$el?.focus()
})

const panel = ref<HTMLElement | null>(null)

// The dialog covers the workspace, so Tab stays on its controls.
function keepFocusInside(event: KeyboardEvent) {
  const controls = [...panel.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []]
  if (controls.length === 0) {
    event.preventDefault()
    return
  }
  const first = controls[0]!
  const last = controls.at(-1)!
  const active = document.activeElement
  if (event.shiftKey && (active === first || !panel.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && (active === last || !panel.value?.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    keepFocusInside(event)
    return
  }
  if (event.key !== 'Escape' || props.busy) return
  event.stopPropagation()
  emit('close')
}
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="study-suggestion-title"
    aria-describedby="study-suggestion-sentence"
    data-study-suggestion
    class="phone-safe fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-ink-900/40 p-4"
    @keydown="onKeydown"
  >
    <div ref="panel" class="flex w-full flex-col gap-4 rounded-xl border border-ink-200 bg-paper p-4 shadow-md md:max-w-md md:p-6">
      <div class="flex flex-col gap-1">
        <h2 id="study-suggestion-title" class="font-mono text-[10px] leading-4 tracking-[0.5px] text-ink-500 uppercase">
          Your next step
        </h2>
        <p id="study-suggestion-sentence" class="text-base/6 text-ink-900">
          {{ suggestion.sentence }}
        </p>
      </div>
      <p
        v-if="error"
        role="alert"
        class="rounded-sm border border-rose-200/80 bg-rose-50 px-[13px] py-[11px] text-xs leading-[19.5px] text-rose-700"
      >
        {{ error }}
      </p>
      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11 px-4 text-sm font-medium text-ink-600 hover:text-ink-900"
          :disabled="busy"
          @click="emit('close')"
        >
          Close
        </UButton>
        <UButton
          ref="followButton"
          type="button"
          class="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
          :disabled="busy"
          @click="emit('follow')"
        >
          {{ suggestion.button }}
        </UButton>
      </div>
    </div>
  </div>
</template>
