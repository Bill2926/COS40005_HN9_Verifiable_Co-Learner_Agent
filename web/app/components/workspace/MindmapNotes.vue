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
  // The module selected on the canvas; a new note links to it unless a note is selected.
  defaultModuleId?: string
  saving: boolean
  saved: string
  error: string
}>()

const emit = defineEmits<{
  select: [id: string]
  save: [draft: { id: string | null, title: string, body: string, colour: string, moduleId: string, target: LinkChoice | null }]
  remove: [id: string]
  link: [noteId: string, targetNoteId: string]
  unlink: [linkId: string]
}>()

type LinkChoice = { kind: 'module', moduleId: string } | { kind: 'note', noteId: string }

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
// A new note's first link, written as `module:<id>` or `note:<id>`.
const firstLink = ref('')
const linkTargetId = ref('')

const selected = computed(() => props.notes.find(note => note.id === props.selectedId) ?? null)
const formOpen = computed(() => drafting.value || selected.value !== null)
const canSave = computed(() => title.value.trim().length > 0
  && (drafting.value ? firstLink.value.length > 0 : moduleId.value.length > 0)
  && !props.saving)
const otherNotes = computed(() => props.notes.filter(note => note.id !== props.selectedId))
const noteToNoteLinks = computed(() => {
  const note = selected.value
  if (!note) return []
  return props.links.filter(link => link.fromNoteId === note.id && link.target.kind === 'note')
})

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
  linkTargetId.value = ''
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
  const preselected = props.selectedId && props.notes.some(note => note.id === props.selectedId)
    ? `note:${props.selectedId}`
    : props.defaultModuleId ? `module:${props.defaultModuleId}` : ''
  drafting.value = true
  title.value = ''
  body.value = ''
  colour.value = 'brand'
  moduleId.value = ''
  firstLink.value = preselected
  linkTargetId.value = ''
  emit('select', '')
}

function linkTitle(link: ModuleLink): string {
  const target = link.target
  if (target.kind !== 'note') return ''
  return preview(props.notes.find(note => note.id === target.noteId)?.text ?? '')
}

function linkNote() {
  if (!selected.value || !linkTargetId.value) return
  emit('link', selected.value.id, linkTargetId.value)
  linkTargetId.value = ''
}

function openNote(id: string) {
  emit('select', id)
}

function firstTarget(): LinkChoice | null {
  const [kind, id = ''] = firstLink.value.split(/:(.*)/s)
  if (!id) return null
  return kind === 'note' ? { kind: 'note', noteId: id } : { kind: 'module', moduleId: id }
}

function save() {
  if (!canSave.value) return
  emit('save', {
    id: drafting.value ? null : props.selectedId || null,
    title: title.value.trim(),
    body: body.value,
    colour: colour.value,
    moduleId: moduleId.value,
    target: drafting.value ? firstTarget() : null,
  })
}
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-y-auto bg-paper" aria-label="Notes">
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
      A note needs a title and a link to a module or another note. It appears on the map when you save.
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
        <select
          v-if="drafting"
          v-model="firstLink"
          class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-2 text-sm font-normal text-ink-900"
        >
          <option value="" disabled>Choose a module or note</option>
          <optgroup label="Modules">
            <option v-for="module in modules" :key="module.id" :value="`module:${module.id}`">{{ module.name }}</option>
          </optgroup>
          <optgroup v-if="notes.length > 0" label="Notes">
            <option v-for="note in notes" :key="note.id" :value="`note:${note.id}`">{{ preview(note.text) }}</option>
          </optgroup>
        </select>
        <select v-else v-model="moduleId" class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-2 text-sm font-normal text-ink-900">
          <option value="" disabled>Choose a module</option>
          <option v-for="module in modules" :key="module.id" :value="module.id">{{ module.name }}</option>
        </select>
      </label>
      <p class="text-xs leading-5 text-ink-500">A note always keeps at least one link, to a module or another note. Save puts it on the map.</p>
      <div v-if="selected && !drafting" class="border-t border-ink-200 pt-3">
        <p class="text-xs font-medium text-ink-700">Links to other notes</p>
        <ul v-if="noteToNoteLinks.length > 0" class="mt-1 flex flex-col gap-1" aria-label="Linked notes">
          <li v-for="link in noteToNoteLinks" :key="link.id" class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-xs text-ink-700">{{ linkTitle(link) }}</span>
            <button
              type="button"
              class="min-h-11 rounded-sm border border-rose-200 px-2 text-xs text-rose-700"
              @click="emit('unlink', link.id)"
            >
              Remove link
            </button>
          </li>
        </ul>
        <p v-else class="mt-1 text-xs text-ink-500">No links to other notes yet.</p>
        <div class="mt-1 flex items-center gap-2">
          <select
            v-model="linkTargetId"
            aria-label="Link to another note"
            class="min-h-11 min-w-0 flex-1 rounded-sm border border-ink-300 px-2 text-sm font-normal text-ink-900"
          >
            <option value="">Choose a note</option>
            <option v-for="note in otherNotes" :key="note.id" :value="note.id">{{ preview(note.text) }}</option>
          </select>
          <button
            type="button"
            class="min-h-11 rounded-sm border border-ink-300 px-3 text-sm text-ink-800 disabled:opacity-60"
            :disabled="!linkTargetId || saving"
            @click="linkNote"
          >
            Link
          </button>
        </div>
      </div>
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
    <p v-if="saved" class="mt-2 text-sm text-emerald-700" role="status" data-note-saved>{{ saved }}</p>
    <p v-if="error" class="mt-2 text-sm text-rose-700" role="alert">{{ error }}</p>
  </section>
</template>
