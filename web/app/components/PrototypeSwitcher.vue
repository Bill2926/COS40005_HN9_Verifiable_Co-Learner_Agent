<script setup lang="ts">
export interface PrototypeVariant {
  key: string
  name: string
}

const props = defineProps<{
  variants: readonly PrototypeVariant[]
  current: string
}>()

const route = useRoute()
const router = useRouter()

function destination(key: string) {
  return { path: route.path, query: { variant: key } }
}

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
  const index = props.variants.findIndex(item => item.key === props.current)
  const direction = event.key === 'ArrowLeft' ? -1 : 1
  const next = props.variants[(index + direction + props.variants.length) % props.variants.length]
  if (!next) return
  event.preventDefault()
  void router.push(destination(next.key))
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <nav
    class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 rounded-full bg-neutral-950 p-1 text-sm text-white shadow-lg"
    aria-label="Workspace layout"
  >
    <NuxtLink
      v-for="variant in variants"
      :key="variant.key"
      v-slot="{ href, navigate }"
      custom
      :to="destination(variant.key)"
    >
      <a
        :href="href ?? undefined"
        class="rounded-full px-4 py-2"
        :class="variant.key === current ? 'bg-white font-medium text-neutral-950' : 'hover:bg-white/15'"
        :aria-current="variant.key === current ? 'page' : undefined"
        @click="navigate"
      >{{ variant.name }}</a>
    </NuxtLink>
  </nav>
</template>
