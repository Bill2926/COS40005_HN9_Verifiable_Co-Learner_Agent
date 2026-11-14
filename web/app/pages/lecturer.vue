<script setup lang="ts">
import type { LecturerCourse, LecturerResponse } from '#shared/lecturer'

definePageMeta({ middleware: 'signed-in' })
useHead({ title: 'Lecturer' })

const { data, error, status } = await useFetch<LecturerResponse>('/api/lecturer', {
  key: 'lecturer-courses',
  getCachedData: () => undefined,
})

const historyLabels: Record<string, string> = { seeded: 'Course seeded' }
const drafts = reactive<Record<string, number>>({})
const saving = ref<string | null>(null)
const notice = ref('')
const saveError = ref('')

function percentage(value: number) {
  return new Intl.NumberFormat('en', { style: 'percent', maximumSignificantDigits: 15 }).format(value)
}

async function saveThreshold(course: LecturerCourse) {
  if (saving.value) return
  saving.value = course.id
  notice.value = ''
  saveError.value = ''
  try {
    const threshold = (drafts[course.id] ?? course.masteryThreshold * 100) / 100
    data.value = await $fetch<LecturerResponse>('/api/lecturer', {
      method: 'POST',
      body: { courseId: course.id, threshold },
    })
    delete drafts[course.id]
    notice.value = 'Mastery threshold saved.'
  }
  catch {
    saveError.value = 'Could not save the mastery threshold.'
  }
  finally {
    saving.value = null
  }
}
const dateTime = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <header class="phone-safe-top shrink-0 border-b border-default/80 bg-default px-4 py-4 md:px-8">
      <div class="mx-auto flex w-full max-w-[86rem] items-center justify-between gap-4">
        <p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-highlighted">
          <img src="/swinburne-fpt-logo.webp" alt="" width="871" height="705" class="block h-8 w-auto shrink-0">
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
      <h1 class="text-xl font-semibold tracking-tight text-highlighted">Lecturer</h1>
      <p v-if="status === 'pending'" role="status" class="text-sm text-muted">Loading courses…</p>
      <p v-else-if="error" role="alert" class="text-sm text-default">
        {{ error.statusCode === 403 ? 'This page is for lecturers.' : 'Courses are unavailable right now.' }}
      </p>
      <p v-else-if="!data?.courses.length" class="text-sm text-muted">You have no courses.</p>
      <p v-if="notice" role="status" class="text-sm text-default">{{ notice }}</p>
      <p v-if="saveError" role="alert" class="text-sm text-rose-700">{{ saveError }}</p>
      <article
        v-for="course in data?.courses"
        :key="course.id"
        class="overflow-hidden rounded-lg border border-default bg-default shadow-xs"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-3 p-4 md:p-8">
          <h2 class="text-lg font-semibold text-highlighted">{{ course.title }}</h2>
          <p class="text-sm text-muted" data-testid="enrollment-count">
            <strong class="text-2xl font-semibold text-highlighted">{{ course.enrolledCount }}</strong>
            {{ course.enrolledCount === 1 ? 'student enrolled' : 'students enrolled' }}
          </p>
        </div>
        <form class="flex flex-wrap items-end gap-3 border-t border-default p-4 md:px-8" @submit.prevent="saveThreshold(course)">
          <label class="grid gap-1 text-sm font-medium text-highlighted">
            Mastery threshold (%)
            <input
              :value="drafts[course.id] ?? percentage(course.masteryThreshold).replace('%', '')"
              @input="drafts[course.id] = ($event.target as HTMLInputElement).valueAsNumber"
              type="number"
              min="50"
              max="99"
              step="any"
              required
              class="min-h-11 w-32 rounded-sm border border-default bg-default px-3 text-default"
            >
          </label>
          <button
            type="submit"
            :disabled="saving !== null"
            class="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {{ saving === course.id ? 'Saving…' : 'Save threshold' }}
          </button>
          <p class="pb-3 text-sm text-muted">Current threshold {{ percentage(course.masteryThreshold) }}</p>
        </form>
        <section class="border-t border-default p-4 md:p-8">
          <h3 class="text-sm font-semibold text-highlighted">Course history</h3>
          <p v-if="!course.history.length" class="mt-3 text-sm text-muted">No course history yet.</p>
          <ul v-else class="mt-1 divide-y divide-default">
            <li
              v-for="(entry, index) in course.history"
              :key="index"
              class="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
            >
              <p class="text-default">
                <template v-if="entry.previousThreshold !== undefined && entry.masteryThreshold !== undefined">
                  Mastery threshold changed from {{ percentage(entry.previousThreshold) }} to {{ percentage(entry.masteryThreshold) }}
                </template>
                <template v-else>{{ historyLabels[entry.action] ?? entry.action }}</template>
                <span class="text-muted">· {{ entry.actorEmail }}</span>
              </p>
              <time :datetime="entry.time" class="text-muted">{{ dateTime.format(new Date(entry.time)) }} UTC</time>
            </li>
          </ul>
        </section>
      </article>
    </main>
  </div>
</template>
