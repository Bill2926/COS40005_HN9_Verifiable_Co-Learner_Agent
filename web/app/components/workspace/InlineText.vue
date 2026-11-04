<script setup lang="ts">
const props = defineProps<{
  text: string
}>()

const segments = computed(() => inlineSegments(props.text))

function inlineSegments(source: string): { code: boolean, value: string }[] {
  const parts: { code: boolean, value: string }[] = []
  const pattern = /`([^`\n]+)`/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    const start = match.index
    if (start === undefined) continue
    if (start > cursor) parts.push({ code: false, value: source.slice(cursor, start) })
    parts.push({ code: true, value: match[1] ?? '' })
    cursor = start + match[0].length
  }
  if (cursor < source.length || parts.length === 0) {
    parts.push({ code: false, value: source.slice(cursor) })
  }
  return parts
}
</script>

<template>
  <span>
    <template
      v-for="(segment, index) in segments"
      :key="index"
    >
      <code
        v-if="segment.code"
        class="inline rounded-[4px] border border-indigo-200/50 bg-indigo-50 px-[5px] py-px font-mono text-[12px] leading-[19.5px] text-indigo-700"
      >{{ segment.value }}</code>
      <template v-else>{{ segment.value }}</template>
    </template>
  </span>
</template>
