<script setup lang="ts">
import type { QuizQuestionView } from '#shared/turn'
import InlineText from './InlineText.vue'

const props = defineProps<{
  questions: readonly QuizQuestionView[]
}>()

const emit = defineEmits<{
  answer: [answer: { questionId: string, choice: number }]
}>()

const letters = ['A', 'B', 'C', 'D']

// Once a question is answered, the correct choice and explanation are known, so
// the student can try other choices and see right or wrong without another turn.
// This holds the choice each answered question is currently showing.
const explored = reactive<Record<string, number>>({})

function pick(question: QuizQuestionView, choice: number) {
  if (question.result) {
    explored[question.id] = choice
    return
  }
  emit('answer', { questionId: question.id, choice })
}

function shownChoice(question: QuizQuestionView): number | null {
  if (!question.result) return null
  return explored[question.id] ?? question.result.choice
}

function choiceState(question: QuizQuestionView, choice: number): 'idle' | 'correct' | 'wrong' {
  const result = question.result
  if (!result) return 'idle'
  if (choice === result.correctIndex) return 'correct'
  if (choice === shownChoice(question)) return 'wrong'
  return 'idle'
}

function choiceClass(state: 'idle' | 'correct' | 'wrong', answered: boolean): string {
  if (state === 'correct') return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  if (state === 'wrong') return 'border-rose-300 bg-rose-50 text-rose-900'
  if (answered) return 'border-ink-200 bg-paper text-ink-600'
  return 'border-ink-200 bg-paper text-ink-700 hover:border-brand-300 hover:bg-brand-50'
}

function verdictText(question: QuizQuestionView): string {
  const result = question.result
  if (!result) return ''
  const exploring = (explored[question.id] ?? result.choice) !== result.choice
  if (exploring) return explored[question.id] === result.correctIndex ? 'Correct choice' : 'Not correct'
  return result.correct ? 'Correct' : 'Not quite'
}
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-[8px] border border-ink-200 bg-ink-50/70 px-4 py-4 md:px-5"
    aria-label="Module quiz"
  >
    <div class="flex flex-col gap-1">
      <h3 class="text-sm leading-5 font-semibold text-ink-900">
        Quick check
      </h3>
      <p class="text-xs leading-5 text-ink-500">
        Three questions on this module. Only your first answer to each counts.
      </p>
    </div>

    <ol class="flex flex-col gap-5">
      <li
        v-for="(question, index) in props.questions"
        :key="question.id"
        class="flex flex-col gap-2.5"
      >
        <p class="text-[13px] leading-5 font-medium text-ink-800">
          <span class="text-ink-400">{{ index + 1 }}.</span>
          <InlineText :text="question.prompt" />
        </p>
        <div class="flex flex-col gap-1.5">
          <button
            v-for="(choice, choiceIndex) in question.choices"
            :key="choiceIndex"
            type="button"
            class="flex items-start gap-2 rounded-[6px] border px-3 py-2 text-left text-[13px] leading-5 transition-colors"
            :class="choiceClass(choiceState(question, choiceIndex), question.result !== null)"
            :aria-pressed="shownChoice(question) === choiceIndex"
            @click="pick(question, choiceIndex)"
          >
            <span class="font-mono text-[11px] leading-5 text-ink-400">{{ letters[choiceIndex] }}</span>
            <span class="min-w-0"><InlineText :text="choice" /></span>
          </button>
        </div>
        <div
          v-if="question.result"
          class="flex flex-col gap-1 rounded-[6px] border border-ink-200 bg-paper px-3 py-2"
        >
          <p
            class="text-xs leading-5 font-semibold"
            :class="verdictText(question) === 'Not quite' || verdictText(question) === 'Not correct' ? 'text-rose-700' : 'text-emerald-700'"
          >
            {{ verdictText(question) }}
          </p>
          <p class="text-xs leading-5 text-ink-600">
            <InlineText :text="question.result.explanation" />
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
