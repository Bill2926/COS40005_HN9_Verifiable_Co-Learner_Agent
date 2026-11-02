<script setup lang="ts">
import ConversationPanel from '~/components/workspace/ConversationPanel.vue'
import KnowledgeMap from '~/components/workspace/KnowledgeMap.vue'
import WorkingArea from '~/components/workspace/WorkingArea.vue'
import type { PracticeTestResult, RedrawState, RunOutput, TurnEvent } from '#shared/turn'
import { sessionStudentId, studentIdFromAuth } from '#shared/student-id'
import { createDraftStore } from '~/drafts/store'

interface SubmissionPayload {
  code: string
  results: PracticeTestResult[]
}

definePageMeta({
  middleware: 'signed-in',
})

async function signOut() {
  await useNuxtApp().$supabase.auth.signOut()
  await navigateTo('/sign-in')
}

const { data, error } = await useFetch<RedrawState>('/turn', {
  method: 'POST',
  body: { event: 'open' },
})

const workspace = ref<RedrawState | null>(null)
const workingMode = ref<'learn' | 'practice'>('learn')
const studentId = ref('')
const selecting = ref(false)
const selectError = ref('')
const sending = ref(false)
const sendError = ref('')
const streamingTeacher = ref('')
const streamingDeskmate = ref('')
const liveDraft = ref<string | null>(null)
const latestRun = ref<RunOutput | null>(null)

function showWorkspace(state: RedrawState) {
  if (state.workingArea.mode === 'learn') workingMode.value = 'learn'
  workspace.value = state
}

if (data.value) showWorkspace(data.value)

if (import.meta.server) {
  const event = useRequestEvent()
  studentId.value = (event && await sessionStudentId(event)) || ''
}
else {
  studentId.value = (await studentIdFromAuth(useNuxtApp().$supabase)) ?? ''
}

async function selectExercise(exerciseId: string) {
  const current = workspace.value
  if (!current || selecting.value || sending.value) return
  if (current.workingArea.exercise.id === exerciseId) return

  selecting.value = true
  selectError.value = ''
  try {
    showWorkspace(await $fetch<RedrawState>('/turn', {
      method: 'POST',
      body: { event: 'select_exercise', exerciseId },
    }))
  }
  catch {
    selectError.value = 'That exercise could not be opened.'
  }
  finally {
    selecting.value = false
  }
}

async function readTurn(body: unknown): Promise<boolean> {
  const response = await fetch('/turn', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/x-ndjson',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok || !response.body) return false

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawState = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim().length === 0) continue
      const turnEvent = JSON.parse(line) as TurnEvent
      if (turnEvent.type === 'text') {
        if (turnEvent.author === 'deskmate') streamingDeskmate.value += turnEvent.delta
        else streamingTeacher.value += turnEvent.delta
      }
      if (turnEvent.type === 'state') {
        showWorkspace(turnEvent.state)
        streamingTeacher.value = ''
        streamingDeskmate.value = ''
        sawState = true
      }
    }
  }
  return sawState
}

async function sendMessage(text: string) {
  const current = workspace.value
  if (!current || sending.value || selecting.value) return
  const storedDraft = studentId.value
    ? createDraftStore(localStorage, studentId.value).read(current.workingArea.exercise.id)
    : null
  await streamAgentTurn({
    event: 'message',
    text,
    draft: liveDraft.value ?? storedDraft,
    run: latestRun.value,
  }, 'That message could not be sent.')
}

async function submitCode(submission: SubmissionPayload) {
  if (!workspace.value || sending.value || selecting.value) return
  await streamAgentTurn({
    event: 'submission',
    code: submission.code,
    results: submission.results,
  }, 'That submission could not be sent.')
}

async function streamAgentTurn(body: unknown, failure: string) {
  sending.value = true
  sendError.value = ''
  streamingTeacher.value = ''
  streamingDeskmate.value = ''
  try {
    const shown = await readTurn(body)
    if (!shown) sendError.value = failure
  }
  catch {
    streamingTeacher.value = ''
    streamingDeskmate.value = ''
    sendError.value = failure
  }
  finally {
    sending.value = false
  }
}

useHead({
  title: computed(() => workspace.value?.workingArea.topicName ?? 'Workspace'),
})
</script>

<template>
  <main
    v-if="error || !workspace"
    class="grid h-dvh place-items-center bg-default px-6"
  >
    <p class="text-sm">
      The workspace could not be opened.
    </p>
  </main>
  <main
    v-else
    data-layout="ide"
    class="flex h-dvh min-w-[60rem] flex-col overflow-auto bg-elevated"
  >
    <header class="flex shrink-0 justify-end bg-default px-3 py-2">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        @click="signOut"
      >
        Sign out
      </UButton>
    </header>
    <div class="grid min-h-[40rem] flex-1 grid-cols-[14rem_minmax(0,1fr)_22rem]">
      <KnowledgeMap :topics="workspace.knowledgeMap" />
      <WorkingArea
        :area="workspace.workingArea"
        :mode="workingMode"
        :student-id="studentId"
        :selecting="selecting"
        :select-error="selectError"
        :submitting="sending"
        @update:mode="workingMode = $event"
        @select-exercise="selectExercise"
        @draft="liveDraft = $event"
        @run="latestRun = $event"
        @submit="submitCode"
      />
      <ConversationPanel
        :messages="workspace.conversation"
        :sending="sending"
        :send-error="sendError"
        :streaming-teacher="streamingTeacher"
        :streaming-deskmate="streamingDeskmate"
        @send="sendMessage"
        @open-learn="workingMode = 'learn'"
      />
    </div>
  </main>
</template>
