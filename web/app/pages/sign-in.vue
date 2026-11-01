<script setup lang="ts">
import { createRequestClient } from '#shared/supabase-server'

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const pending = ref(false)

if (import.meta.server) {
  const event = useRequestEvent()
  const config = useRuntimeConfig()
  if (event && config.public.supabaseUrl && config.public.supabasePublishableKey) {
    try {
      const supabase = createRequestClient(
        event,
        config.public.supabaseUrl,
        config.public.supabasePublishableKey,
      )
      const { data } = await supabase.auth.getClaims()
      if (data?.claims.sub) {
        await navigateTo('/')
      }
    }
    catch {
      // A broken session cookie still leaves the sign-in form available.
    }
  }
}

useHead({ title: 'Sign in' })

async function signIn() {
  errorMessage.value = ''
  pending.value = true
  try {
    const { error } = await useNuxtApp().$supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) {
      errorMessage.value = 'Email or password is incorrect.'
      return
    }
    await navigateTo('/')
  }
  catch {
    errorMessage.value = 'Sign-in is unavailable right now.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <main class="grid h-dvh place-items-center bg-default px-6">
    <form
      class="w-full max-w-sm space-y-4"
      @submit.prevent="signIn"
    >
      <h1 class="text-lg font-medium">
        Sign in
      </h1>
      <label class="block space-y-1 text-sm">
        <span>Email</span>
        <UInput
          v-model="email"
          type="email"
          name="email"
          autocomplete="username"
          required
          class="w-full"
        />
      </label>
      <label class="block space-y-1 text-sm">
        <span>Password</span>
        <UInput
          v-model="password"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          class="w-full"
        />
      </label>
      <p
        v-if="errorMessage"
        role="alert"
        class="text-sm text-error"
      >
        {{ errorMessage }}
      </p>
      <UButton
        type="submit"
        :loading="pending"
      >
        Sign in
      </UButton>
    </form>
  </main>
</template>
