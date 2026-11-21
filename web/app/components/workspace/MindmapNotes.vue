<script setup lang="ts">
import type { NoteColour } from '#shared/mindmap'
import ChatMarkdown from './ChatMarkdown.vue'

interface NoteItem {
  id: string
  text: string
  colour: string
  imageUrl: string | null
}

interface ModuleLink {
  id: string
  fromNoteId: string
  target: { kind: 'module', moduleId: string } | { kind: 'note', noteId: string }
}

type LinkChoice = { kind: 'module', moduleId: string } | { kind: 'note', noteId: string }

// The image the save carries: a picked file, null to remove it, undefined to leave it.
export interface NoteDraft {
  id: string | null
  title: string
  body: string
  colour: string
  moduleId: string
  target: LinkChoice | null
  image: File | null | undefined
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
  save: [draft: NoteDraft]
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

// The editor's fields share one look: a label above, an input tall enough to tap.
const fieldUi = { label: 'text-xs font-medium text-ink-700' }
const inputClass = 'min-h-11 rounded-sm text-sm text-ink-900'

// A note opens read-only; Edit or New note switch the same slot to the editor.
const editing = ref(false)
const drafting = ref(false)
const title = ref('')
const body = ref('')
const colour = ref<NoteColour>('brand')
const moduleId = ref('')
// A new note's first link, written as `module:<id>` or `note:<id>`.
const firstLink = ref('')
const linkTargetId = ref('')
const image = ref<File | null | undefined>(undefined)
const imagePreview = ref('')
const imageInput = ref<HTMLInputElement | null>(null)

const selected = computed(() => props.notes.find(note => note.id === props.selectedId) ?? null)
const reading = computed(() => !editing.value && selected.value !== null)
const canSave = computed(() => title.value.trim().length > 0
  && (!drafting.value || firstLink.value.length > 0)
  && !props.saving)
const otherNotes = computed(() => props.notes.filter(note => note.id !== props.selectedId))
const noteToNoteLinks = computed(() => {
  const note = selected.value
  if (!note) return []
  return props.links.filter(link => link.fromNoteId === note.id && link.target.kind === 'note')
})
// The link pickers' choices, as Nuxt UI's select lists them: a new note's first link groups modules
// and notes; a saved note's module and note-to-note pickers list one kind each.
const firstLinkItems = computed(() => [
  [{ type: 'label' as const, label: 'Modules' }, ...props.modules.map(module => ({ label: module.name, value: `module:${module.id}` }))],
  ...(props.notes.length > 0
    ? [[{ type: 'label' as const, label: 'Notes' }, ...props.notes.map(note => ({ label: preview(note.text), value: `note:${note.id}` }))]]
    : []),
])
const moduleItems = computed(() => props.modules.map(module => ({ label: module.name, value: module.id })))
const otherNoteItems = computed(() => otherNotes.value.map(note => ({ label: preview(note.text), value: note.id })))
const readParts = computed(() => splitNote(selected.value?.text ?? ''))
const shownImage = computed(() => {
  if (image.value === null) return ''
  if (image.value) return imagePreview.value
  return drafting.value ? '' : selected.value?.imageUrl ?? ''
})

watch(() => props.selectedId, (id) => {
  if (!id) return
  drafting.value = false
  editing.value = false
})

// A finished save shows the note it wrote, read-only.
watch(() => props.saved, (message) => {
  if (!message) return
  drafting.value = false
  editing.value = false
  setImage(undefined)
})

onBeforeUnmount(() => setImage(undefined))

function setImage(next: File | null | undefined) {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = next ? URL.createObjectURL(next) : ''
  image.value = next
}

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
  editing.value = true
  title.value = ''
  body.value = ''
  colour.value = 'brand'
  moduleId.value = ''
  firstLink.value = preselected
  linkTargetId.value = ''
  setImage(undefined)
  emit('select', '')
}

function startEdit() {
  const note = selected.value
  if (!note) return
  const parts = splitNote(note.text)
  title.value = parts.title
  body.value = parts.body
  colour.value = isSwatch(note.colour) ? note.colour : 'brand'
  moduleId.value = linkedModule(note.id)
  linkTargetId.value = ''
  setImage(undefined)
  editing.value = true
}

function cancelEdit() {
  setImage(undefined)
  editing.value = false
  drafting.value = false
}

function pickImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) setImage(file)
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
  // Clicking the open note again still leaves the editor for its read view.
  if (id === props.selectedId) cancelEdit()
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
    image: image.value,
  })
}
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-y-auto bg-paper" aria-label="Notes List">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-medium text-ink-900">Notes List</h2>
      <UButton
        type="button"
        class="min-h-11 rounded-sm bg-accent px-3 text-sm text-on-accent hover:bg-accent-hover disabled:bg-accent disabled:opacity-60"
        :disabled="saving"
        @click="startDraft"
      >
        New note
      </UButton>
    </div>
    <p v-if="notes.length === 0 && !editing" class="mt-2 text-xs leading-5 text-ink-500">
      A note needs a title and a link to a module or another note. It appears on the map when you save.
    </p>
    <ul v-if="notes.length > 0" class="mt-2 flex max-h-36 shrink-0 flex-col gap-1 overflow-y-auto" aria-label="Your notes">
      <li v-for="note in notes" :key="note.id">
        <button
          type="button"
          class="flex min-h-11 w-full items-center border-l-4 px-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900"
          :class="[edgeOf(note.colour), note.id === selectedId && !drafting ? 'bg-brand-50 text-ink-900' : 'text-ink-700 hover:bg-ink-50']"
          :aria-current="note.id === selectedId && !drafting ? 'true' : undefined"
          @click="openNote(note.id)"
        >
          <span class="truncate">{{ preview(note.text) }}</span>
        </button>
      </li>
    </ul>

    <!-- The read view and the editor share this one slot, so switching never moves the layout. -->
    <article
      v-if="reading && selected"
      class="mt-3 flex min-h-0 flex-1 flex-col gap-3 border-t border-ink-200 pt-3"
      aria-label="Note"
      data-note-read
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="min-w-0 flex-1 text-base font-semibold break-words text-ink-900">{{ readParts.title || 'Untitled' }}</h3>
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="min-h-11 shrink-0 rounded-sm px-3 text-sm"
          @click="startEdit"
        >
          Edit
        </UButton>
      </div>
      <img
        v-if="selected.imageUrl"
        :src="selected.imageUrl"
        alt="Image added to this note"
        class="max-h-56 w-full rounded-sm border border-ink-200 object-contain"
      >
      <ChatMarkdown v-if="readParts.body.trim()" :text="readParts.body" class="text-sm leading-6 text-ink-800" />
      <p v-else class="text-sm text-ink-500">This note has only a title.</p>
    </article>

    <form v-else-if="editing" class="mt-3 flex min-h-0 flex-1 flex-col gap-3 border-t border-ink-200 pt-3" aria-label="Note editor" @submit.prevent="save">
      <UFormField label="Title" required :ui="fieldUi">
        <UInput v-model="title" type="text" required color="neutral" class="w-full" :ui="{ base: inputClass }" />
      </UFormField>
      <UFormField label="Note" :ui="fieldUi">
        <UTextarea v-model="body" :rows="4" color="neutral" class="w-full" :ui="{ base: 'text-sm text-ink-900' }" />
      </UFormField>
      <div>
        <p id="note-image-label" class="text-xs font-medium text-ink-700">Image</p>
        <img
          v-if="shownImage"
          :src="shownImage"
          alt="Image for this note"
          class="mt-1 max-h-40 w-full rounded-sm border border-ink-200 object-contain"
        >
        <div class="mt-1 flex flex-wrap gap-2" role="group" aria-labelledby="note-image-label">
          <input
            ref="imageInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            tabindex="-1"
            aria-label="Image file"
            @change="pickImage"
          >
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="min-h-11 rounded-sm px-3 text-sm"
            @click="imageInput?.click()"
          >
            {{ shownImage ? 'Replace image' : 'Add image' }}
          </UButton>
          <UButton
            v-if="shownImage"
            type="button"
            color="neutral"
            variant="outline"
            class="min-h-11 rounded-sm px-3 text-sm"
            @click="setImage(drafting ? undefined : null)"
          >
            Remove image
          </UButton>
        </div>
      </div>
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
      <UFormField label="Module" :ui="fieldUi">
        <USelect
          v-if="drafting"
          v-model="firstLink"
          :items="firstLinkItems"
          placeholder="Choose a module or note"
          color="neutral"
          class="w-full"
          :ui="{ base: inputClass }"
        />
        <USelect
          v-else
          v-model="moduleId"
          :items="moduleItems"
          placeholder="Choose a module"
          color="neutral"
          class="w-full"
          :ui="{ base: inputClass }"
        />
      </UFormField>
      <p class="text-xs leading-5 text-ink-500">A note always keeps at least one link, to a module or another note. Save puts it on the map.</p>
      <div v-if="selected && !drafting" class="border-t border-ink-200 pt-3">
        <p class="text-xs font-medium text-ink-700">Links to other notes</p>
        <ul v-if="noteToNoteLinks.length > 0" class="mt-1 flex flex-col gap-1" aria-label="Linked notes">
          <li v-for="link in noteToNoteLinks" :key="link.id" class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-xs text-ink-700">{{ linkTitle(link) }}</span>
            <UButton
              type="button"
              color="error"
              variant="outline"
              class="min-h-11 rounded-sm px-2 text-xs"
              @click="emit('unlink', link.id)"
            >
              Remove link
            </UButton>
          </li>
        </ul>
        <p v-else class="mt-1 text-xs text-ink-500">No links to other notes yet.</p>
        <div class="mt-1 flex items-center gap-2">
          <USelect
            v-model="linkTargetId"
            :items="otherNoteItems"
            placeholder="Choose a note"
            aria-label="Link to another note"
            color="neutral"
            class="min-w-0 flex-1"
            :ui="{ base: inputClass }"
          />
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="min-h-11 rounded-sm px-3 text-sm"
            :disabled="!linkTargetId || saving"
            @click="linkNote"
          >
            Link
          </UButton>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          type="submit"
          class="min-h-11 rounded-sm bg-accent px-3 text-sm text-on-accent hover:bg-accent-hover disabled:bg-accent disabled:opacity-60"
          :disabled="!canSave"
        >
          Save
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="min-h-11 rounded-sm px-3 text-sm"
          @click="cancelEdit"
        >
          Cancel
        </UButton>
        <UButton
          v-if="selected && !drafting"
          type="button"
          color="error"
          variant="outline"
          class="min-h-11 rounded-sm px-3 text-sm"
          @click="emit('remove', selected.id)"
        >
          Delete note
        </UButton>
      </div>
    </form>
    <p v-if="saved" class="mt-2 text-sm text-emerald-700" role="status" data-note-saved>{{ saved }}</p>
    <p v-if="error" class="mt-2 text-sm text-rose-700" role="alert">{{ error }}</p>
  </section>
</template>
