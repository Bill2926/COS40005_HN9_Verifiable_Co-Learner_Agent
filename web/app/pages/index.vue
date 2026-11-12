<script setup lang="ts">
import ConversationPanel from '~/components/workspace/ConversationPanel.vue'
import CourseRoadmap from '~/components/workspace/CourseRoadmap.vue'
import RoadmapCanvas from '~/components/workspace/RoadmapCanvas.vue'
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
const verifyShieldOn = ref(true)
const verifyShieldBusy = ref(false)
const verifyShieldError = ref('')

async function saveVerifyShield(enabled: boolean | null) {
  verifyShieldBusy.value = true
  verifyShieldError.value = ''
  try {
    const payload = await $fetch<{ verifyShieldOn: boolean }>('/api/admin', {
      method: 'POST',
      body: enabled === null ? {} : { event: 'verifyShield', enabled },
    })
    verifyShieldOn.value = payload.verifyShieldOn
  }
  catch (caught) {
    const status = (caught as { statusCode?: number }).statusCode
    // Only product owners may change or read the saved setting; others keep the turn-reported state.
    if (enabled !== null) {
      verifyShieldError.value = status === 403 || status === 401
        ? 'Only the product owner can change VerifyShield.'
        : 'Could not save the VerifyShield setting. Try again.'
    }
  }
  finally {
    verifyShieldBusy.value = false
  }
}
const workingMode = ref<'learn' | 'practice'>('learn')
const studentId = ref('')
const selecting = ref(false)
const selectError = ref('')
const pendingModuleId = ref('')
const pendingModuleName = ref('')
const moduleViews = new Map<string, RedrawState>()
const moduleLoads = new Map<string, Promise<RedrawState>>()
let selectGeneration = 0
const sending = ref(false)
const sendError = ref('')
const streamingTeacher = ref('')
const streamingDeskmate = ref('')
const liveDraft = ref<string | null>(null)
const latestRun = ref<RunOutput | null>(null)
const workingAreaExpanded = ref(true)
const floatingChrome = 'lg:overflow-hidden lg:rounded-2xl lg:bg-paper lg:shadow-[0_0_0_1px_var(--color-ink-200),0px_12px_36px_-6px_rgba(15,23,42,0.12),0px_4px_12px_-2px_rgba(15,23,42,0.04)]'
const phonePanels = [
  { id: 'roadmap', name: 'Roadmap' },
  { id: 'working', name: 'Working area' },
  { id: 'conversation', name: 'Conversation' },
] as const
const phonePanel = ref<(typeof phonePanels)[number]['id']>('working')
const conversationUnread = ref(false)
const isPhone = ref(false)

function conversationIsOpen() {
  return !isPhone.value || phonePanel.value === 'conversation'
}

function noteReply() {
  if (!conversationIsOpen()) conversationUnread.value = true
}

function choosePanel(panel: (typeof phonePanels)[number]['id']) {
  phonePanel.value = panel
  if (panel === 'conversation') conversationUnread.value = false
}

function openInLearn() {
  workingMode.value = 'learn'
  phonePanel.value = 'working'
}

function ideFrame(panel: 'working' | 'conversation') {
  const place = panel === 'working'
    ? 'md:col-start-1 md:row-start-2 lg:col-start-2 lg:row-start-1'
    : 'md:col-start-2 md:row-start-2 lg:col-start-3 lg:row-start-1'
  const display = phonePanel.value === panel ? 'flex' : 'max-md:hidden md:flex'
  return ['h-full min-h-0 min-w-0 flex-col overflow-hidden', place, display]
}

function roadmapFrame(panel: 'working' | 'conversation') {
  const shared = [
    'h-full min-h-0 min-w-0 flex-col overflow-hidden',
    floatingChrome,
    phonePanel.value === panel ? 'flex' : 'max-md:hidden md:flex',
  ]
  if (panel === 'working') {
    return [
      ...shared,
      'md:col-start-1 md:row-start-2',
      'lg:absolute lg:bottom-4 lg:left-4 lg:z-10 lg:w-[520px]',
      workingAreaExpanded.value ? 'lg:h-[28rem]' : 'lg:h-auto',
    ]
  }
  return [
    ...shared,
    'md:col-start-2 md:row-start-2',
    'lg:absolute lg:top-4 lg:right-4 lg:z-10 lg:h-[40rem] lg:max-h-[calc(100%-2rem)] lg:w-[360px]',
  ]
}

watch([streamingTeacher, streamingDeskmate], ([teacher, deskmate]) => {
  if (teacher || deskmate) noteReply()
})

watch(() => workspace.value?.conversation, (messages, previous) => {
  if (!messages || !previous || messages.length <= previous.length) return
  const added = messages.slice(previous.length)
  if (added.some(message => message.author === 'teacher' || message.author === 'deskmate')) noteReply()
})

let phoneMedia: MediaQueryList | undefined

function syncPhone() {
  isPhone.value = phoneMedia?.matches ?? false
}

onMounted(() => {
  void saveVerifyShield(null)
  phoneMedia = window.matchMedia('(width < 48rem)')
  syncPhone()
  phoneMedia.addEventListener('change', syncPhone)
  warmModules()
})

onBeforeUnmount(() => {
  phoneMedia?.removeEventListener('change', syncPhone)
})

function rememberModule(state: RedrawState) {
  moduleViews.set(state.workingArea.moduleId, state)
}

function withCurrentModule(state: RedrawState, moduleId: string): RedrawState {
  return {
    ...state,
    courseRoadmap: state.courseRoadmap.map(module => (
      module.current === (module.id === moduleId)
        ? module
        : { ...module, current: module.id === moduleId }
    )),
  }
}

function showWorkspace(state: RedrawState) {
  if (state.workingArea.mode === 'learn') workingMode.value = 'learn'
  if (state.trace) {
    latestTrace.value = state.trace
    verifyShieldOn.value = state.trace.verifyShieldOn
  }
  workspace.value = state
  rememberModule(state)
}

function prefetchModule(moduleId: string): Promise<RedrawState> | null {
  if (!import.meta.client || moduleViews.has(moduleId)) return null
  const existing = moduleLoads.get(moduleId)
  if (existing) return existing
  const current = workspace.value
  const chosen = current?.courseRoadmap.find(module => module.id === moduleId)
  if (!chosen || chosen.current || chosen.state === 'closed') return null
  const pending = $fetch<RedrawState>('/turn', {
    method: 'POST',
    body: { event: 'preview_module', moduleId },
  }).then((state) => {
    if (state.workingArea.moduleId === moduleId) moduleViews.set(moduleId, state)
    return state
  }).finally(() => {
    moduleLoads.delete(moduleId)
  })
  moduleLoads.set(moduleId, pending)
  return pending
}

function warmModules() {
  const current = workspace.value
  if (!current) return
  const next = current.courseRoadmap.find(module =>
    module.state !== 'closed'
    && !module.current
    && !moduleViews.has(module.id)
    && !moduleLoads.has(module.id),
  )
  if (!next) return
  prefetchModule(next.id)?.then(() => warmModules()).catch(() => {})
}

if (data.value) showWorkspace(data.value)

if (import.meta.server) {
  const event = useRequestEvent()
  studentId.value = (event && await sessionStudentId(event)) || ''
}
else {
  studentId.value = (await studentIdFromAuth(useNuxtApp().$supabase)) ?? ''
}

async function selectModule(moduleId: string) {
  const current = workspace.value
  if (!current || selecting.value || sending.value) return
  const chosen = current.courseRoadmap.find(module => module.id === moduleId)
  if (!chosen || chosen.current || chosen.state === 'closed') return

  const snapshot = current
  const modeBeforeSelect = workingMode.value
  const generation = ++selectGeneration
  rememberModule(snapshot)
  selecting.value = true
  selectError.value = ''
  const cached = moduleViews.get(moduleId)
  if (cached) {
    pendingModuleId.value = ''
    pendingModuleName.value = ''
    showWorkspace(withCurrentModule(cached, moduleId))
  }
  else {
    pendingModuleId.value = moduleId
    pendingModuleName.value = chosen.name
    workspace.value = withCurrentModule(snapshot, moduleId)
    moduleLoads.get(moduleId)?.then((state) => {
      if (generation !== selectGeneration || pendingModuleId.value !== moduleId) return
      if (state.workingArea.moduleId !== moduleId) return
      pendingModuleId.value = ''
      pendingModuleName.value = ''
      showWorkspace(withCurrentModule(state, moduleId))
    }).catch(() => {})
  }

  try {
    showWorkspace(await $fetch<RedrawState>('/turn', {
      method: 'POST',
      body: { event: 'select_module', moduleId },
    }))
  }
  catch {
    workingMode.value = modeBeforeSelect
    showWorkspace(snapshot)
    selectError.value = 'That module could not be opened.'
  }
  finally {
    selecting.value = false
    pendingModuleId.value = ''
    pendingModuleName.value = ''
  }
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
    if (value) buffer += decoder.decode(value, { stream: !done })
    if (done) buffer += decoder.decode()
    const lines = buffer.split('\n')
    buffer = done ? '' : (lines.pop() ?? '')
    const events: TurnEvent[] = []
    for (const line of lines) {
      if (line.trim().length === 0) continue
      events.push(JSON.parse(line) as TurnEvent)
    }
    if (await applyTurnEvents(events)) sawState = true
    if (done) break
  }
  return sawState
}

async function applyTurnEvents(events: TurnEvent[]): Promise<boolean> {
  const textCount = events.filter(event => event.type === 'text').length
  // A buffered reply arrives as one chunk. Reveal it a word at a time so the
  // student sees it being written. Live chunks already contain one piece.
  const buffered = textCount > 1 && events.some(event => event.type === 'state')
  let sawState = false
  for (const turnEvent of events) {
    if (turnEvent.type === 'text') {
      if (turnEvent.author === 'deskmate') streamingDeskmate.value += turnEvent.delta
      else streamingTeacher.value += turnEvent.delta
      if (buffered) await nextPaint()
    }
    if (turnEvent.type === 'state') {
      showWorkspace(turnEvent.state)
      streamingTeacher.value = ''
      streamingDeskmate.value = ''
      sawState = true
    }
  }
  return sawState
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
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
  title: computed(() => workspace.value?.workingArea.moduleName ?? 'Workspace'),
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
    class="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-elevated"
  >
    <header class="phone-safe-top flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-default bg-default px-6 md:grid md:h-12 md:grid-cols-[1fr_auto_1fr] md:gap-4">
      <p class="flex shrink-0 items-center gap-3 text-sm font-semibold tracking-tight text-highlighted">
        <img
          src="/swinburne-fpt-logo.webp"
          alt=""
          width="871"
          height="705"
          class="block h-8 w-auto shrink-0"
        >
        <span class="max-md:sr-only">Verifiable Co-Learner</span>
      </p>
      <nav
        class="flex items-center rounded-[6px] border border-ink-200/80 bg-ink-100 p-0.5"
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
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] px-2.5 py-1 text-xs leading-4 md:inline md:min-h-0 md:min-w-0"
            :class="layout === option.id ? 'bg-paper font-medium text-ink-900 shadow-[0px_1px_1px_rgba(0,0,0,0.05)]' : 'text-ink-500 hover:bg-paper/60 hover:text-ink-800'"
            :aria-current="layout === option.id ? 'page' : undefined"
            @click="navigate"
          >{{ option.name }}</a>
        </NuxtLink>
      </nav>
      <div class="flex shrink-0 items-center gap-2 md:gap-4 md:justify-self-end">
        <div class="flex items-center gap-2 border-r border-ink-200 pr-2 md:pr-[13px]">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-200 text-[11px] font-medium leading-4 text-ink-700"
            aria-hidden="true"
          >{{ initialsOf(workspace.displayName) }}</span>
          <span class="text-xs font-medium leading-4 text-ink-700 max-md:sr-only">{{ workspace.displayName }}</span>
          <span class="font-mono text-[10px] leading-4 tracking-[0.5px] text-ink-400 uppercase max-md:hidden">Student</span>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          class="min-h-11 min-w-11 px-2 text-xs font-medium text-ink-500 hover:bg-transparent hover:text-ink-900 md:min-h-0 md:min-w-0 md:px-0"
          @click="signOut"
        >
          Sign out
        </UButton>
      </div>
    </header>
    <div
      class="flex shrink-0 border-b border-ink-200 bg-paper md:hidden"
      role="tablist"
      aria-label="Panels"
    >
      <button
        v-for="panel in phonePanels"
        :key="panel.id"
        type="button"
        role="tab"
        class="relative min-h-11 min-w-0 flex-1 truncate border-b-2 px-1 text-sm"
        :class="phonePanel === panel.id ? 'border-brand-600 font-medium text-ink-900' : 'border-transparent font-normal text-ink-500'"
        :aria-selected="phonePanel === panel.id"
        @click="choosePanel(panel.id)"
      >
        {{ panel.name }}
        <span
          v-if="panel.id === 'conversation' && conversationUnread"
          class="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-600"
          role="img"
          aria-label="New reply"
        />
      </button>
    </div>
    <div
      class="min-h-0 min-w-0 flex-1"
      :class="layout === 'ide'
        ? 'grid grid-cols-1 grid-rows-[minmax(0,1fr)] md:grid-cols-2 md:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]'
        : 'relative grid grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden bg-ink-50 md:grid-cols-2 md:grid-rows-[minmax(17rem,45%)_minmax(0,1fr)] lg:block'"
    >
      <RoadmapCanvas
        v-if="layout === 'roadmap'"
        :class="phonePanel === 'roadmap' ? undefined : 'max-md:hidden'"
        :modules="workspace.courseRoadmap"
        :course="workspace.course"
        :student-id="studentId"
        :mastery-threshold="workspace.masteryThreshold"
        :pending-module-id="pendingModuleId"
        @select-module="selectModule"
        @prefetch-module="prefetchModule"
      />
      <CourseRoadmap
        v-else
        class="md:col-span-2 md:row-start-1 lg:col-span-1 lg:col-start-1 lg:row-start-1"
        :class="phonePanel === 'roadmap' ? 'max-md:flex' : 'max-md:hidden'"
        :modules="workspace.courseRoadmap"
        :mastery-threshold="workspace.masteryThreshold"
        :pending-module-id="pendingModuleId"
        @select-module="selectModule"
        @prefetch-module="prefetchModule"
      />
      <div :class="layout === 'ide' ? ideFrame('working') : roadmapFrame('working')">
        <WorkingArea
          :area="workspace.workingArea"
          :mode="workingMode"
          :student-id="studentId"
          :selecting="selecting"
          :select-error="selectError"
          :pending-module-name="pendingModuleName"
          :submitting="sending"
          :floating="layout === 'roadmap'"
          :expanded="workingAreaExpanded"
          @update:mode="workingMode = $event"
          @update:expanded="workingAreaExpanded = $event"
          @select-exercise="selectExercise"
          @draft="liveDraft = $event"
          @run="latestRun = $event"
          @submit="submitCode"
        />
      </div>
      <div :class="layout === 'ide' ? ideFrame('conversation') : roadmapFrame('conversation')">
        <ConversationPanel
          :messages="workspace.conversation"
          :display-name="workspace.displayName"
          :trace="latestTrace"
          :verify-shield-on="verifyShieldOn"
          :verify-shield-busy="verifyShieldBusy"
          :verify-shield-error="verifyShieldError"
          :sending="sending"
          :send-error="sendError"
          :streaming-teacher="streamingTeacher"
          :streaming-deskmate="streamingDeskmate"
          :loading="pendingModuleName.length > 0"
          :floating="layout === 'roadmap'"
          @send="sendMessage"
          @open-learn="openInLearn"
          @toggle-verify-shield="saveVerifyShield"
        />
      </div>
    </div>
  </main>
</template>
