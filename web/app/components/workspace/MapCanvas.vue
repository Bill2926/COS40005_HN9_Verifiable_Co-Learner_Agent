<script setup lang="ts">
import type { MapTopic } from '#shared/turn'
import { connectors, defaultArrangement, placeCard, type Box, type Size } from '~/map/arrangement'

const props = defineProps<{
  topics: MapTopic[]
  course: string
}>()

const canvasEl = ref<HTMLElement | null>(null)
const canvasSize = ref<Size | null>(null)
const cardSizes = ref<Record<string, Size>>({})
const cardEls = new Map<string, HTMLElement>()
let observer: ResizeObserver | undefined

const stroke = {
  mastered: '#94a3b8',
  current: '#6366f1',
  closed: '#94a3b8',
} as const

const arrangement = computed(() => {
  if (!canvasSize.value) return null
  return defaultArrangement(props.topics.map(topic => topic.id), canvasSize.value)
})

const boxes = computed(() => {
  const placed: Record<string, Box> = {}
  const canvas = canvasSize.value
  const points = arrangement.value
  if (!canvas || !points) return placed
  for (const topic of props.topics) {
    const size = cardSizes.value[topic.id]
    const point = points[topic.id]
    if (!size || !point) continue
    placed[topic.id] = placeCard(point, size, canvas)
  }
  return placed
})

const lines = computed(() => connectors(props.topics, boxes.value))
const placed = computed(() => props.topics.every(topic => boxes.value[topic.id]))

function bindCard(id: string, element: unknown) {
  if (element instanceof HTMLElement) {
    cardEls.set(id, element)
    observer?.observe(element)
    return
  }
  const previous = cardEls.get(id)
  if (previous) observer?.unobserve(previous)
  cardEls.delete(id)
}

function measure() {
  const canvas = canvasEl.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const sizes: Record<string, Size> = {}
  for (const [id, element] of cardEls) {
    const box = element.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    sizes[id] = { width: box.width, height: box.height }
  }
  canvasSize.value = { width: rect.width, height: rect.height }
  cardSizes.value = sizes
}

// Hidden until measured, so a card never appears at the origin and then jumps.
function placement(id: string) {
  const box = boxes.value[id]
  if (!box) return { visibility: 'hidden' as const }
  return {
    visibility: 'visible' as const,
    transform: `translate(${Math.round(box.x)}px, ${Math.round(box.y)}px)`,
  }
}

function cardClass(topic: MapTopic): string {
  if (topic.current) {
    return 'w-[248px] border-[1.5px] border-[#4f46e5] bg-white shadow-[0px_0px_0px_4px_rgba(99,102,241,0.12),0px_8px_24px_-6px_rgba(99,102,241,0.18)]'
  }
  if (topic.state === 'closed') {
    return 'w-[220px] border border-[#e2e8f0] bg-white/95 shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.04)]'
  }
  return 'w-[208px] border border-[rgba(226,232,240,0.9)] bg-white shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.06)]'
}

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  if (canvasEl.value) observer.observe(canvasEl.value)
  for (const element of cardEls.values()) observer.observe(element)
  measure()
  requestAnimationFrame(measure)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div
    ref="canvasEl"
    class="absolute inset-0 z-0 overflow-hidden bg-[#f8fafc]"
  >
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 22px 22px;"
    />

    <div class="absolute top-[18px] left-6 z-[2] flex items-center gap-6">
      <h2 class="flex items-center gap-2 text-sm leading-[21px] font-medium tracking-[-0.35px] whitespace-nowrap text-[#475569]">
        <span
          class="size-2.5 shrink-0 rounded-full bg-[#4f46e5]"
          aria-hidden="true"
        />
        Knowledge map
      </h2>
      <p class="text-xs leading-[18px] whitespace-nowrap text-[#64748b]">
        {{ course }}
      </p>
    </div>

    <svg
      v-if="placed"
      class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label="Topic connectors"
    >
      <path
        v-for="line in lines"
        :key="`${line.from}-${line.to}`"
        :d="line.path"
        fill="none"
        :stroke="stroke[line.kind]"
        :stroke-dasharray="line.kind === 'closed' ? '6 6' : undefined"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>

    <ul
      class="absolute inset-0"
      aria-label="Topics"
    >
      <li
        v-for="(topic, index) in topics"
        :key="topic.id"
        :ref="(element) => bindCard(topic.id, element)"
        class="absolute top-0 left-0 z-[1] rounded-[12px] px-[17px] py-[15px]"
        :class="cardClass(topic)"
        :style="placement(topic.id)"
        :aria-current="topic.current ? 'true' : undefined"
      >
        <template v-if="topic.current">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span
                class="size-2 shrink-0 rounded-full bg-[#4f46e5]"
                aria-hidden="true"
              />
              <p class="text-[15px] leading-[15px] font-semibold text-[#0f172a]">
                {{ topic.name }}
              </p>
            </div>
            <p class="shrink-0 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-semibold text-[#4338ca]">
              Current
            </p>
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <p class="flex items-center gap-1.5 text-xs leading-[18px] font-semibold tracking-[0.3px] text-[#4f46e5]">
              <span
                class="size-1.5 shrink-0 rounded-full bg-[#6366f1]"
                aria-hidden="true"
              />
              Open
            </p>
            <p class="text-[11px] leading-[16.5px] font-medium text-[#94a3b8]">
              Topic {{ index + 1 }} of {{ topics.length }}
            </p>
          </div>
        </template>

        <template v-else-if="topic.state === 'mastered'">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm leading-[19.25px] font-medium text-[#1e293b]">
              {{ topic.name }}
            </p>
            <p class="flex shrink-0 items-center gap-1 rounded-full border border-[rgba(167,243,208,0.7)] bg-[#ecfdf5] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-medium text-[#047857]">
              <img
                src="/map-canvas-tick.svg"
                alt=""
                width="12"
                height="12"
              >
              Mastered
            </p>
          </div>
          <p class="mt-2 text-xs leading-[15px] text-[#94a3b8]">
            {{ topic.summary }}
          </p>
        </template>

        <template v-else-if="topic.state === 'closed'">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm leading-[19.25px] font-medium text-[#475569]">
              {{ topic.name }}
            </p>
            <p class="flex shrink-0 items-center gap-1 rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-medium text-[#64748b]">
              <img
                src="/map-canvas-lock.svg"
                alt=""
                width="12"
                height="12"
              >
              Closed
            </p>
          </div>
          <div class="mt-1 border-t border-[#f1f5f9] pt-[7px]">
            <p class="text-xs leading-[15px] text-[#94a3b8]">
              {{ topic.closedReason }}
            </p>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm leading-[19.25px] font-medium text-[#1e293b]">
              {{ topic.name }}
            </p>
            <p class="shrink-0 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-semibold text-[#4338ca]">
              Open
            </p>
          </div>
          <p class="mt-2 text-xs leading-[15px] text-[#94a3b8]">
            {{ topic.summary }}
          </p>
        </template>
      </li>
    </ul>

    <p
      class="absolute right-[400px] bottom-5 z-[2] flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-[11px] py-[5px] font-mono text-[11px] leading-[16.5px] text-[#64748b] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] backdrop-blur-[4px]"
      aria-hidden="true"
    >
      <span>100%</span>
      <span class="text-[#cbd5e1]">|</span>
      <span>Studio canvas</span>
    </p>
  </div>
</template>
