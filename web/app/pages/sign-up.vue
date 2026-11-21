<script setup lang="ts">
import { isStudentEmail, studentEmailRule } from '#shared/student-email'
import { campuses, type Campus } from '#shared/campus'
import { recordStudentActivity } from '~/activity/record'

useHead({ title: 'Sign up' })

// A new student signs up with their Swinburne student email: the server sends a
// 6-digit code there, and the account is made when the code is verified.
const unreachableMessage = 'The sign-up service could not be reached. Check your connection and try again.'
const wrongCodeMessage = 'That code is wrong or has expired. Codes last 5 minutes; ask for a new one.'
const inputClass = 'min-h-11 rounded-sm bg-default px-3 py-2.5 text-base text-default ring-1 ring-ink-200 md:min-h-0 md:text-sm'

const step = ref<'email' | 'code'>('email')
const email = ref('')
const displayName = ref('')
const campus = ref<Campus | ''>('')
const password = ref('')
const confirmPassword = ref('')
const minimumPasswordLength = 8

function detailsProblem(): string {
  if (!isStudentEmail(email.value)) return studentEmailRule
  if (displayName.value.trim().length === 0) return 'Enter your name.'
  if (campus.value === '') return 'Choose your campus.'
  if (password.value.length < minimumPasswordLength) return `Use a password of at least ${minimumPasswordLength} characters.`
  if (password.value !== confirmPassword.value) return 'The two passwords do not match.'
  return ''
}

function messageOf(error: unknown, fallback: string): string {
  return typeof error === 'object' && error && 'statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage
    ? error.statusMessage
    : fallback
}
const code = ref('')
const pending = ref(false)
const errorMessage = ref('')
const notice = ref('')

async function sendCode() {
  errorMessage.value = ''
  notice.value = ''
  email.value = email.value.trim().toLowerCase()
  const problem = detailsProblem()
  if (problem) {
    errorMessage.value = problem
    return
  }
  pending.value = true
  try {
    await $fetch('/api/sign-in-code', { method: 'POST', body: { email: email.value } })
    notice.value = step.value === 'code' ? 'A new code is on its way.' : ''
    step.value = 'code'
    code.value = ''
  }
  catch (error) {
    errorMessage.value = messageOf(error, unreachableMessage)
  }
  finally {
    pending.value = false
  }
}

// An account that already has a campus keeps it; only the administrator changes it.
async function saveCampus() {
  try {
    await $fetch('/api/student', { method: 'POST', body: { event: 'campus_chosen', campus: campus.value } })
  }
  catch (error) {
    if (!messageOf(error, '').includes('already chosen')) throw error
  }
}

async function verifyCode() {
  errorMessage.value = ''
  notice.value = ''
  pending.value = true
  try {
    const { error } = await useNuxtApp().$supabase.auth.verifyOtp({ email: email.value, token: code.value.trim(), type: 'email' })
    if (error) {
      errorMessage.value = error.name === 'AuthRetryableFetchError' ? unreachableMessage : wrongCodeMessage
      return
    }
  }
  catch {
    errorMessage.value = unreachableMessage
    pending.value = false
    return
  }
  // The code proved the email; now the account takes the chosen details.
  try {
    const { error } = await useNuxtApp().$supabase.auth.updateUser({ password: password.value })
    if (error) throw error
    await saveCampus()
    await $fetch('/api/student', { method: 'POST', body: { event: 'profile_changed', displayName: displayName.value.trim() } })
    await recordStudentActivity({ event: 'signed_in' })
    await navigateTo('/')
  }
  catch (error) {
    errorMessage.value = messageOf(error, 'Your account was made, but your details could not be saved. Sign in and set them on your profile.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <main class="phone-safe-bottom phone-safe-top flex flex-1 flex-col items-center justify-center p-4 md:p-6">
      <form
        class="page-enter flex w-full flex-col gap-6 rounded-xl border border-default bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_40px_-20px_rgb(15_23_42/0.16)] md:max-w-sm md:p-8"
        @submit.prevent="step === 'email' ? sendCode() : verifyCode()"
      >
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
            Sign up
          </h1>
          <p v-if="step === 'email'" class="text-sm/5 text-muted">
            Only Swinburne student emails ending in @student.swin.edu.au can sign up. We will email you a 6-digit code to confirm it.
          </p>
          <p v-else class="text-sm/5 text-muted">
            We emailed a 6-digit code to <strong class="font-medium text-default [overflow-wrap:anywhere]">{{ email }}</strong>. It expires after 5 minutes.
          </p>
        </div>
        <p
          v-if="errorMessage"
          role="alert"
          class="rounded-sm border border-rose-200/80 bg-rose-50 px-[13px] py-[11px] text-xs leading-[19.5px] text-rose-700"
        >
          {{ errorMessage }}
        </p>
        <p
          v-if="notice"
          role="status"
          class="rounded-sm border border-default bg-muted px-[13px] py-[11px] text-xs leading-[19.5px] text-default"
        >
          {{ notice }}
        </p>
        <div class="flex flex-col gap-4">
          <label v-if="step === 'email'" class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
            <span>Student email</span>
            <UInput
              v-model="email"
              type="email"
              name="student-email"
              autocomplete="email"
              placeholder="104123456@student.swin.edu.au"
              required
              color="neutral"
              fixed
              class="w-full"
              :ui="{ base: inputClass }"
            />
          </label>
          <template v-if="step === 'email'">
            <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
              <span>Name</span>
              <UInput v-model="displayName" type="text" name="name" autocomplete="name" required color="neutral" fixed class="w-full" :ui="{ base: inputClass }" />
            </label>
            <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
              <span>Campus</span>
              <select v-model="campus" name="campus" required :class="`${inputClass} w-full`">
                <option value="" disabled>Choose your campus</option>
                <option v-for="option in campuses" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="flex flex-col gap-1.5 text-xs font-medium leading-4 text-default">
              <span>Password</span>
              <UInput v-model="password" type="password" name="new-password" autocomplete="new-password" :minlength="minimumPasswordLength" required color="neutral" fixed class="w-full" :ui="{ base: inputClass }" />
            </label>
            <label class="flex flex-col gap-1.5 pb-2 text-xs font-medium leading-4 text-default">
              <span>Confirm password</span>
              <UInput v-model="confirmPassword" type="password" name="confirm-password" autocomplete="new-password" :minlength="minimumPasswordLength" required color="neutral" fixed class="w-full" :ui="{ base: inputClass }" />
            </label>
          </template>
          <label v-else class="flex flex-col gap-1.5 pb-2 text-xs font-medium leading-4 text-default">
            <span>6-digit code</span>
            <UInput
              v-model="code"
              type="text"
              name="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="[0-9]{6}"
              required
              color="neutral"
              fixed
              class="w-full"
              :ui="{ base: inputClass }"
            />
          </label>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="pending"
            class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent md:min-h-0"
          >
            {{ step === 'email' ? 'Send code' : 'Create account' }}
          </UButton>
          <button
            v-if="step === 'code'"
            type="button"
            class="inline-flex min-h-11 items-center justify-center text-sm font-medium text-muted underline-offset-4 hover:text-highlighted hover:underline disabled:opacity-50 md:min-h-0"
            :disabled="pending"
            @click="sendCode"
          >
            Send a new code
          </button>
          <NuxtLink
            to="/sign-in"
            class="inline-flex min-h-11 items-center justify-center text-sm font-medium text-muted underline-offset-4 hover:text-highlighted hover:underline md:min-h-0"
          >
            Already have an account? Sign in
          </NuxtLink>
        </div>
      </form>
    </main>
  </div>
</template>
