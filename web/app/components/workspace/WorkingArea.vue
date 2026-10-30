<script setup lang="ts">
import type { WorkingAreaView } from '#shared/turn'

defineProps<{
  area: WorkingAreaView
}>()
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col border-x border-default bg-default"
    aria-label="Working area"
  >
    <header class="shrink-0 border-b border-default px-5 py-4">
      <p class="text-sm text-muted">
        Working area
        <span aria-hidden="true"> · </span>
        <template v-if="area.mode === 'learn'">
          Learn
        </template>
      </p>
      <h1 class="mt-1 text-lg font-semibold">
        {{ area.topicName }}
      </h1>
      <p class="mt-1 text-sm leading-6">
        {{ area.materials.scopeNote }}
      </p>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <article>
        <h2 class="text-base font-medium">
          {{ area.materials.heading }}
        </h2>
        <p class="mt-2 text-sm leading-6">
          {{ area.materials.body }}
        </p>
        <h3 class="mt-4 text-sm font-medium">
          Example
        </h3>
        <pre class="mt-2 overflow-x-auto rounded-md bg-elevated px-3 py-2 font-mono text-sm leading-6"><code>{{ area.materials.example }}</code></pre>
      </article>
    </div>
  </section>
</template>
