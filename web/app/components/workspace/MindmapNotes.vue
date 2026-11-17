<script setup lang="ts">
import type { NoteColour } from '#shared/mindmap'

interface NoteItem {
  id: string
  text: string
  colour: string
  imageUrl: string | null
}

interface NoteImage {
  contentType: string
  base64: string
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
  save: [draft: { id: string | null, title: string, body: string, colour: string, moduleId: string, image: NoteImage | null }]
  remove: [id: string]
  link: [noteId: string, targetNoteId: string]
  unlink: [linkId: string]
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
const image = ref<NoteImage | null>(null)
const imagePreview = ref('')
const imageError = ref('')
const linkTargetId = ref('')

// The same checks the server runs, so a picture it would refuse never leaves
// this panel.
const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
const imageLimit = 2 * 1024 * 1024

const selected = computed(() => props.notes.find(note => note.id === props.selectedId) ?? null)
const formOpen = computed(() => drafting.value || selected.value !== null)
const canSave = computed(() => title.value.trim().length > 0 && moduleId.value.length > 0 && !props.saving)
const shownImage = computed(() => imagePreview.value || selected.value?.imageUrl || '')
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
  resetImage()
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
  drafting.value = true
  title.value = ''
  body.value = ''
  colour.value = 'brand'
  moduleId.value = ''
  resetImage()
  linkTargetId.value = ''
  emit('select', '')
}

function resetImage() {
  image.value = null
  imagePreview.value = ''
  imageError.value = ''
}

function linkTitle(link: ModuleLink): string {
  const target = link.target
  if (target.kind !== 'note') return ''
  return preview(props.notes.find(note => note.id === target.noteId)?.text ?? '')
}

async function onImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  resetImage()
  if (!imageTypes.includes(file.type)) {
    input.value = ''
    imageError.value = 'Use a JPEG, PNG or WebP picture.'
    return
  }
  if (file.size > imageLimit) {
    input.value = ''
    imageError.value = 'The picture must be 2 MB or smaller.'
    return
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  image.value = { contentType: file.type, base64: btoa(binary) }
  imagePreview.value = URL.createObjectURL(file)
}

function linkNote() {
  if (!selected.value || !linkTargetId.value) return
  emit('link', selected.value.id, linkTargetId.value)
  linkTargetId.value = ''
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
    image: image.value,
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
      <label class="text-xs font-medium text-ink-700">
        Image (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="mt-1 w-full text-xs font-normal text-ink-700 file:mr-2 file:min-h-9 file:rounded-sm file:border-0 file:bg-ink-100 file:px-2 file:text-ink-800"
          @change="onImage"
        >
      </label>
      <img
        v-if="shownImage"
        :src="shownImage"
        alt="Note image"
        class="max-h-40 w-full rounded-sm border border-ink-200 object-contain"
        data-note-image
      >
      <p v-if="imageError" class="text-xs text-rose-700" role="alert">{{ imageError }}</p>
      <p class="text-xs leading-5 text-ink-500">A note has to be linked to one module. Save puts it on the map.</p>
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
    <p v-if="error" class="mt-2 text-sm text-rose-700" role="alert">{{ error }}</p>
  </section>
</template>
