<script setup lang="ts">
import { diagramTheme } from './diagram-theme'

const props = defineProps<{
  source: string
}>()

const colorMode = useColorMode()
const svg = ref('')
const failed = ref(false)
const mode = computed(() => colorMode.value === 'dark' ? 'dark' : 'light')

let generation = 0

async function draw() {
  const current = ++generation
  failed.value = false
  svg.value = ''
  try {
    const mermaid = (await import('mermaid')).default
    const color = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim()
    mermaid.initialize(diagramTheme(mode.value, color))
    const id = `diagram-${crypto.randomUUID()}`
    const drawn = await mermaid.render(id, props.source)
    if (current !== generation) return
    svg.value = drawn.svg
  }
  catch {
    if (current !== generation) return
    failed.value = true
  }
}

onMounted(draw)
watch([() => props.source, mode], draw)
</script>

<template>
  <div class="w-full min-w-0 max-w-full overflow-hidden rounded-[8px] border border-ink-200 bg-paper p-3" aria-label="Diagram">
    <div v-if="svg" class="min-w-0 [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:w-full" v-html="svg" />
    <pre v-else-if="failed" class="font-mono text-xs break-words whitespace-pre-wrap text-ink-600">{{ source }}</pre>
  </div>
</template>
