<script setup lang="ts">
import ConversationPanel from '~/components/workspace/ConversationPanel.vue'
import KnowledgeMap from '~/components/workspace/KnowledgeMap.vue'
import WorkingArea from '~/components/workspace/WorkingArea.vue'
import type { RedrawState } from '#shared/turn'

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
    class="h-dvh overflow-auto bg-elevated"
  >
    <div class="grid h-full min-h-[40rem] min-w-[60rem] grid-cols-[14rem_minmax(0,1fr)_22rem]">
      <KnowledgeMap :topics="data.knowledgeMap" />
      <WorkingArea :area="data.workingArea" />
      <ConversationPanel :messages="data.conversation" />
    </div>
  </main>
</template>
