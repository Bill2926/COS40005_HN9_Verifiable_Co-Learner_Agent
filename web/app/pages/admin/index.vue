<script setup lang="ts">
import AdminHeader from '~/components/admin/AdminHeader.vue'
import VerdictDrawer from '~/components/admin/VerdictDrawer.vue'
import { agentText, type AdminPayload, type DecisionView } from '~/admin/decisions'

definePageMeta({
  middleware: 'signed-in',
})

const verdict = ref<'' | 'allow' | 'block' | 'downgrade'>('')
const studentId = ref('')
const appliedVerdict = ref<'' | 'allow' | 'block' | 'downgrade'>('')
const appliedStudentId = ref('')
const filtering = ref(false)
const openDecision = ref<DecisionView | null>(null)
let opener: HTMLElement | null = null

function decisionRequest() {
  return {
    event: 'read' as const,
    ...(appliedVerdict.value ? { verdict: appliedVerdict.value } : {}),
    ...(appliedStudentId.value ? { studentId: appliedStudentId.value } : {}),
  }
}

const requestFetch = useRequestFetch()
const { data, error, status, refresh } = await useAsyncData(
  'product-owner',
  () => requestFetch<AdminPayload>('/api/admin', { method: 'POST', body: decisionRequest() }),
  { watch: [appliedVerdict, appliedStudentId] },
)

const pageSize = 10
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil((data.value?.decisions.length ?? 0) / pageSize)))
const pageDecisions = computed(() => (data.value?.decisions ?? []).slice((page.value - 1) * pageSize, page.value * pageSize))
// 1 2 3 … 10: the first and last page, and the current page with its neighbours; null is a gap.
const pageItems = computed(() => {
  const last = pageCount.value
  const wanted = new Set([1, last, page.value - 1, page.value, page.value + 1])
  const numbers = [...wanted].filter(n => n >= 1 && n <= last).sort((x, y) => x - y)
  const items: (number | null)[] = []
  for (const n of numbers) {
    const before = items.at(-1)
    if (typeof before === 'number' && n - before === 2) items.push(before + 1)
    else if (typeof before === 'number' && n - before > 2) items.push(null)
    items.push(n)
  }
  return items
})
watch([appliedVerdict, appliedStudentId], () => { page.value = 1 })
watch(pageCount, (count) => { if (page.value > count) page.value = count })

const refused = computed(() => error.value?.statusCode === 403)
const unavailable = computed(() => Boolean(error.value) && !refused.value)
watch(status, (value) => { if (value !== 'pending') filtering.value = false })
const inputClass = 'min-h-11 rounded-sm px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5'

useHead({ title: 'Decisions' })

// Filter always fetches and shows the spinner, even when the filters are
// unchanged, so pressing it is never silent.
async function applyFilters() {
  const nextStudentId = studentId.value.trim()
  filtering.value = true
  if (verdict.value === appliedVerdict.value && nextStudentId === appliedStudentId.value) {
    await refresh()
    filtering.value = false
    return
  }
  appliedVerdict.value = verdict.value
  appliedStudentId.value = nextStudentId
}

function openVerdict(decision: DecisionView, event: MouseEvent) {
  opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  openDecision.value = decision
}

function closeVerdict() {
  if (!openDecision.value) return
  openDecision.value = null
  // Focus goes back to the verdict the drawer was opened from.
  nextTick(() => opener?.focus())
}

function proposedText(decision: DecisionView): string {
  if (!decision.proposedScope) return decision.proposedMove
  return `${decision.proposedMove} · ${decision.proposedScope}`
}

function verdictText(decision: DecisionView): string {
  if (decision.verdict !== 'downgrade' || !decision.ruledMove) return decision.verdict
  const scope = decision.ruledScope ? ` · ${decision.ruledScope}` : ''
  return `downgrade → ${decision.ruledMove}${scope}`
}

function timeText(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <AdminHeader />
    <main class="phone-safe-bottom mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-6 p-4 md:p-8">
      <p
        v-if="refused"
        role="alert"
        class="max-w-sm text-sm text-default"
      >
        This page is for the product owner.
      </p>
      <p
        v-else-if="unavailable"
        role="alert"
        class="max-w-sm text-sm text-default"
      >
        This page is unavailable right now.
      </p>
      <template v-else-if="data">
        <section class="page-enter flex min-w-0 flex-col gap-4">
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">
            Decisions
          </h1>
          <form
            class="flex flex-col gap-3 md:flex-row md:items-end"
            @submit.prevent="applyFilters"
          >
            <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
              <span>Verdict</span>
              <select
                v-model="verdict"
                name="verdict"
                class="min-h-11 rounded-sm border border-default bg-default px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5"
              >
                <option value="">
                  All
                </option>
                <option value="allow">
                  Allow
                </option>
                <option value="block">
                  Block
                </option>
                <option value="downgrade">
                  Downgrade
                </option>
              </select>
            </label>
            <label class="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium leading-4 text-default">
              <span>Student</span>
              <UInput
                v-model="studentId"
                type="text"
                name="studentId"
                autocomplete="off"
                color="neutral"
                fixed
                class="w-full"
                :ui="{ base: inputClass }"
              />
            </label>
            <UButton
              type="submit"
              size="lg"
              :loading="filtering"
              :disabled="filtering"
              :aria-busy="filtering"
              class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover disabled:bg-accent md:min-h-0"
            >
              Filter
            </UButton>
          </form>
          <div class="overflow-x-auto rounded-lg border border-default bg-default shadow-xs">
            <table class="w-full min-w-[56rem] border-collapse text-left text-xs leading-4 text-default">
              <caption class="px-4 py-3 text-left text-sm font-medium text-highlighted">
                Newest 100 decisions
              </caption>
              <thead class="border-y border-default bg-muted text-muted">
                <tr>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Time
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Student
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Turn
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Agent
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Proposed move
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Verdict
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Rule
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Reason
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Masteries
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Unlocked modules
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    VerifyShield
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="data.decisions.length === 0">
                  <td
                    colspan="11"
                    class="px-3 py-6 text-muted"
                  >
                    No decisions.
                  </td>
                </tr>
                <tr
                  v-for="decision in pageDecisions"
                  :key="`${decision.turnId}-${decision.agent}`"
                  class="border-t border-default align-top hover:bg-elevated/60"
                >
                  <td class="px-3 py-2 whitespace-nowrap">
                    <time :datetime="decision.time">{{ timeText(decision.time) }}</time>
                  </td>
                  <td class="px-3 py-2 font-mono">
                    <span
                      class="block max-w-[9ch] truncate"
                      :title="decision.studentId"
                    >{{ decision.studentId }}</span>
                  </td>
                  <td class="px-3 py-2 font-mono">
                    <span
                      class="block max-w-[9ch] truncate"
                      :title="decision.turnId"
                    >{{ decision.turnId }}</span>
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {{ agentText(decision.agent) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ proposedText(decision) }}
                  </td>
                  <td class="px-3 py-2">
                    <button
                      type="button"
                      class="rounded-sm text-left text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-current"
                      aria-haspopup="dialog"
                      @click="openVerdict(decision, $event)"
                    >
                      {{ verdictText(decision) }}
                    </button>
                  </td>
                  <td class="px-3 py-2 [overflow-wrap:anywhere]">
                    {{ decision.ruleId }}
                  </td>
                  <td class="px-3 py-2 [overflow-wrap:anywhere]">
                    {{ decision.reasonCode }}
                  </td>
                  <td class="px-3 py-2">
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
                  </td>
                  <td class="px-3 py-2">
                    {{ decision.unlockedModuleIds.join(', ') }}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {{ decision.verifyShieldOn ? 'On' : 'Off' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <nav
              v-if="data.decisions.length > pageSize"
              class="flex items-center justify-center gap-1 border-t border-default px-4 py-3 text-xs"
              aria-label="Decisions pages"
            >
              <button
                type="button"
                class="inline-flex size-11 items-center justify-center rounded-sm text-muted hover:bg-elevated disabled:opacity-40 md:size-8"
                aria-label="Previous page"
                :disabled="page <= 1"
                @click="page -= 1"
              >
                &lsaquo;
              </button>
              <template v-for="(item, index) in pageItems" :key="index">
                <span v-if="item === null" class="px-1 text-muted" aria-hidden="true">&hellip;</span>
                <button
                  v-else
                  type="button"
                  class="inline-flex size-11 items-center justify-center rounded-sm tabular-nums md:size-8"
                  :class="item === page ? 'bg-accent font-medium text-on-accent' : 'text-default hover:bg-elevated'"
                  :aria-current="item === page ? 'page' : undefined"
                  :aria-label="`Page ${item}`"
                  @click="page = item"
                >
                  {{ item }}
                </button>
              </template>
              <button
                type="button"
                class="inline-flex size-11 items-center justify-center rounded-sm text-muted hover:bg-elevated disabled:opacity-40 md:size-8"
                aria-label="Next page"
                :disabled="page >= pageCount"
                @click="page += 1"
              >
                &rsaquo;
              </button>
            </nav>
          </div>
        </section>
        <VerdictDrawer
          :decision="openDecision"
          @close="closeVerdict"
        />
      </template>
    </main>
  </div>
</template>
