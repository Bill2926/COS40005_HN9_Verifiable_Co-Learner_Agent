<script setup lang="ts">
import ConversationPanel from '~/components/workspace/ConversationPanel.vue'
import KnowledgeMap from '~/components/workspace/KnowledgeMap.vue'
import MapCanvas from '~/components/workspace/MapCanvas.vue'
import WorkingArea from '~/components/workspace/WorkingArea.vue'
import type { PracticeTestResult, RedrawState, RunOutput, TurnEvent, TurnTrace } from '#shared/turn'
import { sessionStudentId, studentIdFromAuth } from '#shared/student-id'
import { createDraftStore } from '~/drafts/store'
import { resolveWorkspaceLayout, workspaceLayoutCookie, workspaceLayoutCookieOptions, workspaceLayoutFrom, workspaceLayouts, type WorkspaceLayoutId } from '~/workspace/layout'

interface SubmissionPayload {
  code: string
  results: PracticeTestResult[]
}

definePageMeta({
  middleware: ['signed-in', 'workspace-layout'],
})

async function signOut() {
  await useNuxtApp().$supabase.auth.signOut()
  await navigateTo('/sign-in')
}

const route = useRoute()
const rememberedLayout = useCookie<string | null>(workspaceLayoutCookie, workspaceLayoutCookieOptions)
const layout = computed(() => resolveWorkspaceLayout(route.query.layout, rememberedLayout.value))

function layoutTarget(id: WorkspaceLayoutId) {
  return { path: '/', query: { ...route.query, layout: id } }
}

watchEffect(() => {
  const requested = workspaceLayoutFrom(route.query.layout)
  if (requested) rememberedLayout.value = requested
})

const { data, error } = await useFetch<RedrawState>('/turn', {
  method: 'POST',
  body: { event: 'open' },
})

const workspace = ref<RedrawState | null>(null)
const latestTrace = ref<TurnTrace | null>(null)
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
const workingAreaExpanded = ref(true)
const floatingPanel = 'overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_#e2e8f0,0px_12px_36px_-6px_rgba(15,23,42,0.12),0px_4px_12px_-2px_rgba(15,23,42,0.04)]'

function showWorkspace(state: RedrawState) {
  if (state.workingArea.mode === 'learn') workingMode.value = 'learn'
  if (state.trace) latestTrace.value = state.trace
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

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(word => word.length > 0)
  const first = words[0]
  if (!first) return ''
  if (words.length === 1) return Array.from(first).slice(0, 2).join('')
  return words.slice(0, 2).map(word => Array.from(word)[0] ?? '').join('')
}
</script>

<template>
  <main
    v-if="error || !workspace"
    class="phone-safe grid min-h-dvh place-items-center bg-default px-6 text-center"
  >
    <p class="max-w-sm text-sm text-balance">
      The workspace could not be opened.
    </p>
  </main>
  <main
    v-else
    :data-layout="layout"
    class="flex h-dvh flex-col bg-elevated"
    :class="layout === 'ide' ? 'min-w-[60rem] overflow-auto' : 'overflow-hidden'"
  >
    <header class="flex h-12 shrink-0 items-center justify-between border-b border-default bg-default px-6">
      <p class="flex items-center gap-3 text-sm font-semibold tracking-tight text-highlighted">
        <span
          class="size-2.5 shrink-0 rounded-sm bg-primary-600"
          aria-hidden="true"
        />
        Verifiable Co-Learner
      </p>
      <nav
        class="flex items-center rounded-[6px] border border-slate-200/80 bg-slate-100 p-0.5"
        aria-label="Workspace layout"
      >
        <NuxtLink
          v-for="option in workspaceLayouts"
          :key="option.id"
          v-slot="{ href, navigate }"
          custom
          :to="layoutTarget(option.id)"
        >
          <a
            :href="href ?? undefined"
            class="rounded-[4px] px-2.5 py-1 text-xs leading-4"
            :class="layout === option.id ? 'bg-white font-medium text-slate-900 shadow-[0px_1px_1px_rgba(0,0,0,0.05)]' : 'text-slate-500'"
            :aria-current="layout === option.id ? 'page' : undefined"
            @click="navigate"
          >{{ option.name }}</a>
        </NuxtLink>
      </nav>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 border-r border-slate-200 pr-[13px]">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-medium leading-4 text-slate-700"
            aria-hidden="true"
          >{{ initialsOf(workspace.displayName) }}</span>
          <span class="text-xs font-medium leading-4 text-slate-700">{{ workspace.displayName }}</span>
          <span class="font-mono text-[10px] leading-4 tracking-[0.5px] text-slate-400 uppercase">Student</span>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          class="px-0 text-xs font-medium text-slate-500"
          @click="signOut"
        >
          Sign out
        </UButton>
      </div>
    </header>
    <div
      class="min-h-0 flex-1"
      :class="layout === 'ide'
        ? 'grid grid-cols-[220px_minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)]'
        : 'relative overflow-hidden bg-[#f8fafc]'"
    >
      <MapCanvas
        v-if="layout === 'map'"
        :topics="workspace.knowledgeMap"
        :course="workspace.course"
        :student-id="studentId"
      />
      <KnowledgeMap
        v-else
        :topics="workspace.knowledgeMap"
      />
      <div
        :class="layout === 'ide'
          ? 'contents'
          : ['absolute bottom-4 left-4 z-10 w-[520px]', floatingPanel, workingAreaExpanded ? 'h-[28rem]' : 'h-auto']"
      >
        <WorkingArea
          :area="workspace.workingArea"
          :mode="workingMode"
          :student-id="studentId"
          :selecting="selecting"
          :select-error="selectError"
          :submitting="sending"
          :floating="layout === 'map'"
          :expanded="workingAreaExpanded"
          @update:mode="workingMode = $event"
          @update:expanded="workingAreaExpanded = $event"
          @select-exercise="selectExercise"
          @draft="liveDraft = $event"
          @run="latestRun = $event"
          @submit="submitCode"
        />
      </div>
      <div
        :class="layout === 'ide'
          ? 'contents'
          : ['absolute top-4 right-4 z-10 h-[40rem] max-h-[calc(100%-2rem)] w-[360px]', floatingPanel]"
      >
        <ConversationPanel
          :messages="workspace.conversation"
          :display-name="workspace.displayName"
          :trace="latestTrace"
          :sending="sending"
          :send-error="sendError"
          :streaming-teacher="streamingTeacher"
          :streaming-deskmate="streamingDeskmate"
          :floating="layout === 'map'"
          @send="sendMessage"
          @open-learn="workingMode = 'learn'"
        />
      </div>
    </div>
  </main>
</template>
