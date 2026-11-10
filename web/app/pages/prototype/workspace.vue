<script setup lang="ts">
// PROTOTYPE. Throwaway. Question: what should the workspace look like?
// Two layouts, IDE and Map canvas, switchable via ?variant=, on /prototype/workspace.

import VariantA from '~/components/prototype/VariantA.vue'
import VariantC from '~/components/prototype/VariantC.vue'
import { conversation, exercise } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

useHead({ title: 'Workspace prototype' })

const variants = [
  { key: 'A', name: 'IDE' },
  { key: 'C', name: 'Map canvas' },
] as const

type VariantKey = (typeof variants)[number]['key']

const route = useRoute()

function variantFromQuery(value: unknown): VariantKey {
  const raw = Array.isArray(value) ? value[0] : value
  const key = typeof raw === 'string' ? raw.toUpperCase() : ''
  const match = variants.find(item => item.key === key)
  return match?.key ?? 'A'
}

const variant = computed(() => variantFromQuery(route.query.variant))

const state = reactive<PrototypeState>({
  draft: exercise.draft,
  messages: conversation.map(message => ({ ...message })),
  composer: '',
  traceOpen: false,
})
</script>

<template>
  <VariantA
    v-if="variant === 'A'"
    :state="state"
  />
  <VariantC
    v-else
    :state="state"
  />
  <PrototypeSwitcher
    :variants="variants"
    :current="variant"
  />
</template>
