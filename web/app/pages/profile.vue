<script setup lang="ts">
import type { StudentResponse } from '../../server/student'

definePageMeta({
  middleware: ['signed-in', 'staff-landing'],
})

class PictureRejectedError extends Error {}

const profile = ref<StudentResponse['profile'] | null>(null)
const displayName = ref('')
const errorMessage = ref('')
const saved = ref('')
const busy = ref(false)

const requestFetch = useRequestFetch()
const loaded = await requestFetch<StudentResponse>('/api/student', { method: 'POST', body: { event: 'open' } })
profile.value = loaded.profile
displayName.value = loaded.profile.displayName

useHead({ title: 'Profile' })

async function saveName() {
  busy.value = true
  errorMessage.value = ''
  saved.value = ''
  try {
    const next = await $fetch<StudentResponse>('/api/student', {
      method: 'POST',
      body: { event: 'profile_changed', displayName: displayName.value },
    })
    profile.value = next.profile
    saved.value = 'Saved.'
  }
  catch (error) {
    errorMessage.value = messageOf(error)
  }
  finally {
    busy.value = false
  }
}

const pictureTypes = ['image/jpeg', 'image/png', 'image/webp']
const pictureLimit = 2 * 1024 * 1024

// The checks here mirror the server's, so a picture it would refuse never leaves
// this page. Re-encoding can bring a large source under the limit, which hides
// it from the server but not from the student who picked it.
function pictureProblem(file: File): string {
  if (!pictureTypes.includes(file.type)) return 'Use a JPEG, PNG or WebP picture.'
  if (file.size > pictureLimit) return 'The picture must be 2 MB or smaller.'
  return ''
}

function messageOf(error: unknown): string {
  if (typeof error === 'object' && error && 'statusMessage' in error && typeof error.statusMessage === 'string') {
    return error.statusMessage
  }
  if (error instanceof PictureRejectedError) return error.message
  return 'The profile could not be saved.'
}

function squarePicture(file: File): Promise<{ contentType: string, base64: string }> {
  const contentType = file.type
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const size = Math.min(image.width, image.height)
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('The picture could not be cropped.'))
        return
      }
      context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 512, 512)
      const url = canvas.toDataURL(contentType, 0.9)
      resolve({ contentType, base64: url.slice(url.indexOf(',') + 1) })
    }
    image.onerror = () => reject(new PictureRejectedError('Use a JPEG, PNG or WebP picture.'))
    image.src = URL.createObjectURL(file)
  })
}

const pictureInput = useTemplateRef<HTMLInputElement>('pictureInput')

// A refused picture stays out of the input, so picking the same file again
// still counts as a change and shows the reason.
function onPicture() {
  const input = pictureInput.value
  const file = input?.files?.[0]
  if (!input || !file) return
  const problem = pictureProblem(file)
  if (problem) {
    input.value = ''
    errorMessage.value = problem
    return
  }
  errorMessage.value = ''
  void sendPicture(file)
}

async function sendPicture(file: File) {
  busy.value = true
  saved.value = ''
  try {
    const picture = await squarePicture(file)
    const next = await $fetch<StudentResponse>('/api/student', {
      method: 'POST',
      body: { event: 'profile_changed', picture },
    })
    profile.value = next.profile
    saved.value = 'Picture saved.'
  }
  catch (error) {
    errorMessage.value = messageOf(error)
  }
  finally {
    busy.value = false
  }
}
</script>
<template>
  <main class="phone-safe mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 bg-default px-4 py-8">
    <p class="text-sm"><NuxtLink to="/" class="text-brand-700 underline">Back to the workspace</NuxtLink></p>
    <h1 class="text-xl font-semibold text-highlighted">Profile</h1>
    <p class="text-sm text-ink-600">Your activity in the app is recorded. It is not used to grade you, and no screen shows it.</p>
    <img
      :src="profile?.pictureUrl ?? '/portraits/student.png'"
      alt=""
      class="size-24 rounded-[4px] border border-ink-200 object-cover"
      data-profile-picture
    >
    <label class="flex flex-col gap-1 text-sm">
      Profile picture
      <input ref="pictureInput" type="file" accept="image/jpeg,image/png,image/webp" class="text-sm" :disabled="busy" @change="onPicture">
    </label>
    <form class="flex flex-col gap-4" @submit.prevent="saveName">
      <label class="flex flex-col gap-1 text-sm">
        Display name
        <input v-model="displayName" name="displayName" required class="min-h-11 rounded-sm border border-ink-300 px-3">
      </label>
      <p class="text-sm text-ink-600">Email <span class="text-ink-900">{{ profile?.email }}</span></p>
      <p class="text-sm text-ink-600">Student number <span class="font-mono text-ink-900">{{ profile?.studentNumber }}</span></p>
      <button type="submit" class="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent" :disabled="busy">Save name</button>
    </form>
    <p v-if="saved" role="status" class="text-sm text-emerald-700">{{ saved }}</p>
    <p v-if="errorMessage" role="alert" class="text-sm text-rose-700">{{ errorMessage }}</p>
  </main>
</template>
