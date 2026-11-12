<script setup lang="ts">
import type { InlineNode } from '~/workspace/chat-markdown'

defineProps<{ nodes: InlineNode[] }>()
</script>

<template>
  <template
    v-for="(node, index) in nodes"
    :key="index"
  >
    <code
      v-if="node.type === 'code'"
      class="rounded-[4px] border border-black/10 bg-white/70 px-1 py-px font-mono text-[12px] leading-5 break-words"
    >{{ node.value }}</code>
    <strong
      v-else-if="node.type === 'strong'"
      class="font-semibold"
    ><ChatInline :nodes="node.children" /></strong>
    <em
      v-else-if="node.type === 'em'"
    ><ChatInline :nodes="node.children" /></em>
    <br v-else-if="node.type === 'break'">
    <template v-else>{{ node.value }}</template>
  </template>
</template>
