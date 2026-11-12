<script setup lang="ts">
import { sessionStudentId } from '#shared/student-id'

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const credentialsRejected = ref(false)
const pending = ref(false)

const incorrectMessage = 'Email or password is incorrect.'
const unreachableMessage = 'Sign-in is unavailable right now.'

const inputClass = 'min-h-11 rounded-sm px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5'

if (import.meta.server) {
  const event = useRequestEvent()
  if (event && await sessionStudentId(event)) {
    await navigateTo('/')
  }
}

useHead({ title: 'Sign in' })

async function signIn() {
  errorMessage.value = ''
  credentialsRejected.value = false
  pending.value = true
  try {
    const { error } = await useNuxtApp().$supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      if (error.name === 'AuthRetryableFetchError') {
        errorMessage.value = unreachableMessage
        return
      }
      errorMessage.value = incorrectMessage
      credentialsRejected.value = true
      return
    }
    await navigateTo('/')
  }
  catch {
    errorMessage.value = unreachableMessage
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <header class="phone-safe-top flex shrink-0 items-center border-b border-default/80 bg-default px-4 py-4 md:px-8 md:py-4">
      <p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-highlighted">
        <img
          src="/swinburne-logo.svg"
          alt=""
          width="500"
          height="253"
          class="block h-6 w-auto shrink-0"
        >
        Verifiable Co-Learner
      </p>
    </header>
    <main class="phone-safe-bottom grid flex-1 place-items-center p-4 md:p-6">
      <div class="page-enter flex w-full flex-col items-center gap-4 md:max-w-sm md:gap-6">
        <img
          src="/swinburne-logo.svg"
          alt="Swinburne University of Technology"
          width="500"
          height="253"
          class="block h-12 w-auto max-w-full md:h-16"
        >
        <form
          class="flex w-full flex-col gap-6 rounded-lg border border-default bg-default p-4 shadow-xs md:p-8"
          @submit.prevent="signIn"
        >
          <div class="flex flex-col gap-1">
            <h1 class="text-xl font-semibold tracking-tight text-highlighted">
              Sign in
            </h1>
            <p class="text-xs leading-4 text-muted">
              Sign in to continue where you left off.
            </p>
          </div>
          <p
            v-if="errorMessage"
            role="alert"
            class="flex items-start gap-2.5 rounded-sm border border-rose-200/80 bg-rose-50 px-[13px] py-[11px] text-xs leading-[19.5px] text-rose-700"
          >
            <span class="inline-flex shrink-0 pt-0.5">
              <img
                src="/sign-in-error.svg"
                alt=""
                width="16"
                height="16"
              >
            </span>
            {{ errorMessage }}
          </p>
          <div class="flex flex-col gap-4">
            <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
              <span>Email</span>
              <UInput
                v-model="email"
                type="email"
                name="email"
                autocomplete="username"
                required
                color="neutral"
                fixed
                class="w-full"
                :ui="{ base: inputClass }"
              />
            </label>
            <label class="flex flex-col gap-1.5 pb-2 text-xs font-medium leading-4 text-default">
              <span>Password</span>
              <UInput
                v-model="password"
                type="password"
                name="password"
                autocomplete="current-password"
                required
                color="neutral"
                fixed
                class="w-full"
                :aria-invalid="credentialsRejected || undefined"
                :ui="{ base: credentialsRejected ? `${inputClass} ring-rose-300 focus-visible:ring-rose-300` : inputClass }"
              />
            </label>
            <UButton
              type="submit"
              block
              size="lg"
              :loading="pending"
              class="min-h-11 rounded-sm bg-primary-600 px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-primary-700 active:bg-primary-700 disabled:bg-primary-600 md:min-h-0"
            >
              Sign in
            </UButton>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>
