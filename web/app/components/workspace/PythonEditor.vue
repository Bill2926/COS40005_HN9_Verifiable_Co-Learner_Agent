<script setup lang="ts">
const code = defineModel<string>({ required: true })

const props = defineProps<{
  active: boolean
}>()

const host = ref<HTMLElement | null>(null)
let editor: { destroy: () => void, requestMeasure: () => void } | null = null
let measureObserver: ResizeObserver | null = null
let alive = true

onMounted(async () => {
  const [{ EditorView, basicSetup }, { python }, { EditorState }, { indentUnit }, { pythonHighlighting, pythonHighlightColours }] = await Promise.all([
    import('codemirror'),
    import('@codemirror/lang-python'),
    import('@codemirror/state'),
    import('@codemirror/language'),
    import('~/python/highlight'),
  ])
  const parent = host.value
  if (!alive || !parent) return

  editor = new EditorView({
    parent,
    state: EditorState.create({
      doc: code.value,
      extensions: [
        basicSetup,
        python(),
        pythonHighlighting,
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        EditorView.contentAttributes.of({
          'aria-label': 'Python editor',
          spellcheck: 'false',
          autocapitalize: 'none',
          autocorrect: 'off',
        }),
        EditorView.updateListener.of((update) => {
          if (alive && update.docChanged) code.value = update.state.doc.toString()
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: 'var(--python-editor-font-size)', color: pythonHighlightColours.text },
          '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 'var(--python-editor-font-size)' },
          '.cm-content, .cm-line': { fontSize: 'var(--python-editor-font-size)' },
        }),
      ],
    }),
  })
  measureObserver = new ResizeObserver(() => {
    editor?.requestMeasure()
  })
  measureObserver.observe(parent)
})

watch(() => props.active, (active) => {
  if (active) editor?.requestMeasure()
})

onBeforeUnmount(() => {
  alive = false
  measureObserver?.disconnect()
  measureObserver = null
  editor?.destroy()
  editor = null
})
</script>

<template>
  <div
    ref="host"
    class="h-full"
  />
</template>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
  background-color: transparent;
}

:deep(.cm-scroller) {
  overflow: auto;
}
</style>
