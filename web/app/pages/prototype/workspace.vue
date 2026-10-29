<script setup lang="ts">
// PROTOTYPE. Throwaway. Question: what should the workspace look like?
// Three variants of the workspace, switchable via ?variant=, on /prototype/workspace.

import VariantA from '~/components/prototype/VariantA.vue'
import VariantB from '~/components/prototype/VariantB.vue'
import VariantC from '~/components/prototype/VariantC.vue'
import { conversation, exercise } from '~/prototype/an-scenario'
import type { PrototypeState } from '~/prototype/state'

useHead({ title: 'Workspace prototype' })

const showSwitcher = import.meta.dev

const variants = [
  { key: 'A', name: 'IDE' },
  { key: 'B', name: 'Chat-first' },
  { key: 'C', name: 'Map canvas' },
] as const

type VariantKey = (typeof variants)[number]['key']

const route = useRoute()
const router = useRouter()

function variantFromQuery(value: unknown): VariantKey {
  const raw = Array.isArray(value) ? value[0] : value
  const key = typeof raw === 'string' ? raw.toUpperCase() : ''
  if (key === 'A' || key === 'B' || key === 'C') return key
  return 'A'
}

const variant = computed(() => variantFromQuery(route.query.variant))

const state = reactive<PrototypeState>({
  draft: exercise.draft,
  messages: conversation.map(message => ({ ...message })),
  composer: '',
  traceOpen: false,
  drawerOpen: true,
})

function cycle(direction: -1 | 1) {
  const index = variants.findIndex(item => item.key === variant.value)
  const next = variants[(index + direction + variants.length) % variants.length]
  if (!next) return
  router.replace({ query: { variant: next.key } })
}
</script>

<template>
  <VariantA
    v-if="variant === 'A'"
    :state="state"
  />
  <VariantB
    v-else-if="variant === 'B'"
    :state="state"
  />
  <VariantC
    v-else
    :state="state"
  />
  <PrototypeSwitcher
    v-if="showSwitcher"
    :variants="variants"
    :current="variant"
    @cycle="cycle"
  />
</template>
