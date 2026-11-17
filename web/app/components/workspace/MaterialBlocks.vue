<script setup lang="ts">
import type { MaterialBlock } from '#shared/turn'
import ChatMarkdown from './ChatMarkdown.vue'
import MaterialVideo from './MaterialVideo.vue'
import MermaidDiagram from './MermaidDiagram.vue'
import PythonExample from './PythonExample.vue'

defineProps<{
  blocks: readonly MaterialBlock[]
}>()
</script>

<template>
  <div class="flex min-w-0 max-w-full flex-col gap-6">
    <template v-for="(block, index) in blocks" :key="index">
      <div v-if="block.type === 'text'" class="material-text min-w-0 max-w-full text-sm leading-6 text-ink-700" data-quote-source="materials">
        <ChatMarkdown :text="block.markdown" headings />
      </div>
      <div
        v-else-if="block.type === 'code'"
        class="min-w-0 max-w-full overflow-hidden rounded-[8px] border border-ink-200 bg-ink-50/90 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
      >
        <div class="flex h-9 items-center justify-between border-b border-ink-200 bg-ink-100/60 px-4">
          <p class="font-mono text-[11px] leading-[16.5px] text-ink-500">Example</p>
          <p class="font-mono text-[10px] leading-[15px] text-ink-400">Python</p>
        </div>
        <PythonExample :code="block.code" />
      </div>
      <MermaidDiagram v-else-if="block.type === 'diagram'" :source="block.mermaid" />
      <img
        v-else-if="block.type === 'image'"
        :src="block.url"
        :alt="block.alt"
        class="block h-auto max-w-full rounded-[8px] border border-ink-200"
      >
      <MaterialVideo v-else :url="block.url" :title="block.title" />
    </template>
  </div>
</template>
