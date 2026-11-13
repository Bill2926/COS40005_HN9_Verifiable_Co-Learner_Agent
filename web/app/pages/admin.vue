<script setup lang="ts">
definePageMeta({
  middleware: 'signed-in',
})

interface ModelSettingsView {
  provider: 'real' | 'fake'
  apiKeyMask: string
  baseUrl: string
  modelName: string
  saved: boolean
}

interface DecisionView {
  time: string
  studentId: string
  turnId: string
  agent: 'teacher' | 'deskmate'
  proposedMove: string
  proposedScope: string | null
  verdict: 'allow' | 'block' | 'downgrade'
  ruledMove: string | null
  ruledScope: string | null
  ruleId: string
  reasonCode: string
  masteries: readonly { moduleId: string, mastery: number }[]
  unlockedModuleIds: readonly string[]
  verifyShieldOn: boolean
}

interface AdminPayload {
  model: ModelSettingsView
  verifyShieldOn: boolean
  decisions: DecisionView[]
}

const provider = ref<'real' | 'fake'>('real')
const apiKey = ref('')
const baseUrl = ref('')
const modelName = ref('')
const saving = ref(false)
const saveError = ref('')
const savedNotice = ref('')
const verdict = ref<'' | 'allow' | 'block' | 'downgrade'>('')
const studentId = ref('')
const appliedVerdict = ref<'' | 'allow' | 'block' | 'downgrade'>('')
const appliedStudentId = ref('')
const verifyShieldOn = ref(true)
const switching = ref(false)
const switchError = ref('')

function decisionRequest() {
  return {
    event: 'read' as const,
    ...(appliedVerdict.value ? { verdict: appliedVerdict.value } : {}),
    ...(appliedStudentId.value ? { studentId: appliedStudentId.value } : {}),
  }
}

const requestFetch = useRequestFetch()
const { data, error, refresh } = await useAsyncData(
  'product-owner',
  () => requestFetch<AdminPayload>('/api/admin', { method: 'POST', body: decisionRequest() }),
  { watch: [appliedVerdict, appliedStudentId] },
)

watch(data, (payload) => {
  if (!payload) return
  provider.value = payload.model.provider
  baseUrl.value = payload.model.baseUrl
  modelName.value = payload.model.modelName
  verifyShieldOn.value = payload.verifyShieldOn
}, { immediate: true })

const refused = computed(() => error.value?.statusCode === 403)
const unavailable = computed(() => Boolean(error.value) && !refused.value)
const inputClass = 'min-h-11 rounded-sm px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5'

useHead({ title: 'Decisions' })

function applyFilters() {
  appliedVerdict.value = verdict.value
  appliedStudentId.value = studentId.value.trim()
}

async function onVerifyShield(event: Event) {
  const enabled = event.target instanceof HTMLInputElement && event.target.checked
  verifyShieldOn.value = enabled
  switchError.value = ''
  switching.value = true
  try {
    await $fetch('/api/admin', { method: 'POST', body: { event: 'verifyShield', enabled } })
    await refresh()
  }
  catch (caught) {
    switchError.value = messageFrom(caught)
    await refresh()
  }
  finally {
    switching.value = false
  }
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

async function save() {
  saveError.value = ''
  savedNotice.value = ''
  saving.value = true
  try {
    await $fetch('/api/admin', {
      method: 'POST',
      body: {
        event: 'save',
        provider: provider.value,
        apiKey: apiKey.value,
        baseUrl: baseUrl.value,
        modelName: modelName.value,
      },
    })
    apiKey.value = ''
    await refresh()
    savedNotice.value = 'Saved. The next turn uses these settings.'
  }
  catch (caught) {
    saveError.value = messageFrom(caught)
  }
  finally {
    saving.value = false
  }
}

function messageFrom(caught: unknown): string {
  if (typeof caught === 'object' && caught !== null) {
    if ('statusMessage' in caught && typeof caught.statusMessage === 'string' && caught.statusMessage) {
      return caught.statusMessage
    }
    if ('data' in caught && typeof caught.data === 'object' && caught.data !== null && 'statusMessage' in caught.data && typeof caught.data.statusMessage === 'string') {
      return caught.data.statusMessage
    }
  }
  return 'The settings could not be saved.'
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <header class="phone-safe-top shrink-0 border-b border-default/80 bg-default px-4 py-4 md:px-8">
      <div class="mx-auto flex w-full max-w-[86rem] items-center justify-between">
      <p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-highlighted">
        <img
          src="/swinburne-fpt-logo.webp"
          alt=""
          width="871"
          height="705"
          class="block h-8 w-auto shrink-0"
        >
        Verifiable Co-Learner
      </p>
      <NuxtLink
        to="/"
        class="text-sm text-muted underline decoration-transparent underline-offset-4 hover:text-highlighted hover:decoration-current"
      >
        Back to the course
      </NuxtLink>
      </div>
    </header>
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
        <div class="grid gap-6 2xl:grid-cols-[24rem_minmax(0,1fr)] 2xl:items-start">
        <div class="page-enter grid divide-y divide-default overflow-hidden rounded-lg border border-default bg-default shadow-xs lg:grid-cols-2 lg:divide-x lg:divide-y-0 2xl:sticky 2xl:top-8 2xl:grid-cols-1 2xl:divide-x-0 2xl:divide-y">
        <section class="flex flex-col gap-2 p-4 md:p-8">
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">
            Decisions
          </h1>
          <label class="flex min-h-11 items-center gap-3 text-sm text-default">
            <input
              type="checkbox"
              class="size-5"
              name="verifyShield"
              :checked="verifyShieldOn"
              :disabled="switching"
              @change="onVerifyShield"
            >
            VerifyShield is {{ verifyShieldOn ? 'on' : 'off' }}
          </label>
          <p class="text-xs leading-4 text-muted">
            {{ verifyShieldOn
              ? 'On for every student. A closed module or anything out of course is redirected.'
              : 'Off for every student. The next turn allows every proposed move, and the decision log still records it.' }}
          </p>
          <p
            v-if="switchError"
            role="alert"
            class="text-xs leading-4 text-rose-700"
          >
            {{ switchError }}
          </p>
        </section>
        <form
          method="post"
          class="flex w-full flex-col gap-6 p-4 md:p-8"
          @submit.prevent="save"
        >
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-semibold tracking-tight text-highlighted">
              Language model
            </h2>
          <p class="text-xs leading-4 text-muted">
            {{ data.model.saved
              ? 'Saved settings are used on the next turn.'
              : 'Nothing has been saved, so the server environment is used. Saving replaces it on the next turn.' }}
          </p>
        </div>
        <fieldset class="flex flex-col gap-2">
          <legend class="text-xs font-medium leading-4 text-default">
            Provider
          </legend>
          <label class="flex items-center gap-2 text-sm text-default">
            <input
              v-model="provider"
              type="radio"
              name="provider"
              value="real"
              class="size-4"
            >
            Real LLM
          </label>
          <label class="flex items-center gap-2 text-sm text-default">
            <input
              v-model="provider"
              type="radio"
              name="provider"
              value="fake"
              class="size-4"
            >
            Fake
          </label>
        </fieldset>
        <div
          v-if="provider === 'real'"
          class="flex flex-col gap-4"
        >
          <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
            <span>API key</span>
            <UInput
              v-model="apiKey"
              type="password"
              name="apiKey"
              autocomplete="off"
              color="neutral"
              fixed
              class="w-full"
              :ui="{ base: inputClass }"
            />
            <span
              v-if="data.model.apiKeyMask"
              class="font-normal text-muted"
            >
              Current key {{ data.model.apiKeyMask }}. Leave this blank to keep it.
            </span>
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
            <span>Base URL</span>
            <UInput
              v-model="baseUrl"
              type="url"
              name="baseUrl"
              required
              autocomplete="off"
              color="neutral"
              fixed
              class="w-full"
              :ui="{ base: inputClass }"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
            <span>Model name</span>
            <UInput
              v-model="modelName"
              type="text"
              name="modelName"
              required
              autocomplete="off"
              color="neutral"
              fixed
              class="w-full"
              :ui="{ base: inputClass }"
            />
          </label>
        </div>
        <p
          v-if="saveError"
          role="alert"
          class="rounded-sm border border-rose-200/80 bg-rose-50 px-[13px] py-[11px] text-xs leading-[19.5px] text-rose-700"
        >
          {{ saveError }}
        </p>
        <p
          v-else-if="savedNotice"
          role="status"
          class="text-xs leading-4 text-muted"
        >
          {{ savedNotice }}
        </p>
        <UButton
          type="submit"
          block
          size="lg"
          :loading="saving"
          class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent md:min-h-0"
        >
          Save
        </UButton>
        </form>
        </div>
        <section class="flex min-w-0 flex-col gap-4">
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
              class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover md:min-h-0"
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
                  v-for="decision in data.decisions"
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
                    {{ decision.agent === 'teacher' ? 'Teacher' : 'Deskmate' }}
                  </td>
                  <td class="px-3 py-2">
                    {{ proposedText(decision) }}
                  </td>
                  <td class="px-3 py-2">
                    {{ verdictText(decision) }}
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
          </div>
        </section>
        </div>
      </template>
    </main>
  </div>
</template>
