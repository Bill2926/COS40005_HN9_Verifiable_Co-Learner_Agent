<script setup lang="ts">
import AdminHeader from '~/components/admin/AdminHeader.vue'
import { messageFrom } from '~/admin/message'
import { isStudentNumber, studentNumberRule } from '#shared/student-number'
import type { AdminPayload } from '~/admin/decisions'

definePageMeta({
  middleware: 'signed-in',
})

const requestFetch = useRequestFetch()
const { data, error, refresh } = await useAsyncData(
  'product-owner-students',
  () => requestFetch<AdminPayload>('/api/admin', { method: 'POST', body: { event: 'students' } }),
)

const drafts = reactive<Record<string, string>>({})
const saving = ref<string | null>(null)
const changeError = ref('')
const notice = ref('')
const inputClass = 'min-h-11 rounded-sm px-[13px] py-[9px] text-base/6 md:min-h-0 md:text-sm/5'

useHead({ title: 'Students' })

const refused = computed(() => error.value?.statusCode === 403)
const unavailable = computed(() => Boolean(error.value) && !refused.value)

function validNumber(value: string): boolean {
  return isStudentNumber(value.trim())
}

async function changeNumber(studentId: string) {
  if (saving.value) return
  changeError.value = ''
  notice.value = ''
  const studentNumber = (drafts[studentId] ?? '').trim()
  if (!validNumber(studentNumber)) {
    changeError.value = studentNumberRule
    return
  }
  saving.value = studentId
  try {
    await $fetch('/api/admin', {
      method: 'POST',
      body: { event: 'studentNumber', studentId, studentNumber },
    })
    delete drafts[studentId]
    await refresh()
    notice.value = 'Student number changed.'
  }
  catch (caught) {
    changeError.value = messageFrom(caught, 'The student number could not be changed.')
  }
  finally {
    saving.value = null
  }
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
        <section class="page-enter flex min-w-0 flex-col gap-4">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h1 class="text-xl font-semibold tracking-tight text-highlighted">
              Students
            </h1>
            <p class="text-sm text-muted">
              <strong class="text-highlighted">{{ data.students.length }}</strong>
              {{ data.students.length === 1 ? 'student' : 'students' }}
            </p>
          </div>
          <p
            v-if="changeError"
            role="alert"
            class="rounded-sm border border-rose-200/80 bg-rose-50 px-[13px] py-[11px] text-xs leading-[19.5px] text-rose-700"
          >
            {{ changeError }}
          </p>
          <p v-else-if="notice" role="status" class="text-sm text-default">
            {{ notice }}
          </p>
          <p v-if="!data.students.length" class="text-sm text-muted">
            No students yet.
          </p>
          <div v-else class="overflow-hidden rounded-lg border border-default bg-default shadow-xs">
            <table class="w-full border-collapse text-left text-sm text-default">
              <caption class="sr-only">
                Every student
              </caption>
              <thead class="border-y border-default bg-muted text-xs text-muted">
                <tr>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Name
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    Student number
                  </th>
                  <th scope="col" class="hidden px-3 py-2 font-medium md:table-cell">
                    Email
                  </th>
                  <th scope="col" class="px-3 py-2 font-medium">
                    New number
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="student in data.students"
                  :key="student.id"
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
                  <td class="px-3 py-3 font-mono whitespace-nowrap">
                    {{ student.studentNumber }}
                  </td>
                  <td class="hidden px-3 py-3 [overflow-wrap:anywhere] md:table-cell">
                    {{ student.email }}
                  </td>
                  <td class="px-3 py-3">
                    <form
                      class="flex flex-wrap items-center gap-2"
                      @submit.prevent="changeNumber(student.id)"
                    >
                      <UInput
                        v-model="drafts[student.id]"
                        type="text"
                        autocomplete="off"
                        color="neutral"
                        fixed
                        :aria-label="`New student number for ${student.displayName}`"
                        class="min-w-0 flex-1"
                        :ui="{ base: inputClass }"
                      />
                      <UButton
                        type="submit"
                        size="lg"
                        :loading="saving === student.id"
                        :disabled="saving !== null"
                        :aria-busy="saving === student.id"
                        :aria-label="`Change student number for ${student.displayName}`"
                        class="min-h-11 rounded-sm bg-accent text-on-accent px-4 py-2.5 text-sm font-medium shadow-xs hover:bg-accent-hover disabled:bg-accent md:min-h-0"
                      >
                        Change
                      </UButton>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-xs leading-4 text-muted">
            A student number is SWB followed by at least four digits and is unique across the system.
            A number that has been used before cannot be given out again.
          </p>
        </section>
      </template>
    </main>
  </div>
</template>
