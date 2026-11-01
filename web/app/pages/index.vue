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

useHead({
  title: computed(() => data.value?.workingArea.topicName ?? 'Workspace'),
})
</script>

<template>
  <main
    v-if="error || !data"
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
      <KnowledgeMap :topics="data.knowledgeMap" />
      <WorkingArea :area="data.workingArea" />
      <ConversationPanel :messages="data.conversation" />
    </div>
  </main>
</template>
