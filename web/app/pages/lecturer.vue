<script setup lang="ts">
import type { LecturerCourse, LecturerResponse, LecturerStudent } from '#shared/lecturer'
import { isProductOwner } from '~/staff/landing'

definePageMeta({ middleware: 'signed-in' })
useHead({ title: 'Lecturer' })

const productOwner = ref(false)
onMounted(async () => {
  productOwner.value = await isProductOwner($fetch)
})

async function signOut() {
  await useNuxtApp().$supabase.auth.signOut()
  await navigateTo('/sign-in')
}

const { data, error, status } = await useFetch<LecturerResponse>('/api/lecturer', {
  key: 'lecturer-courses',
  getCachedData: () => undefined,
})

const historyLabels: Record<string, string> = {
  seeded: 'Course seeded',
  course_spec_imported: 'Course spec imported',
}
const drafts = reactive<Record<string, number>>({})
const saving = ref<string | null>(null)
const notice = ref('')
const saveError = ref('')
const importing = ref(false)

async function importSpec(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || importing.value || saving.value) return
  importing.value = true
  notice.value = ''
  saveError.value = ''
  try {
    await $fetch('/api/lecturer/spec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await file.text(),
    })
    data.value = await $fetch<LecturerResponse>('/api/lecturer')
    delete drafts.intro_python
    notice.value = 'Course spec imported.'
  }
  catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    saveError.value = statusCode === 400
      ? 'Choose a valid JSON course spec for the Python course.'
      : 'Could not import the course spec.'
  }
  finally {
    importing.value = false
  }
}

function percentage(value: number) {
  return new Intl.NumberFormat('en', { style: 'percent', maximumSignificantDigits: 15 }).format(value)
}

async function saveThreshold(course: LecturerCourse) {
  if (saving.value || importing.value) return
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
const enrolledDate = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

type StudentSortKey = 'displayName' | 'studentNumber' | 'enrolledAt'
const studentSearch = reactive<Record<string, string>>({})
const studentSort = reactive<Record<string, { key: StudentSortKey, asc: boolean }>>({})

function sortOf(courseId: string) {
  return studentSort[courseId] ?? { key: 'displayName' as StudentSortKey, asc: true }
}

function toggleSort(courseId: string, key: StudentSortKey) {
  const current = sortOf(courseId)
  studentSort[courseId] = { key, asc: current.key === key ? !current.asc : true }
}

function ariaSort(courseId: string, key: StudentSortKey): 'none' | 'ascending' | 'descending' {
  const sort = sortOf(courseId)
  if (sort.key !== key) return 'none'
  return sort.asc ? 'ascending' : 'descending'
}

function studentsOf(course: LecturerCourse): LecturerStudent[] {
  const term = (studentSearch[course.id] ?? '').trim().toLowerCase()
  const sort = sortOf(course.id)
  return course.students
    .filter(student => !term
      || student.displayName.toLowerCase().includes(term)
      || student.studentNumber.toLowerCase().includes(term))
    .sort((left, right) => {
      const direction = sort.asc ? 1 : -1
      return left[sort.key].localeCompare(right[sort.key], 'en', { numeric: true }) * direction
    })
}

function enrolledText(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return enrolledDate.format(parsed)
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <header class="phone-safe-top shrink-0 border-b border-default/80 bg-default px-4 py-4 md:px-8">
      <div class="mx-auto flex w-full max-w-[86rem] items-center justify-between gap-4">
        <p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-highlighted">
          <img src="/swinburne-fpt-logo.webp" alt="" width="871" height="705" class="block h-8 w-auto shrink-0">
          Verifiable Co-Learner
        </p>
        <div class="flex items-center gap-4">
          <NuxtLink
            v-if="productOwner"
            to="/admin"
            class="text-sm text-muted underline decoration-transparent underline-offset-4 hover:text-highlighted hover:decoration-current"
          >
            Admin page
          </NuxtLink>
          <button
            type="button"
            class="min-h-11 text-sm text-muted underline decoration-transparent underline-offset-4 hover:text-highlighted hover:decoration-current md:min-h-0"
            @click="signOut"
          >
            Sign out
          </button>
        </div>
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
            :disabled="saving !== null || importing"
            class="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {{ saving === course.id ? 'Saving…' : 'Save threshold' }}
          </button>
          <p class="pb-3 text-sm text-muted">Current threshold {{ percentage(course.masteryThreshold) }}</p>
        </form>
        <section
          class="border-t border-default p-4 md:p-8"
          data-testid="course-students"
        >
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h3 class="text-sm font-semibold text-highlighted">
              Enrolled students
            </h3>
            <label class="flex w-full flex-col gap-1.5 text-xs font-medium leading-4 text-default md:w-64">
              <span>Search students</span>
              <UInput
                v-model="studentSearch[course.id]"
                type="search"
                autocomplete="off"
                color="neutral"
                fixed
                placeholder="Name or student number"
                class="w-full"
                :ui="{ base: 'min-h-11 rounded-sm px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5' }"
              />
            </label>
          </div>
          <p v-if="!course.students.length" class="mt-3 text-sm text-muted">
            No students enrolled yet.
          </p>
          <p v-else-if="!studentsOf(course).length" class="mt-3 text-sm text-muted">
            No students match.
          </p>
          <div
            v-else
            class="mt-3 overflow-hidden rounded-lg border border-default"
          >
            <table class="w-full border-collapse text-left text-sm text-default">
              <thead class="border-b border-default bg-muted text-xs text-muted">
                <tr>
                  <th scope="col" class="px-3 py-2 font-medium" :aria-sort="ariaSort(course.id, 'displayName')">
                    <button type="button" class="inline-flex min-h-11 items-center gap-1 hover:text-highlighted md:min-h-0" @click="toggleSort(course.id, 'displayName')">
                      Name<span v-if="sortOf(course.id).key === 'displayName'" aria-hidden="true">{{ sortOf(course.id).asc ? '↑' : '↓' }}</span>
                    </button>
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium" :aria-sort="ariaSort(course.id, 'studentNumber')">
                    <button type="button" class="inline-flex min-h-11 items-center gap-1 hover:text-highlighted md:min-h-0" @click="toggleSort(course.id, 'studentNumber')">
                      Student number<span v-if="sortOf(course.id).key === 'studentNumber'" aria-hidden="true">{{ sortOf(course.id).asc ? '↑' : '↓' }}</span>
                    </button>
                  </th>
                  <th scope="col" class="hidden px-3 py-2 font-medium md:table-cell">
                    Email
                  </th>
                  <th scope="col" class="hidden px-3 py-2 font-medium md:table-cell" :aria-sort="ariaSort(course.id, 'enrolledAt')">
                    <button type="button" class="inline-flex min-h-11 items-center gap-1 hover:text-highlighted md:min-h-0" @click="toggleSort(course.id, 'enrolledAt')">
                      Enrolled<span v-if="sortOf(course.id).key === 'enrolledAt'" aria-hidden="true">{{ sortOf(course.id).asc ? '↑' : '↓' }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="student in studentsOf(course)"
                  :key="student.studentNumber"
                  class="border-t border-default align-top"
                >
                  <td class="px-3 py-3">
                    <p class="font-medium text-highlighted [overflow-wrap:anywhere]">
                      {{ student.displayName }}
                    </p>
                    <p class="text-xs text-muted [overflow-wrap:anywhere] md:hidden">
                      {{ student.email }}
                    </p>
                  </td>
                  <td class="px-3 py-3">
                    <p class="font-mono whitespace-nowrap">
                      {{ student.studentNumber }}
                    </p>
                    <p class="text-xs text-muted whitespace-nowrap md:hidden">
                      Enrolled {{ enrolledText(student.enrolledAt) }}
                    </p>
                  </td>
                  <td class="hidden px-3 py-3 [overflow-wrap:anywhere] md:table-cell">
                    {{ student.email }}
                  </td>
                  <td class="hidden px-3 py-3 whitespace-nowrap md:table-cell">
                    <time :datetime="student.enrolledAt">{{ enrolledText(student.enrolledAt) }}</time>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <div v-if="course.id === 'intro_python'" class="flex flex-wrap items-center gap-4 border-t border-default p-4 md:px-8">
          <a
            href="/api/lecturer/spec?courseId=intro_python"
            download="intro_python.json"
            class="text-sm font-medium text-brand-700 underline underline-offset-4"
          >Export course spec</a>
          <label class="flex flex-wrap items-center gap-3 text-sm font-medium text-highlighted">
            {{ importing ? 'Importing…' : 'Import course spec' }}
            <input
              type="file"
              accept=".json,application/json"
              :disabled="importing || saving !== null"
              class="max-w-full text-sm text-default file:mr-3 file:min-h-11 file:rounded-sm file:border-0 file:bg-accent file:px-4 file:text-on-accent"
              @change="importSpec"
            >
          </label>
        </div>
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
