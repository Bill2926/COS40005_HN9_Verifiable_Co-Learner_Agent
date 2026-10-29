<script setup lang="ts">
import { exercise, materials } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

defineProps<{
  state: PrototypeState
}>()
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-default">
    <header class="shrink-0 border-b border-default px-4 py-3">
      <h2 class="text-sm font-medium">
        Working area
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ materials.topicName }}
        <span aria-hidden="true"> · </span>
        {{ materials.scopeNote }}
      </p>
    </header>

    <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
      <article>
        <h3 class="text-base font-medium">
          {{ materials.heading }}
        </h3>
        <p class="mt-2 text-sm leading-6">
          {{ materials.body }}
        </p>
        <pre class="mt-3 overflow-x-auto rounded-md bg-elevated px-3 py-2 font-mono text-sm leading-6">{{ materials.example }}</pre>
      </article>

      <article class="border-t border-default pt-6">
        <h3 class="text-base font-medium">
          {{ exercise.title }}
        </h3>
        <p class="mt-2 text-sm leading-6">
          {{ exercise.statement }}
        </p>

        <label class="mt-4 block">
          <span class="text-sm font-medium">Draft</span>
          <textarea
            v-model="state.draft"
            class="mt-1 min-h-36 w-full resize-y rounded-md border border-default bg-default px-3 py-2 font-mono text-sm leading-6"
            spellcheck="false"
            autocomplete="off"
          />
        </label>

        <div class="mt-4">
          <h4 class="text-sm font-medium">
            Latest run
          </h4>
          <pre class="mt-1 overflow-x-auto rounded-md bg-elevated px-3 py-2 font-mono text-sm">{{ exercise.latestRun }}</pre>
        </div>

        <div class="mt-4 flex gap-2">
          <UButton label="Run" color="neutral" variant="outline" />
          <UButton label="Submit" />
        </div>
      </article>
    </div>
  </section>
</template>
