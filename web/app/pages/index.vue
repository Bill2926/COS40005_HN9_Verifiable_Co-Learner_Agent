<script setup lang="ts">
import ConversationPanel from '~/components/workspace/ConversationPanel.vue'
import KnowledgeMap from '~/components/workspace/KnowledgeMap.vue'
import WorkingArea from '~/components/workspace/WorkingArea.vue'
import type { RedrawState, RunOutput, TurnEvent } from '#shared/turn'
import { sessionStudentId, studentIdFromAuth } from '#shared/student-id'
import { createDraftStore } from '~/drafts/store'

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

const workspace = ref<RedrawState | null>(data.value ?? null)
const studentId = ref('')
const selecting = ref(false)
const selectError = ref('')
const sending = ref(false)
const sendError = ref('')
const streamingTeacher = ref('')
const streamingDeskmate = ref('')
const liveDraft = ref<string | null>(null)
const latestRun = ref<RunOutput | null>(null)

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
    workspace.value = await $fetch<RedrawState>('/turn', {
      method: 'POST',
      body: { event: 'select_exercise', exerciseId },
    })
  }
  catch {
    selectError.value = 'That exercise could not be opened.'
  }
  finally {
    selecting.value = false
  }
}

async function sendMessage(text: string) {
  const current = workspace.value
  if (!current || sending.value || selecting.value) return
  sending.value = true
  sendError.value = ''
  streamingTeacher.value = ''
  streamingDeskmate.value = ''
  const storedDraft = studentId.value
    ? createDraftStore(localStorage, studentId.value).read(current.workingArea.exercise.id)
    : null
  try {
    const response = await fetch('/turn', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/x-ndjson',
      },
      body: JSON.stringify({
        event: 'message',
        text,
        draft: liveDraft.value ?? storedDraft,
        run: latestRun.value,
      }),
    })
    if (!response.ok || !response.body) {
      sendError.value = 'That message could not be sent.'
      return
    }

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
          workspace.value = turnEvent.state
          streamingTeacher.value = ''
          streamingDeskmate.value = ''
          sawState = true
        }
      }
    }
    if (!sawState) sendError.value = 'That message could not be sent.'
  }
  catch {
    streamingTeacher.value = ''
    streamingDeskmate.value = ''
    sendError.value = 'That message could not be sent.'
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
        :student-id="studentId"
        :selecting="selecting"
        :select-error="selectError"
        @select-exercise="selectExercise"
        @draft="liveDraft = $event"
        @run="latestRun = $event"
      />
      <ConversationPanel
        :messages="workspace.conversation"
        :sending="sending"
        :send-error="sendError"
        :streaming-teacher="streamingTeacher"
        :streaming-deskmate="streamingDeskmate"
        @send="sendMessage"
      />
    </div>
  </main>
</template>
