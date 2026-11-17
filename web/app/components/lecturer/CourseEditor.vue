<script setup lang="ts">
import type { CourseSpec } from '../../../server/course'
import type { MaterialBlock } from '#shared/turn'
import MermaidDiagram from '../workspace/MermaidDiagram.vue'

type Editable<T> = T extends readonly (infer Item)[]
  ? Editable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Editable<T[Key]> }
    : T

const props = defineProps<{ courseId: string }>()

const spec = ref<Editable<CourseSpec> | null>(null)
const moduleId = ref('')
const message = ref('')
const errorMessage = ref('')
const busy = ref(false)
const hasDraft = ref(false)

const selected = computed(() => spec.value?.modules.find(module => module.id === moduleId.value) ?? null)

onMounted(load)

async function load(): Promise<boolean> {
  errorMessage.value = ''
  try {
    const draft = await $fetch<CourseSpec | null>(`/api/lecturer/spec?courseId=${props.courseId}&draft=1`, { responseType: 'json' })
    hasDraft.value = draft !== null
    const published = draft ?? await $fetch<CourseSpec>(`/api/lecturer/spec?courseId=${props.courseId}`, { responseType: 'json' })
    spec.value = structuredClone(published) as Editable<CourseSpec>
    if (!spec.value.modules.some(module => module.id === moduleId.value)) moduleId.value = spec.value.modules[0]?.id ?? ''
    return true
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? `The course could not be loaded: ${error.message}` : 'The course could not be loaded.'
    return false
  }
}

async function save(event: 'save' | 'publish' | 'discard') {
  if (!spec.value && event === 'save') return
  busy.value = true
  errorMessage.value = ''
  message.value = ''
  try {
    // Publishing sends what is on screen: save it first, so unsaved edits are never lost.
    if (event !== 'discard') {
      await $fetch('/api/lecturer/spec', { method: 'POST', body: { event: 'save', spec: spec.value } })
      hasDraft.value = true
    }
    if (event !== 'discard') message.value = 'Draft saved.'
    if (event !== 'save') await $fetch('/api/lecturer/spec', { method: 'POST', body: { event } })
    // The message states what the server did; a failed reload adds its own error beside it.
    message.value = event === 'publish' ? 'Published. Students now see this version.' : event === 'discard' ? 'Draft discarded.' : 'Draft saved.'
    if (event !== 'save') await load()
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The draft could not be saved.'
    if (typeof error === 'object' && error && 'statusMessage' in error && typeof error.statusMessage === 'string') {
      errorMessage.value = error.statusMessage
    }
  }
  finally {
    busy.value = false
  }
}

async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/lecturer/spec', { method: 'POST', body: await file.text() })
    message.value = 'Imported into the draft.'
    await load()
  }
  catch (error) {
    errorMessage.value = typeof error === 'object' && error && 'statusMessage' in error && typeof error.statusMessage === 'string'
      ? error.statusMessage
      : 'That file is not a course spec.'
  }
  finally {
    busy.value = false
  }
}

function movePart(index: number, delta: number) {
  const parts = spec.value?.parts
  if (!parts) return
  const next = index + delta
  if (next < 0 || next >= parts.length) return
  const copy = [...parts]
  const [part] = copy.splice(index, 1)
  copy.splice(next, 0, part!)
  spec.value!.parts = copy
}

function moveModule(index: number, delta: number) {
  const modules = spec.value?.modules
  if (!modules) return
  const next = index + delta
  if (next < 0 || next >= modules.length) return
  const copy = [...modules]
  const [module] = copy.splice(index, 1)
  copy.splice(next, 0, module!)
  spec.value!.modules = copy
}

function addPart() {
  spec.value?.parts.push('New part')
}

function addModule() {
  const part = spec.value?.parts[0] ?? 'New part'
  const id = `module_${crypto.randomUUID().slice(0, 8)}`
  spec.value?.modules.push({ id, name: 'New module', part, summary: '', keywords: [] })
  moduleId.value = id
}

function addBlock(type: MaterialBlock['type']) {
  const content = selected.value?.content
  if (!content) return
  const block: MaterialBlock = type === 'text'
    ? { type, markdown: 'New text' }
    : type === 'code'
      ? { type, code: 'print(1)' }
      : type === 'diagram'
        ? { type, mermaid: 'flowchart LR\n  a[Start] --> b[Next]' }
        : type === 'image'
          ? { type, url: 'https://example.com/image.png', alt: 'Description of the image' }
          : { type, url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8', title: 'Video' }
  content.materials.push(block)
}

function moveBlock(index: number, delta: number) {
  const materials = selected.value?.content?.materials
  if (!materials) return
  const next = index + delta
  if (next < 0 || next >= materials.length) return
  const copy = [...materials]
  const [block] = copy.splice(index, 1)
  copy.splice(next, 0, block!)
  selected.value!.content!.materials = copy
}
</script>

<template>
  <p v-if="!spec && errorMessage" role="alert" class="text-sm text-rose-700">{{ errorMessage }}</p>
  <section v-if="spec" class="flex flex-col gap-6 rounded-lg border border-default bg-default p-4 md:p-8" aria-label="Course editor">
    <div class="flex flex-wrap gap-2">
      <button type="button" class="min-h-11 rounded-sm bg-accent px-3 text-sm text-on-accent" :disabled="busy" @click="save('save')">Save draft</button>
      <button type="button" class="min-h-11 rounded-sm border border-default px-3 text-sm" :disabled="busy" @click="save('publish')">Publish</button>
      <button type="button" class="min-h-11 rounded-sm border border-default px-3 text-sm" :disabled="busy" @click="save('discard')">Discard draft</button>
      <a class="inline-flex min-h-11 items-center text-sm text-brand-700 underline" :href="`/api/lecturer/spec?courseId=${courseId}`">Export published</a>
      <a v-if="hasDraft" class="inline-flex min-h-11 items-center text-sm text-brand-700 underline" :href="`/api/lecturer/spec?courseId=${courseId}&draft=1&download=1`">Export draft</a>
      <label class="inline-flex min-h-11 cursor-pointer items-center text-sm text-brand-700 underline">
        Import JSON
        <input type="file" accept="application/json,.json" class="sr-only" @change="importFile">
      </label>
    </div>
    <p class="text-sm text-ink-500">{{ hasDraft ? 'Editing an unpublished draft. Students see the published course until you publish.' : 'No draft yet. Your edits become a draft when you save.' }}</p>
    <p v-if="message" role="status" class="text-sm text-emerald-700">{{ message }}</p>
    <p v-if="errorMessage" role="alert" class="text-sm text-rose-700">{{ errorMessage }}</p>

    <label class="flex flex-col gap-1 text-sm">
      Title
      <input v-model="spec.title" class="min-h-11 rounded-sm border border-ink-300 px-3">
    </label>

    <div>
      <h2 class="text-sm font-semibold">Parts</h2>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="(part, index) in spec.parts" :key="index" class="flex flex-wrap items-center gap-2">
          <input v-model="spec.parts[index]" class="min-h-11 min-w-0 flex-1 rounded-sm border border-ink-300 px-3" :aria-label="`Part ${index + 1}`">
          <button type="button" class="min-h-11 px-2 text-sm" @click="movePart(index, -1)">Up</button>
          <button type="button" class="min-h-11 px-2 text-sm" @click="movePart(index, 1)">Down</button>
          <button type="button" class="min-h-11 px-2 text-sm" @click="spec.parts.splice(index, 1)">Remove</button>
        </li>
      </ul>
      <button type="button" class="mt-2 min-h-11 text-sm text-brand-700" @click="addPart">Add part</button>
    </div>

    <div>
      <h2 class="text-sm font-semibold">Modules</h2>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="(module, index) in spec.modules" :key="module.id" class="flex flex-wrap items-center gap-2">
          <button type="button" class="min-h-11 flex-1 rounded-sm px-2 text-left text-sm" :class="module.id === moduleId ? 'bg-brand-50' : ''" @click="moduleId = module.id">{{ module.name }}</button>
          <button type="button" class="min-h-11 px-2 text-sm" @click="moveModule(index, -1)">Up</button>
          <button type="button" class="min-h-11 px-2 text-sm" @click="moveModule(index, 1)">Down</button>
          <button type="button" class="min-h-11 px-2 text-sm" @click="spec.modules.splice(index, 1)">Remove</button>
        </li>
      </ul>
      <button type="button" class="mt-2 min-h-11 text-sm text-brand-700" @click="addModule">Add module</button>
    </div>

    <div v-if="selected" class="flex flex-col gap-4 border-t border-default pt-4">
      <label class="flex flex-col gap-1 text-sm">Name<input v-model="selected.name" class="min-h-11 rounded-sm border border-ink-300 px-3"></label>
      <label class="flex flex-col gap-1 text-sm">Summary<input v-model="selected.summary" class="min-h-11 rounded-sm border border-ink-300 px-3"></label>
      <label class="flex flex-col gap-1 text-sm">
        Part
        <select v-model="selected.part" class="min-h-11 rounded-sm border border-ink-300 px-3">
          <option v-for="part in spec.parts" :key="part" :value="part">{{ part }}</option>
        </select>
      </label>
      <template v-if="selected.content">
        <div class="flex flex-wrap gap-2">
          <button v-for="type in ['text', 'code', 'diagram', 'image', 'video']" :key="type" type="button" class="min-h-11 rounded-sm border border-default px-3 text-sm" @click="addBlock(type as MaterialBlock['type'])">Add {{ type }}</button>
        </div>
        <article v-for="(block, index) in selected.content.materials" :key="index" class="flex flex-col gap-2 rounded-sm border border-ink-200 p-3">
          <div class="flex gap-2">
            <p class="text-sm font-medium">{{ block.type }}</p>
            <button type="button" class="min-h-11 px-2 text-sm" @click="moveBlock(index, -1)">Up</button>
            <button type="button" class="min-h-11 px-2 text-sm" @click="moveBlock(index, 1)">Down</button>
            <button type="button" class="min-h-11 px-2 text-sm" @click="selected.content!.materials.splice(index, 1)">Remove</button>
          </div>
          <textarea v-if="block.type === 'text'" v-model="block.markdown" rows="4" class="w-full rounded-sm border border-ink-300 p-2 text-sm" aria-label="Text" />
          <textarea v-else-if="block.type === 'code'" v-model="block.code" rows="4" class="w-full rounded-sm border border-ink-300 p-2 font-mono text-sm" aria-label="Code" />
          <template v-else-if="block.type === 'diagram'">
            <textarea v-model="block.mermaid" rows="4" class="w-full rounded-sm border border-ink-300 p-2 font-mono text-sm" aria-label="Diagram" />
            <MermaidDiagram :source="block.mermaid" />
          </template>
          <template v-else-if="block.type === 'image'">
            <input v-model="block.url" class="min-h-11 rounded-sm border border-ink-300 px-3 text-sm" aria-label="Image URL">
            <input v-model="block.alt" class="min-h-11 rounded-sm border border-ink-300 px-3 text-sm" aria-label="Image description">
          </template>
          <template v-else>
            <input v-model="block.url" class="min-h-11 rounded-sm border border-ink-300 px-3 text-sm" aria-label="Video URL">
            <input v-model="block.title" class="min-h-11 rounded-sm border border-ink-300 px-3 text-sm" aria-label="Video title">
          </template>
        </article>

        <div v-for="(rung, index) in selected.content.hintLadder" :key="index">
          <label class="flex flex-col gap-1 text-sm">
            Hint {{ index + 1 }}
            <textarea v-model="selected.content.hintLadder[index]" rows="2" class="w-full rounded-sm border border-ink-300 p-2" />
          </label>
        </div>
        <div v-for="question in selected.content.quiz" :key="question.id" class="flex flex-col gap-2">
          <label class="text-sm">Quiz question<input v-model="question.prompt" class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-3"></label>
          <fieldset class="flex flex-col gap-2">
            <legend class="text-sm">Choices (mark the correct one)</legend>
            <div v-for="(choice, choiceIndex) in question.choices" :key="choiceIndex" class="flex items-center gap-2">
              <input v-model="question.correctIndex" type="radio" :name="`correct-${question.id}`" :value="choiceIndex" class="size-5" :aria-label="`Choice ${choiceIndex + 1} is correct`">
              <input v-model="question.choices[choiceIndex]" class="min-h-11 min-w-0 flex-1 rounded-sm border border-ink-300 px-3 text-sm" :aria-label="`Choice ${choiceIndex + 1}`">
            </div>
          </fieldset>
          <label class="text-sm">Explanation<textarea v-model="question.explanation" rows="2" class="mt-1 w-full rounded-sm border border-ink-300 p-2" /></label>
        </div>
        <div v-for="exercise in selected.content.exercises" :key="exercise.id" class="flex flex-col gap-2">
          <label class="text-sm">Exercise<input v-model="exercise.title" class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-3"></label>
          <textarea v-model="exercise.statement" rows="3" class="w-full rounded-sm border border-ink-300 p-2 text-sm" :aria-label="`Statement for ${exercise.title}`" />
          <textarea v-model="exercise.starterCode" rows="3" class="w-full rounded-sm border border-ink-300 p-2 font-mono text-sm" :aria-label="`Starter code for ${exercise.title}`" />
          <textarea v-model="exercise.referenceSolution" rows="3" class="w-full rounded-sm border border-ink-300 p-2 font-mono text-sm" :aria-label="`Reference solution for ${exercise.title}`" />
        </div>
        <div v-for="response in selected.content.misconceptionResponses" :key="response.id">
          <label class="text-sm">Misconception {{ response.id }}
            <textarea v-model="response.response" rows="2" class="mt-1 w-full rounded-sm border border-ink-300 p-2" />
          </label>
        </div>
      </template>
      <p v-else class="text-sm text-ink-500">This module has no study content, so it stays closed as not available.</p>
    </div>
  </section>
</template>
