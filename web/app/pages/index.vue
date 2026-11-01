<script setup lang="ts">
import ConversationPanel from '~/components/workspace/ConversationPanel.vue'
import KnowledgeMap from '~/components/workspace/KnowledgeMap.vue'
import WorkingArea from '~/components/workspace/WorkingArea.vue'
import type { RedrawState } from '#shared/turn'

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
const selecting = ref(false)
const selectError = ref('')

async function selectExercise(exerciseId: string) {
  const current = workspace.value
  if (!current || selecting.value) return
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
        :selecting="selecting"
        :select-error="selectError"
        @select-exercise="selectExercise"
      />
      <ConversationPanel :messages="workspace.conversation" />
    </div>
  </main>
</template>
