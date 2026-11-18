<script setup lang="ts">
import { campuses, type Campus } from '#shared/campus'

const emit = defineEmits<{ chosen: [campus: Campus] }>()

const selected = ref<Campus | ''>('')
const pending = ref(false)
const errorMessage = ref('')

async function choose() {
  if (selected.value === '' || pending.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/student', { method: 'POST', body: { event: 'campus_chosen', campus: selected.value } })
    emit('chosen', selected.value)
  }
  catch (error) {
    errorMessage.value = typeof error === 'object' && error && 'statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage
      ? error.statusMessage
      : 'Your campus could not be saved. Try again.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="campus-step-title"
    class="phone-safe fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-muted p-4"
  >
    <form
      class="flex w-full flex-col gap-6 rounded-xl border border-default bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_40px_-20px_rgb(15_23_42/0.16)] md:max-w-sm md:p-8"
      @submit.prevent="choose"
    >
      <div class="flex flex-col gap-1">
        <h1 id="campus-step-title" class="text-2xl font-semibold tracking-tight text-highlighted">
          Choose your campus
        </h1>
        <p class="text-sm/5 text-muted">
          Pick the campus you study at. You choose once; only the product owner can change it afterwards.
        </p>
      </div>
      <p
        v-if="errorMessage"
        role="alert"
        class="rounded-sm border border-rose-200/80 bg-rose-50 px-[13px] py-[11px] text-xs leading-[19.5px] text-rose-700"
      >
        {{ errorMessage }}
      </p>
      <fieldset class="flex flex-col gap-2">
        <legend class="sr-only">
          Campus
        </legend>
        <label
          v-for="campus in campuses"
          :key="campus"
          class="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-default px-3 text-sm text-default has-checked:border-accent has-checked:bg-muted"
        >
          <input v-model="selected" type="radio" name="campus" :value="campus" class="size-4 accent-current">
          {{ campus }}
        </label>
      </fieldset>
      <UButton
        type="submit"
        block
        size="lg"
        :loading="pending"
        :disabled="selected === ''"
        class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent md:min-h-0"
      >
        Continue
      </UButton>
    </form>
  </div>
</template>
