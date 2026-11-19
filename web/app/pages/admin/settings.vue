<script setup lang="ts">
import AdminHeader from '~/components/admin/AdminHeader.vue'
import BusySpinner from '~/components/BusySpinner.vue'
import { messageFrom } from '~/admin/message'
import type { AdminPayload, ConnectionCheckView, ConnectionReportView } from '~/admin/decisions'

definePageMeta({
  middleware: 'signed-in',
})

const provider = ref<'real' | 'fake'>('real')
const apiKey = ref('')
const baseUrl = ref('')
const modelName = ref('')
const saving = ref(false)
const saveError = ref('')
const savedNotice = ref('')
const testing = ref(false)
const testError = ref('')
const report = ref<ConnectionReportView | null>(null)
const verifyShieldOn = ref(true)
const switching = ref(false)
const switchError = ref('')

const requestFetch = useRequestFetch()
const { data, error, refresh } = await useAsyncData(
  'product-owner-settings',
  () => requestFetch<AdminPayload>('/api/admin', { method: 'POST', body: { event: 'read' } }),
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

// The provider as the form holds it, sent as it is for a save and for a connection test alike.
const modelFields = computed(() => ({
  provider: provider.value,
  apiKey: apiKey.value,
  baseUrl: baseUrl.value,
  modelName: modelName.value,
}))

useHead({ title: 'Settings' })

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
    switchError.value = messageFrom(caught, 'The settings could not be saved.')
    await refresh()
  }
  finally {
    switching.value = false
  }
}

async function save() {
  saveError.value = ''
  savedNotice.value = ''
  saving.value = true
  try {
    await $fetch('/api/admin', { method: 'POST', body: { event: 'save', ...modelFields.value } })
    apiKey.value = ''
    await refresh()
    savedNotice.value = 'Saved. The next turn uses these settings.'
  }
  catch (caught) {
    saveError.value = messageFrom(caught, 'The settings could not be saved.')
  }
  finally {
    saving.value = false
  }
}

// An answer is only worth showing for as long as the settings it was given for are on the form.
watch(modelFields, () => {
  report.value = null
  testError.value = ''
})

async function testConnection() {
  testError.value = ''
  report.value = null
  testing.value = true
  try {
    report.value = await $fetch<ConnectionReportView>('/api/admin', { method: 'POST', body: { event: 'testConnection', ...modelFields.value } })
  }
  catch (caught) {
    testError.value = messageFrom(caught, 'The connection could not be tested.')
  }
  finally {
    testing.value = false
  }
}

function checkText(label: string, check: ConnectionCheckView): string {
  return check.ok
    ? `${label} answered in ${check.ms} ms.`
    : `${label} failed after ${check.ms} ms: ${check.error ?? 'the provider did not answer.'}`
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
        This page is for the administrator.
      </p>
      <p
        v-else-if="unavailable"
        role="alert"
        class="max-w-sm text-sm text-default"
      >
        This page is unavailable right now.
      </p>
      <template v-else-if="data">
        <div class="page-enter grid divide-y divide-default overflow-hidden rounded-lg border border-default bg-default shadow-xs lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section class="flex flex-col gap-2 p-4 md:p-8">
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">
            VerifyShield
          </h1>
          <label class="flex min-h-11 items-center gap-3 text-sm text-default">
            <input
              type="checkbox"
              class="size-5"
              name="verifyShield"
              :checked="verifyShieldOn"
              :disabled="switching"
              :aria-busy="switching"
              @change="onVerifyShield"
            >
            VerifyShield is {{ verifyShieldOn ? 'on' : 'off' }}
            <BusySpinner
              v-if="switching"
              class="text-brand-600"
            />
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
          <div class="flex flex-col gap-2">
            <UButton
              type="button"
              size="lg"
              :loading="testing"
              :disabled="testing"
              :aria-busy="testing"
              class="min-h-11 self-start rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover disabled:bg-accent md:min-h-0"
              @click="testConnection"
            >
              Test connection
            </UButton>
            <p
              v-if="testError"
              role="alert"
              class="text-xs leading-4 text-rose-700"
            >
              {{ testError }}
            </p>
            <div
              v-else-if="report"
              role="status"
            >
              <ul class="flex flex-col gap-1 text-xs leading-4">
                <li :class="report.reply.ok ? 'text-emerald-700' : 'text-rose-700'">
                  {{ checkText('Plain reply', report.reply) }}
                </li>
                <li :class="report.toolCall.ok ? 'text-emerald-700' : 'text-rose-700'">
                  {{ checkText('Tool call', report.toolCall) }}
                </li>
              </ul>
            </div>
            <p class="text-xs leading-4 text-muted">
              Two calls with the settings above, saving nothing: one answer in words, and one proposal
              asked for as a tool call. A key left blank is the key in effect.
            </p>
          </div>
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
          :disabled="saving"
          :aria-busy="saving"
          class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent md:min-h-0"
        >
          Save
        </UButton>
        </form>
        </div>
      </template>
    </main>
  </div>
</template>
