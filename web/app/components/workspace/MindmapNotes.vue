<script setup lang="ts">
import type { NoteColour } from '#shared/mindmap'

interface NoteItem {
  id: string
  text: string
  colour: string
}

interface ModuleLink {
  id: string
  fromNoteId: string
  target: { kind: 'module', moduleId: string } | { kind: 'note', noteId: string }
}

const props = defineProps<{
  notes: NoteItem[]
  links: ModuleLink[]
  modules: { id: string, name: string }[]
  selectedId: string
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  select: [id: string]
  save: [draft: { id: string | null, title: string, body: string, colour: string, moduleId: string }]
  remove: [id: string]
}>()

const swatches: { id: NoteColour, label: string, dot: string, edge: string }[] = [
  { id: 'ink', label: 'Ink', dot: 'bg-ink-800', edge: 'border-l-ink-800' },
  { id: 'brand', label: 'Blue', dot: 'bg-brand-500', edge: 'border-l-brand-500' },
  { id: 'sky', label: 'Sky', dot: 'bg-sky-400', edge: 'border-l-sky-400' },
  { id: 'emerald', label: 'Green', dot: 'bg-emerald-500', edge: 'border-l-emerald-500' },
  { id: 'amber', label: 'Amber', dot: 'bg-amber-400', edge: 'border-l-amber-400' },
  { id: 'rose', label: 'Rose', dot: 'bg-rose-500', edge: 'border-l-rose-500' },
  { id: 'purple', label: 'Purple', dot: 'bg-purple-500', edge: 'border-l-purple-500' },
]

const drafting = ref(false)
const title = ref('')
const body = ref('')
const colour = ref<NoteColour>('brand')
const moduleId = ref('')

const selected = computed(() => props.notes.find(note => note.id === props.selectedId) ?? null)
const formOpen = computed(() => drafting.value || selected.value !== null)
const canSave = computed(() => title.value.trim().length > 0 && moduleId.value.length > 0 && !props.saving)

watch(() => props.selectedId, (id) => {
  if (!id) return
  const note = props.notes.find(item => item.id === id)
  if (!note) return
  drafting.value = false
  const parts = splitNote(note.text)
  title.value = parts.title
  body.value = parts.body
  colour.value = isSwatch(note.colour) ? note.colour : 'brand'
  moduleId.value = linkedModule(note.id)
})

function isSwatch(value: string): value is NoteColour {
  return swatches.some(swatch => swatch.id === value)
}

function splitNote(text: string): { title: string, body: string } {
  const breakAt = text.indexOf('\n')
  if (breakAt < 0) return { title: text, body: '' }
  return { title: text.slice(0, breakAt), body: text.slice(breakAt + 1) }
}

function linkedModule(noteId: string): string {
  const link = props.links.find(item => item.fromNoteId === noteId && item.target.kind === 'module')
  return link && link.target.kind === 'module' ? link.target.moduleId : ''
}

function edgeOf(value: string): string {
  return swatches.find(swatch => swatch.id === value)?.edge ?? 'border-l-ink-300'
}

function preview(text: string): string {
  const line = text.trim().split('\n')[0] ?? ''
  return line || 'Untitled'
}

function startDraft() {
  drafting.value = true
  title.value = ''
  body.value = ''
  colour.value = 'brand'
  moduleId.value = ''
  emit('select', '')
}

function openNote(id: string) {
  emit('select', id)
}

function save() {
  if (!canSave.value) return
  emit('save', {
    id: drafting.value ? null : props.selectedId || null,
    title: title.value.trim(),
    body: body.value,
    colour: colour.value,
    moduleId: moduleId.value,
  })
}
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-y-auto bg-paper p-3" aria-label="Notes">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-medium text-ink-900">Notes</h2>
      <button
        type="button"
        class="min-h-11 rounded-sm bg-accent px-3 text-sm text-on-accent disabled:opacity-60"
        :disabled="saving"
        @click="startDraft"
      >
        New note
      </button>
    </div>
    <p v-if="notes.length === 0 && !formOpen" class="mt-2 text-xs leading-5 text-ink-500">
      A note needs a title and one module. It appears on the map when you save.
    </p>
    <ul v-if="notes.length > 0" class="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto" aria-label="Your notes">
      <li v-for="note in notes" :key="note.id">
        <button
          type="button"
          class="flex min-h-11 w-full items-center border-l-4 px-2 text-left text-sm"
          :class="[edgeOf(note.colour), note.id === selectedId && !drafting ? 'bg-brand-50 text-ink-900' : 'text-ink-700 hover:bg-ink-50']"
          :aria-current="note.id === selectedId && !drafting ? 'true' : undefined"
          @click="openNote(note.id)"
        >
          <span class="truncate">{{ preview(note.text) }}</span>
        </button>
      </li>
    </ul>
    <form v-if="formOpen" class="mt-3 flex flex-col gap-3 border-t border-ink-200 pt-3" @submit.prevent="save">
      <label class="text-xs font-medium text-ink-700">
        Title
        <input
          v-model="title"
          type="text"
          class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-2 text-sm font-normal text-ink-900"
        >
      </label>
      <label class="text-xs font-medium text-ink-700">
        Note
        <textarea
          v-model="body"
          rows="4"
          class="mt-1 w-full rounded-sm border border-ink-300 p-2 text-sm font-normal text-ink-900"
        />
      </label>
      <div>
        <p id="note-colour-label" class="text-xs font-medium text-ink-700">Colour</p>
        <div class="mt-1 flex flex-wrap gap-1" role="group" aria-labelledby="note-colour-label">
          <button
            v-for="swatch in swatches"
            :key="swatch.id"
            type="button"
            class="inline-flex size-11 items-center justify-center rounded-full"
            :class="colour === swatch.id ? 'ring-2 ring-ink-800 ring-offset-2 ring-offset-paper' : ''"
            :aria-label="swatch.label"
            :aria-pressed="colour === swatch.id"
            @click="colour = swatch.id"
          >
            <span class="size-6 rounded-full" :class="swatch.dot" aria-hidden="true" />
          </button>
        </div>
      </div>
      <label class="text-xs font-medium text-ink-700">
        Module
        <select v-model="moduleId" class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-2 text-sm font-normal text-ink-900">
          <option value="" disabled>Choose a module</option>
          <option v-for="module in modules" :key="module.id" :value="module.id">{{ module.name }}</option>
        </select>
      </label>
      <p class="text-xs leading-5 text-ink-500">A note has to be linked to one module. Save puts it on the map.</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="submit"
          class="min-h-11 rounded-sm bg-accent px-3 text-sm text-on-accent disabled:opacity-60"
          :disabled="!canSave"
        >
          Save
        </button>
        <button
          v-if="selected && !drafting"
          type="button"
          class="min-h-11 rounded-sm border border-rose-200 px-3 text-sm text-rose-700"
          @click="emit('remove', selected.id)"
        >
          Delete note
        </button>
      </div>
    </form>
    <p v-if="error" class="mt-2 text-sm text-rose-700" role="alert">{{ error }}</p>
  </section>
</template>
