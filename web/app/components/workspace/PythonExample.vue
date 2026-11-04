<script setup lang="ts">
const props = defineProps<{
  code: string
}>()

const host = ref<HTMLElement | null>(null)
let view: { destroy: () => void } | null = null
let alive = true

onMounted(async () => {
  const [{ EditorView }, { EditorState }, { python }, { pythonHighlighting, pythonHighlightColours }] = await Promise.all([
    import('codemirror'),
    import('@codemirror/state'),
    import('@codemirror/lang-python'),
    import('~/python/highlight'),
  ])
  if (!alive || !host.value) return

  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.code,
      extensions: [
        python(),
        pythonHighlighting,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({
          'aria-label': 'Example',
          'aria-readonly': 'true',
        }),
        EditorView.theme({
          '&': {
            backgroundColor: 'transparent',
            color: pythonHighlightColours.text,
            fontSize: '12px',
          },
          '&.cm-focused': { outline: 'none' },
          '.cm-scroller': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            lineHeight: '19.5px',
            overflow: 'auto',
          },
          '.cm-content': { padding: '16px', caretColor: 'transparent' },
          '.cm-line': { padding: '0' },
          '.cm-cursor, .cm-dropCursor': { display: 'none' },
          '.cm-gutters': { display: 'none' },
        }),
      ],
    }),
  })
})

onBeforeUnmount(() => {
  alive = false
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" />
</template>

<style scoped>
:deep(.cm-editor) {
  background-color: transparent;
}
</style>
