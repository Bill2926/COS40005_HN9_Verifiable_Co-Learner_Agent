<script setup lang="ts">
import { drawerChecks, type DecisionView } from '~/admin/decisions'

// How the VerifyShield reached one verdict. It reads only the decision already
// loaded in the table, so opening it makes no request. A native modal dialog
// keeps focus inside and closes on Escape; the caller puts focus back on the
// verdict it was opened from.
const props = defineProps<{
  decision: DecisionView | null
}>()

const emit = defineEmits<{
  close: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const view = computed(() => props.decision ? drawerChecks(props.decision) : null)

watch(() => props.decision, async (decision) => {
  await nextTick()
  const element = dialog.value
  if (!element) return
  if (decision && !element.open) {
    element.showModal()
    closeButton.value?.focus()
  }
  else if (!decision && element.open) {
    element.close()
  }
})

// A click on the backdrop lands on the dialog element itself, outside the panel.
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}

function moveText(move: string | null, scope: string | null): string {
  if (!move) return 'nothing (blocked)'
  return scope ? `${move} · ${scope}` : move
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="verdict-drawer-title"
    class="verdict-drawer m-0 ml-auto h-dvh max-h-dvh w-full max-w-full bg-default p-0 text-default shadow-xl md:w-[28rem]"
    @close="emit('close')"
    @cancel.prevent="emit('close')"
    @click="onClick"
  >
    <div
      v-if="decision && view"
      class="phone-safe-top phone-safe-bottom flex h-full flex-col overflow-y-auto"
    >
      <div class="flex items-start justify-between gap-4 border-b border-default px-4 py-4 md:px-6">
        <div class="flex flex-col gap-1">
          <h2
            id="verdict-drawer-title"
            class="text-lg font-semibold tracking-tight text-highlighted"
          >
            Verdict: {{ decision.verdict }}
          </h2>
          <p class="text-xs leading-4 text-muted">
            {{ decision.agent === 'teacher' ? 'Teacher' : 'Deskmate' }} ·
            <time :datetime="decision.time">{{ new Date(decision.time).toLocaleString() }}</time>
          </p>
        </div>
        <button
          ref="closeButton"
          type="button"
          class="inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-elevated hover:text-highlighted md:size-9"
          aria-label="Close"
          @click="emit('close')"
        >
          <span
            aria-hidden="true"
            class="text-xl leading-none"
          >&times;</span>
        </button>
      </div>

      <section class="flex flex-col gap-3 px-4 py-4 md:px-6">
        <h3 class="text-sm font-semibold text-highlighted">
          Rule checks
        </h3>
        <p
          v-if="view.note"
          class="text-xs leading-4 text-muted"
        >
          {{ view.note }}
        </p>
        <ol
          v-if="view.checks.length > 0"
          class="flex flex-col gap-2"
        >
          <li
            v-for="(check, index) in view.checks"
            :key="index"
            class="flex gap-3 rounded-sm border px-3 py-2 text-xs leading-5"
            :class="check.deciding ? 'border-brand-500 bg-brand-50' : 'border-default'"
            :data-deciding="check.deciding ? 'true' : undefined"
          >
            <span
              class="mt-px font-semibold"
              :class="check.passed ? 'text-emerald-700' : 'text-rose-700'"
              :aria-label="check.passed ? 'Passed' : 'Failed'"
            >{{ check.passed ? '✓' : '✗' }}</span>
            <span class="flex min-w-0 flex-col">
              <span class="font-mono text-[11px] text-muted [overflow-wrap:anywhere]">{{ check.ruleId }}</span>
              <span class="text-default">{{ check.reason }}</span>
              <span
                v-if="check.deciding"
                class="font-medium text-brand-700"
              >Deciding check</span>
            </span>
          </li>
        </ol>
      </section>

      <section class="flex flex-col gap-2 border-t border-default px-4 py-4 text-xs leading-5 md:px-6">
        <h3 class="text-sm font-semibold text-highlighted">
          Move
        </h3>
        <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt class="text-muted">
            Proposed
          </dt>
          <dd class="[overflow-wrap:anywhere]">
            {{ moveText(decision.proposedMove, decision.proposedScope) }}
          </dd>
          <dt class="text-muted">
            Ruled
          </dt>
          <dd class="[overflow-wrap:anywhere]">
            {{ moveText(decision.ruledMove, decision.ruledScope) }}
          </dd>
          <!-- The addressed agent of the turn goes here (ticket #173). -->
        </dl>
      </section>

      <section class="flex flex-col gap-2 border-t border-default px-4 py-4 text-xs leading-5 md:px-6">
        <h3 class="text-sm font-semibold text-highlighted">
          What the VerifyShield knew
        </h3>
        <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt class="text-muted">
            VerifyShield
          </dt>
          <dd>{{ decision.verifyShieldOn ? 'On' : 'Off' }}</dd>
          <dt class="text-muted">
            Threshold
          </dt>
          <dd class="font-mono tabular-nums">
            {{ decision.masteryThreshold.toFixed(2) }}
          </dd>
          <dt class="text-muted">
            Unlocked
          </dt>
          <dd class="[overflow-wrap:anywhere]">
            {{ decision.unlockedModuleIds.join(', ') || 'none' }}
          </dd>
          <dt class="text-muted">
            Masteries
          </dt>
          <dd>
            <ul class="flex flex-col gap-0.5">
              <li
                v-for="item in decision.masteries"
                :key="item.moduleId"
                class="flex justify-between gap-3"
              >
                <span class="min-w-0 [overflow-wrap:anywhere]">{{ item.moduleId }}</span>
                <span class="font-mono text-muted tabular-nums">{{ item.mastery.toFixed(2) }}</span>
              </li>
            </ul>
          </dd>
        </dl>
      </section>
    </div>
  </dialog>
</template>

<style scoped>
.verdict-drawer::backdrop {
  background: rgb(31 42 68 / 0.4);
}
</style>
