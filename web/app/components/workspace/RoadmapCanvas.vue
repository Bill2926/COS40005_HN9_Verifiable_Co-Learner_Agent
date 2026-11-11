<script setup lang="ts">
import type { RoadmapModule } from '#shared/turn'
import { arrangementScale, avoid, connectors, createArrangementStore, defaultArrangement, fittedModuleWidth, mergeArrangement, placeCard, pointAt, sizeClassOf, type Arrangement, type Box, type Connector, type Point, type Size, type SizeClass } from '~/roadmap/arrangement'

const props = defineProps<{
  modules: RoadmapModule[]
  course: string
  studentId: string
}>()

const clickSlop = 4
const nudgeStep = 16
const nudgeLeap = 48

const canvasEl = ref<HTMLElement | null>(null)
const labelEl = ref<HTMLElement | null>(null)
const footerEl = ref<HTMLElement | null>(null)
const canvasSize = ref<Size | null>(null)
const cardSizes = ref<Record<string, Size>>({})
const obstacles = ref<Box[]>([])
const savedArrangement = ref<Arrangement>({})
const dragPoint = ref<{ id: string, point: Point } | null>(null)
const selectedId = ref<string | null>(null)
const cardEls = new Map<string, HTMLElement>()
let observer: ResizeObserver | undefined
let loadedClass: SizeClass | null = null
let loadedStudent = ''

interface Gesture {
  id: string
  pointerId: number
  handle: HTMLElement
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  dragged: boolean
}

let gesture: Gesture | null = null
let swallowClick = false

const stroke = {
  mastered: '#94a3b8',
  current: '#6366f1',
  closed: '#94a3b8',
} as const

const arrangement = computed(() => {
  const canvas = canvasSize.value
  if (!canvas) return null
  const points = mergeArrangement(
    defaultArrangement(props.modules.map(module => module.id), canvas),
    savedArrangement.value,
  )
  const dragging = dragPoint.value
  if (dragging && dragging.id in points) points[dragging.id] = dragging.point
  return points
})

const boxes = computed(() => {
  const placedBoxes: Record<string, Box> = {}
  const canvas = canvasSize.value
  const points = arrangement.value
  if (!canvas || !points) return placedBoxes
  for (const module of props.modules) {
    const size = cardSizes.value[module.id]
    const point = points[module.id]
    if (!size || !point) continue
    placedBoxes[module.id] = avoid(placeCard(point, size, canvas), obstacles.value, canvas)
  }
  return placedBoxes
})

const lines = computed(() => connectors(props.modules, boxes.value))
const placed = computed(() => props.modules.every(module => boxes.value[module.id]))
const cardScale = computed(() => {
  const canvas = canvasSize.value
  if (!canvas) return 1
  return arrangementScale(canvas, props.modules.length)
})

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

function obstacleElements(): HTMLElement[] {
  const scope = canvasEl.value?.parentElement
  const panels: HTMLElement[] = []
  if (scope) {
    for (const name of ['Working area', 'Conversation']) {
      const element = scope.querySelector(`[aria-label="${name}"]`)
      if (element instanceof HTMLElement) panels.push(element)
    }
  }
  if (labelEl.value) panels.push(labelEl.value)
  if (footerEl.value) panels.push(footerEl.value)
  return panels
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
  const blocks: Box[] = []
  for (const element of obstacleElements()) {
    observer?.observe(element)
    const box = element.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    blocks.push({
      x: box.left - rect.left,
      y: box.top - rect.top,
      width: box.width,
      height: box.height,
    })
  }
  const nextCanvas = { width: rect.width, height: rect.height }
  syncSaved(nextCanvas)
  canvasSize.value = nextCanvas
  cardSizes.value = sizes
  obstacles.value = blocks
}

// Hidden until measured, so a card never appears at the origin and then jumps.
function placement(id: string) {
  const box = boxes.value[id]
  const size = cardSizes.value[id]
  if (!box || !size) return { visibility: 'hidden' as const }
  const scale = cardScale.value
  const canvas = canvasSize.value
  const fitted = canvas ? fittedModuleWidth(canvas, props.modules.length) : size.width
  const zoomed = scale < 0.999
  const settled = !zoomed || size.width <= fitted + 8
  // zoom scales the translate too, so the stored offset is in unzoomed pixels.
  const left = zoomed ? box.x / scale : box.x
  const top = zoomed ? box.y / scale : box.y
  return {
    visibility: settled ? 'visible' as const : 'hidden' as const,
    ...(zoomed ? { zoom: scale } : {}),
    transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)`,
  }
}

function cardClass(module: RoadmapModule): string {
  const selected = selectedId.value === module.id ? ' outline outline-2 outline-offset-2 outline-[#0f172a]' : ''
  const face = module.current
    ? 'w-[248px] border-[1.5px] border-[#4f46e5] bg-white shadow-[0px_0px_0px_4px_rgba(99,102,241,0.12),0px_8px_24px_-6px_rgba(99,102,241,0.18)]'
    : module.state === 'closed'
      ? 'w-[220px] border border-[#e2e8f0] bg-white/95 shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.04)]'
      : 'w-[208px] border border-[rgba(226,232,240,0.9)] bg-white shadow-[0px_4px_16px_-4px_rgba(15,23,42,0.06)]'
  return `${face}${selected}`
}

function announcement(module: RoadmapModule): string {
  const state = module.state === 'mastered' ? 'mastered' : module.state === 'closed' ? 'closed' : 'open'
  const current = module.current ? 'current, ' : ''
  return `${module.name}, ${current}${state}. Drag to move.`
}

function highlighted(line: Connector): boolean {
  const selected = selectedId.value
  return selected !== null && (line.from === selected || line.to === selected)
}

function dragging(id: string): boolean {
  return dragPoint.value?.id === id
}

function onPointerDown(event: PointerEvent, id: string) {
  if (event.button !== 0 || gesture) return
  const element = canvasEl.value
  const box = boxes.value[id]
  const size = cardSizes.value[id]
  if (!element || !box || !size) return
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) return
  swallowClick = false
  const rect = element.getBoundingClientRect()
  try {
    handle.setPointerCapture(event.pointerId)
  }
  catch {
    // The pointer can already be gone. Window listeners still follow it.
  }
  gesture = {
    id,
    pointerId: event.pointerId,
    handle,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left - box.x,
    offsetY: event.clientY - rect.top - box.y,
    dragged: false,
  }
  trackPointer()
}

function onPointerMove(event: PointerEvent) {
  const active = gesture
  if (!active || event.pointerId !== active.pointerId) return
  if (!active.dragged && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < clickSlop) return
  active.dragged = true
  moveToPointer(active, event.clientX, event.clientY)
}

function onPointerUp(event: PointerEvent) {
  finishGesture(event, true)
}

function onPointerCancel(event: PointerEvent) {
  finishGesture(event, false)
}

function onLostPointerCapture(event: PointerEvent) {
  const active = gesture
  if (!active || event.pointerId !== active.pointerId) return
  if (active.dragged) commitDrag(active.id)
  swallowClick = active.dragged
  gesture = null
  stopTracking()
}

function finishGesture(event: PointerEvent, useEventPoint: boolean) {
  const active = gesture
  if (!active || event.pointerId !== active.pointerId) return
  if (active.dragged && useEventPoint) moveToPointer(active, event.clientX, event.clientY)
  if (active.dragged) commitDrag(active.id)
  swallowClick = active.dragged
  gesture = null
  stopTracking()
  try {
    if (active.handle.hasPointerCapture(event.pointerId)) active.handle.releasePointerCapture(event.pointerId)
  }
  catch {
    // Already released.
  }
}

function onClick(id: string) {
  if (swallowClick) {
    swallowClick = false
    return
  }
  selectedId.value = id
}

function onKeyDown(event: KeyboardEvent, id: string) {
  if (event.key === 'Escape') {
    selectedId.value = null
    return
  }
  const step = event.shiftKey ? nudgeLeap : nudgeStep
  const vectors: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  const vector = vectors[event.key]
  if (!vector) return
  event.preventDefault()
  nudge(id, vector[0], vector[1])
}

function moveToPointer(active: Gesture, clientX: number, clientY: number) {
  const element = canvasEl.value
  const limits = canvasSize.value
  const size = cardSizes.value[active.id]
  if (!element || !limits || !size) return
  const rect = element.getBoundingClientRect()
  dragPoint.value = {
    id: active.id,
    point: pointAt(clientX - rect.left - active.offsetX, clientY - rect.top - active.offsetY, size, limits),
  }
}

function commitDrag(id: string) {
  const limits = canvasSize.value
  const size = cardSizes.value[id]
  const box = boxes.value[id]
  dragPoint.value = null
  if (!limits || !size || !box) return
  saveModule(id, pointAt(box.x, box.y, size, limits))
}

function nudge(id: string, dx: number, dy: number) {
  const limits = canvasSize.value
  const size = cardSizes.value[id]
  const box = boxes.value[id]
  if (!limits || !size || !box) return
  const shifted: Box = {
    x: clamp(box.x + dx, 0, Math.max(0, limits.width - size.width)),
    y: clamp(box.y + dy, 0, Math.max(0, limits.height - size.height)),
    width: size.width,
    height: size.height,
  }
  const cleared = avoid(shifted, obstacles.value, limits)
  saveModule(id, pointAt(cleared.x, cleared.y, size, limits))
}

function saveModule(id: string, point: Point) {
  const next = { ...savedArrangement.value, [id]: point }
  savedArrangement.value = next
  const canvas = canvasSize.value
  if (!canvas || !import.meta.client || props.studentId.length === 0) return
  const sizeClass = sizeClassOf(canvas)
  createArrangementStore(localStorage, props.studentId, sizeClass).write(next)
  loadedClass = sizeClass
  loadedStudent = props.studentId
}

function resetArrangement() {
  cancelGesture()
  const canvas = canvasSize.value
  if (canvas && import.meta.client && props.studentId.length > 0) {
    const sizeClass = sizeClassOf(canvas)
    createArrangementStore(localStorage, props.studentId, sizeClass).clear()
    loadedClass = sizeClass
    loadedStudent = props.studentId
  }
  savedArrangement.value = {}
}

function syncSaved(canvas: Size) {
  if (!import.meta.client) return
  const sizeClass = sizeClassOf(canvas)
  if (sizeClass === loadedClass && props.studentId === loadedStudent) return
  if (loadedClass !== null) cancelGesture()
  loadedClass = sizeClass
  loadedStudent = props.studentId
  savedArrangement.value = props.studentId.length === 0
    ? {}
    : createArrangementStore(localStorage, props.studentId, sizeClass).read()
}

function cancelGesture() {
  const active = gesture
  gesture = null
  dragPoint.value = null
  swallowClick = false
  stopTracking()
  if (!active) return
  try {
    if (active.handle.hasPointerCapture(active.pointerId)) active.handle.releasePointerCapture(active.pointerId)
  }
  catch {
    // Already released.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function trackPointer() {
  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', onPointerUp, true)
  window.addEventListener('pointercancel', onPointerCancel, true)
}

function stopTracking() {
  window.removeEventListener('pointermove', onPointerMove, true)
  window.removeEventListener('pointerup', onPointerUp, true)
  window.removeEventListener('pointercancel', onPointerCancel, true)
}

watch(() => props.studentId, () => {
  const canvas = canvasSize.value
  if (canvas) syncSaved(canvas)
})

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  if (canvasEl.value) observer.observe(canvasEl.value)
  for (const element of cardEls.values()) observer.observe(element)
  measure()
  requestAnimationFrame(measure)
})

onUnmounted(() => {
  observer?.disconnect()
  stopTracking()
})
</script>

<template>
  <div
    ref="canvasEl"
    class="relative z-0 row-start-1 h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#f8fafc] md:col-span-2 lg:absolute lg:inset-0 lg:h-auto"
  >
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 22px 22px;"
    />

    <div
      ref="labelEl"
      class="absolute top-[18px] right-4 left-4 z-[2] flex flex-wrap items-center gap-x-6 gap-y-1 lg:right-auto lg:left-6"
    >
      <h2 class="flex items-center gap-2 text-sm leading-[21px] font-medium tracking-[-0.35px] whitespace-nowrap text-[#475569]">
        <span
          class="size-2.5 shrink-0 rounded-full bg-[#4f46e5]"
          aria-hidden="true"
        />
        Course roadmap
      </h2>
      <p class="text-xs leading-[18px] text-[#64748b] max-lg:min-w-0 lg:whitespace-nowrap">
        {{ course }}
      </p>
    </div>

    <svg
      v-if="placed"
      class="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      role="img"
      aria-label="Module connectors"
    >
      <path
        v-for="line in lines"
        :key="`${line.from}-${line.to}`"
        :d="line.path"
        fill="none"
        :stroke="highlighted(line) ? '#0f172a' : stroke[line.kind]"
        :stroke-dasharray="line.kind === 'closed' ? '6 6' : undefined"
        stroke-linecap="round"
        :stroke-width="highlighted(line) ? 2.5 : 1.5"
      />
    </svg>

    <ul
      class="absolute inset-0"
      aria-label="Modules"
    >
      <li
        v-for="(module, index) in modules"
        :key="module.id"
        :ref="(element) => bindCard(module.id, element)"
        class="absolute top-0 left-0 rounded-[12px]"
        :class="[cardClass(module), dragging(module.id) ? 'z-[3]' : 'z-[1]']"
        :style="placement(module.id)"
        :aria-current="module.current ? 'true' : undefined"
      >
        <button
          type="button"
          class="block w-full cursor-grab rounded-[12px] px-[17px] py-[15px] text-left touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a] active:cursor-grabbing"
          :aria-pressed="selectedId === module.id"
          :aria-label="announcement(module)"
          @pointerdown="onPointerDown($event, module.id)"
          @lostpointercapture="onLostPointerCapture"
          @dragstart.prevent
          @click="onClick(module.id)"
          @keydown="onKeyDown($event, module.id)"
        >
          <template v-if="module.current">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span
                  class="size-2 shrink-0 rounded-full bg-[#4f46e5]"
                  aria-hidden="true"
                />
                <p class="text-[15px] leading-[15px] font-semibold text-[#0f172a]">
                  {{ module.name }}
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
                Module {{ index + 1 }} of {{ modules.length }}
              </p>
            </div>
          </template>

          <template v-else-if="module.state === 'mastered'">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm leading-[19.25px] font-medium text-[#1e293b]">
                {{ module.name }}
              </p>
              <p class="flex shrink-0 items-center gap-1 rounded-full border border-[rgba(167,243,208,0.7)] bg-[#ecfdf5] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-medium text-[#047857]">
                <img
                  src="/roadmap-canvas-tick.svg"
                  alt=""
                  width="12"
                  height="12"
                  draggable="false"
                >
                Mastered
              </p>
            </div>
            <p class="mt-2 text-xs leading-[15px] text-[#94a3b8]">
              {{ module.summary }}
            </p>
          </template>

          <template v-else-if="module.state === 'closed'">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm leading-[19.25px] font-medium text-[#475569]">
                {{ module.name }}
              </p>
              <p class="flex shrink-0 items-center gap-1 rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-medium text-[#64748b]">
                <img
                  src="/roadmap-canvas-lock.svg"
                  alt=""
                  width="12"
                  height="12"
                  draggable="false"
                >
                Closed
              </p>
            </div>
            <div class="mt-1 border-t border-[#f1f5f9] pt-[7px]">
              <p class="text-xs leading-[15px] text-[#94a3b8]">
                {{ module.closedReason }}
              </p>
            </div>
          </template>

          <template v-else>
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm leading-[19.25px] font-medium text-[#1e293b]">
                {{ module.name }}
              </p>
              <p class="shrink-0 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-[9px] py-[3px] text-[11px] leading-[16.5px] font-semibold text-[#4338ca]">
                Open
              </p>
            </div>
            <p class="mt-2 text-xs leading-[15px] text-[#94a3b8]">
              {{ module.summary }}
            </p>
          </template>
        </button>
      </li>
    </ul>

    <div
      ref="footerEl"
      class="absolute bottom-5 left-4 z-[2] flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 lg:left-auto lg:max-w-none lg:flex-nowrap lg:right-[400px]"
    >
      <button
        type="button"
        class="min-h-11 shrink-0 cursor-pointer rounded-lg border border-slate-200/80 bg-white/90 px-2.5 text-[11px] leading-[16.5px] font-medium whitespace-nowrap text-[#475569] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] backdrop-blur-[4px] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f172a] md:min-h-0 md:py-[5px]"
        @click="resetArrangement"
      >
        Reset arrangement
      </button>
      <p
        class="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-[11px] py-[5px] font-mono text-[11px] leading-[16.5px] whitespace-nowrap text-[#64748b] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] backdrop-blur-[4px]"
        aria-hidden="true"
      >
        <span>100%</span>
        <span class="text-[#cbd5e1]">|</span>
        <span>Studio canvas</span>
      </p>
    </div>
  </div>
</template>
