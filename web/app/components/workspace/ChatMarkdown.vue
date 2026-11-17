<script setup lang="ts">
import { parseChatMarkdown } from '~/workspace/chat-markdown'
import ChatInline from './ChatInline.vue'

const props = defineProps<{
  text: string
  // A reply still arriving shows a caret where the next word will land.
  writing?: boolean
  // Materials ask for a real heading. A reply keeps a heading line as bold text.
  headings?: boolean
}>()

const blocks = computed(() => parseChatMarkdown(props.text, { headings: props.headings }))

function headingTag(level: number): 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  if (level <= 2) return 'h2'
  if (level === 3) return 'h3'
  if (level === 4) return 'h4'
  if (level === 5) return 'h5'
  return 'h6'
}
const lastIndex = computed(() => blocks.value.length - 1)
</script>

<template>
  <div class="flex min-w-0 max-w-full flex-col gap-2">
    <template
      v-for="(block, index) in blocks"
      :key="index"
    >
      <p v-if="block.type === 'paragraph'">
        <ChatInline :nodes="block.children" /><span
          v-if="writing && index === lastIndex"
          class="ml-0.5 inline-block h-[1em] w-px animate-pulse bg-current align-middle"
          aria-hidden="true"
        />
      </p>
      <component
        :is="headingTag(block.level)"
        v-else-if="block.type === 'heading'"
        class="font-semibold text-balance text-ink-900"
        :class="block.level <= 2 ? 'text-base' : 'text-sm'"
      >
        <ChatInline :nodes="block.children" />
      </component>
      <pre
        v-else-if="block.type === 'codeblock'"
        class="max-w-full min-w-0 overflow-x-auto rounded-[6px] border border-ink-950/10 bg-paper/70 px-3 py-2 font-mono text-[12px] leading-5 whitespace-pre"
      ><code>{{ block.value }}</code></pre>
      <component
        :is="block.ordered ? 'ol' : 'ul'"
        v-else
        class="flex flex-col gap-1 pl-5"
        :class="block.ordered ? 'list-decimal' : 'list-disc'"
      >
        <li
          v-for="(item, itemIndex) in block.items"
          :key="itemIndex"
        >
          <ChatInline :nodes="item" />
        </li>
      </component>
    </template>
    <span
      v-if="writing && (blocks.length === 0 || blocks[lastIndex]?.type !== 'paragraph')"
      class="inline-block h-[1em] w-px animate-pulse bg-current align-middle"
      aria-hidden="true"
    />
  </div>
</template>
