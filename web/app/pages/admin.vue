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

const provider = ref<'real' | 'fake'>('real')
const apiKey = ref('')
const baseUrl = ref('')
const modelName = ref('')
const saving = ref(false)
const saveError = ref('')
const savedNotice = ref('')

const { data, error, refresh } = await useFetch<{ model: ModelSettingsView }>('/api/admin', {
  method: 'POST',
  body: { event: 'read' },
})

watch(data, (payload) => {
  if (!payload) return
  provider.value = payload.model.provider
  baseUrl.value = payload.model.baseUrl
  modelName.value = payload.model.modelName
}, { immediate: true })

const refused = computed(() => error.value?.statusCode === 403)
const unavailable = computed(() => Boolean(error.value) && !refused.value)
const inputClass = 'min-h-11 rounded-sm px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5'

useHead({ title: 'Language model' })

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
    <header class="phone-safe-top flex shrink-0 items-center justify-between border-b border-default/80 bg-default px-4 py-4 md:px-8">
      <p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-highlighted">
        <span
          class="size-2.5 shrink-0 rounded-sm bg-primary-600"
          aria-hidden="true"
        />
        Verifiable Co-Learner
      </p>
      <NuxtLink
        to="/"
        class="text-sm text-muted hover:text-highlighted"
      >
        Back to the course
      </NuxtLink>
    </header>
    <main class="phone-safe-bottom grid flex-1 place-items-center p-4 md:p-6">
      <p
        v-if="refused"
        role="alert"
        class="max-w-sm text-center text-sm text-default"
      >
        This page is for the product owner.
      </p>
      <p
        v-else-if="unavailable"
        role="alert"
        class="max-w-sm text-center text-sm text-default"
      >
        The language model settings are unavailable right now.
      </p>
      <form
        v-else-if="data"
        method="post"
        class="flex w-full flex-col gap-6 rounded-lg border border-default bg-default p-4 shadow-xs md:max-w-md md:p-8"
        @submit.prevent="save"
      >
        <div class="flex flex-col gap-1">
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">
            Language model
          </h1>
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
          class="min-h-11 rounded-sm bg-primary-600 px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-primary-700 active:bg-primary-700 disabled:bg-primary-600 md:min-h-0"
        >
          Save
        </UButton>
      </form>
    </main>
  </div>
</template>
