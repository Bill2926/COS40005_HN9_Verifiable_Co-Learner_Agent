<script setup lang="ts">
export interface PrototypeVariant {
  key: string
  name: string
}

const props = defineProps<{
  variants: readonly PrototypeVariant[]
  current: string
}>()

const emit = defineEmits<{
  cycle: [direction: -1 | 1]
}>()

const enabled = import.meta.dev

const currentVariant = computed(() =>
  props.variants.find(variant => variant.key === props.current) ?? props.variants[0],
)

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const field = target.closest('input, textarea, [contenteditable]')
  if (!(field instanceof HTMLElement)) return false
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return true
  return field.isContentEditable
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (isEditableTarget(event.target)) return
  event.preventDefault()
  emit('cycle', event.key === 'ArrowLeft' ? -1 : 1)
}

onMounted(() => {
  if (!enabled) return
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="enabled"
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-950 px-1.5 py-1.5 text-white shadow-lg"
    role="toolbar"
    aria-label="Layout prototype"
  >
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
      aria-label="Previous layout"
      @click="emit('cycle', -1)"
    >
      ←
    </button>
    <p class="min-w-40 px-2 text-center text-sm">
      {{ currentVariant?.key }} ({{ currentVariant?.name }})
    </p>
    <button
      type="button"
      class="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
      aria-label="Next layout"
      @click="emit('cycle', 1)"
    >
      →
    </button>
  </div>
</template>
