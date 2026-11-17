<script setup lang="ts">
import type { CoursePreview } from '#shared/lecturer'
import type { CurrentExercise } from '#shared/turn'
import MaterialBlocks from '../workspace/MaterialBlocks.vue'
import PracticePanel from '../workspace/PracticePanel.vue'

const props = defineProps<{ courseId: string }>()
const preview = ref<CoursePreview | null>(null)
const moduleId = ref('')
const exerciseId = ref('')

const module = computed(() => preview.value?.modules.find(item => item.id === moduleId.value) ?? null)
const exercise = computed((): CurrentExercise | null => {
  const chosen = module.value?.exercises.find(item => item.id === exerciseId.value) ?? module.value?.exercises[0]
  if (!chosen) return null
  return chosen
})

onMounted(async () => {
  preview.value = await $fetch<CoursePreview>(`/api/lecturer/spec?courseId=${props.courseId}&preview=1`)
  moduleId.value = preview.value.modules.find(item => item.available)?.id ?? preview.value.modules[0]?.id ?? ''
  exerciseId.value = preview.value.modules[0]?.exercises[0]?.id ?? ''
})
</script>

<template>
  <section v-if="preview && module" class="flex flex-col gap-6 rounded-lg border border-default bg-default p-4 md:p-8" aria-label="Course preview">
    <p class="text-sm text-ink-600">{{ preview.draft ? 'Unpublished draft.' : 'Published course.' }} Nothing here is saved, and no agent takes part.</p>
    <label class="text-sm">Module
      <select v-model="moduleId" class="mt-1 min-h-11 w-full rounded-sm border border-ink-300 px-3">
        <option v-for="item in preview.modules" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
    </label>
    <MaterialBlocks :blocks="module.materials" />
    <div v-if="module.quiz.length" class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold">Quiz <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Teacher only</span></h2>
      <article v-for="question in module.quiz" :key="question.id">
        <p class="text-sm">{{ question.prompt }}</p>
        <p v-for="(choice, index) in question.choices" :key="index" class="text-sm" :class="index === question.correctIndex ? 'font-semibold text-emerald-700' : 'text-ink-600'">
          {{ choice }}<span v-if="index === question.correctIndex"> — correct, teacher only</span>
        </p>
      </article>
    </div>
    <div v-if="module.hintLadder">
      <h2 class="text-sm font-semibold">Hint ladder <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Teacher only</span></h2>
      <ol class="mt-2 list-decimal pl-5 text-sm">
        <li v-for="(rung, index) in module.hintLadder.rungs" :key="index">{{ rung }}</li>
      </ol>
    </div>
    <div v-if="module.misconceptionResponses.length">
      <h2 class="text-sm font-semibold">Misconception responses <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Teacher only</span></h2>
      <p v-for="response in module.misconceptionResponses" :key="response.id" class="text-sm">{{ response.response }}</p>
    </div>
    <PracticePanel
      v-if="exercise"
      :exercise="exercise"
      :exercises="module.exercises.map(item => ({ id: item.id, title: item.title }))"
      student-id="preview"
      :active="true"
      :selecting="false"
      select-error=""
      :submitting="false"
      @select-exercise="exerciseId = $event"
      @submit="() => {}"
    />
  </section>
</template>
