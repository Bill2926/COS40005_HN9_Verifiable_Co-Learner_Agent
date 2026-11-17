<script setup lang="ts">
import type { QuizQuestionView } from '#shared/turn'
import BusySpinner from '../BusySpinner.vue'
import InlineText from './InlineText.vue'

const props = defineProps<{
  questions: readonly QuizQuestionView[]
  // The question whose answer is being marked, if any. While one is marked, no
  // other choice can be picked: the answer replaces the whole workspace.
  answeringId?: string
  // The choice being marked, shown with a spinner.
  answeringChoice?: number
}>()

const emit = defineEmits<{
  answer: [answer: { questionId: string, choice: number }]
}>()

const letters = ['A', 'B', 'C', 'D']

// A question locks once answered: only the first answer counts, so its choices
// stay disabled while the answer, the correct choice and the explanation show.
function locked(question: QuizQuestionView): boolean {
  return question.result !== null || Boolean(props.answeringId)
}

function pick(question: QuizQuestionView, choice: number) {
  if (locked(question)) return
  emit('answer', { questionId: question.id, choice })
}

function marking(question: QuizQuestionView, choice: number): boolean {
  return props.answeringId === question.id && props.answeringChoice === choice
}

function choiceState(question: QuizQuestionView, choice: number): 'idle' | 'correct' | 'wrong' {
  const result = question.result
  if (!result) return 'idle'
  if (choice === result.correctIndex) return 'correct'
  if (choice === result.choice) return 'wrong'
  return 'idle'
}

function choiceClass(state: 'idle' | 'correct' | 'wrong', answered: boolean, waiting: boolean): string {
  if (state === 'correct') return 'cursor-not-allowed border-emerald-300 bg-emerald-50 text-emerald-900'
  if (state === 'wrong') return 'cursor-not-allowed border-rose-300 bg-rose-50 text-rose-900'
  if (answered) return 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-500'
  if (waiting) return 'cursor-wait border-ink-200 bg-paper text-ink-700'
  return 'border-ink-200 bg-paper text-ink-700 hover:border-brand-300 hover:bg-brand-50'
}
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-[8px] border border-ink-200 bg-ink-50/70 px-4 py-4 md:px-5"
    aria-label="Module quiz"
  >
    <div class="flex flex-col gap-1">
      <h3 class="text-sm leading-5 font-semibold text-ink-900">
        Test your knowledge
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
            :class="choiceClass(choiceState(question, choiceIndex), question.result !== null, Boolean(answeringId))"
            :aria-pressed="question.result?.choice === choiceIndex"
            :aria-busy="marking(question, choiceIndex) ? true : undefined"
            :disabled="locked(question)"
            @click="pick(question, choiceIndex)"
          >
            <span class="font-mono text-[11px] leading-5 text-ink-400">{{ letters[choiceIndex] }}</span>
            <span class="min-w-0 flex-1"><InlineText :text="choice" /></span>
            <span
              v-if="marking(question, choiceIndex)"
              class="mt-1 text-brand-600"
            ><BusySpinner /></span>
          </button>
        </div>
        <div
          v-if="question.result"
          class="flex flex-col gap-1 rounded-[6px] border border-ink-200 bg-paper px-3 py-2"
        >
          <p
            class="text-xs leading-5 font-semibold"
            :class="question.result.correct ? 'text-emerald-700' : 'text-rose-700'"
          >
            {{ question.result.correct ? 'Correct' : 'Not quite' }}
          </p>
          <p class="text-xs leading-5 text-ink-600">
            <InlineText :text="question.result.explanation" />
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
