<script setup lang="ts">
import { parseChatMarkdown } from '~/workspace/chat-markdown'
import ChatInline from './ChatInline.vue'

const props = defineProps<{
  text: string
  // A reply still arriving shows a caret where the next word will land.
  writing?: boolean
}>()

const blocks = computed(() => parseChatMarkdown(props.text))
const lastIndex = computed(() => blocks.value.length - 1)
</script>

<template>
  <div class="flex flex-col gap-2">
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
      <pre
        v-else-if="block.type === 'codeblock'"
        class="overflow-x-auto rounded-[6px] border border-black/10 bg-white/70 px-3 py-2 font-mono text-[12px] leading-5 whitespace-pre"
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
