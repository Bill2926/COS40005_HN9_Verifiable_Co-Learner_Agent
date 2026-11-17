<script setup lang="ts">
const props = defineProps<{
  source: string
}>()

const svg = ref('')
const failed = ref(false)

async function draw() {
  failed.value = false
  svg.value = ''
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
    const id = `diagram-${crypto.randomUUID()}`
    const drawn = await mermaid.render(id, props.source)
    svg.value = drawn.svg
  }
  catch {
    failed.value = true
  }
}

onMounted(draw)
watch(() => props.source, draw)
</script>

<template>
  <div class="w-full max-w-full overflow-hidden rounded-[8px] border border-ink-200 bg-paper p-3" aria-label="Diagram">
    <div v-if="svg" class="[&_svg]:h-auto [&_svg]:max-w-full" v-html="svg" />
    <pre v-else-if="failed" class="overflow-x-auto font-mono text-xs whitespace-pre-wrap text-ink-600">{{ source }}</pre>
  </div>
</template>
