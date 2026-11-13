<script setup lang="ts">
import type { RoadmapModule } from '#shared/turn'
import { arrangementScale, avoid, connectors, createArrangementStore, defaultArrangement, fittedModuleWidth, fitView, mergeArrangement, placeCard, pointAt, sizeClassOf, spread, type Arrangement, type Box, type Connector, type Point, type Size, type SizeClass } from '~/roadmap/arrangement'

const props = defineProps<{
  modules: RoadmapModule[]
  course: string
  studentId: string
  masteryThreshold: number
  pendingModuleId?: string
}>()

const emit = defineEmits<{
  selectModule: [moduleId: string]
  prefetchModule: [moduleId: string]
}>()

function onHover(event: PointerEvent, module: RoadmapModule) {
  if (event.pointerType !== 'mouse' || module.state === 'closed') return
  emit('prefetchModule', module.id)
}

const clickSlop = 4
const nudgeStep = 16
const nudgeLeap = 48
const minZoom = 0.4
const maxZoom = 2
const zoomStep = 1.2

const canvasEl = ref<HTMLElement | null>(null)
const labelEl = ref<HTMLElement | null>(null)
const footerEl = ref<HTMLElement | null>(null)
const canvasSize = ref<Size | null>(null)
const cardSizes = ref<Record<string, Size>>({})
const obstacles = ref<Box[]>([])
const savedArrangement = ref<Arrangement>({})
const dragPoint = ref<{ id: string, point: Point } | null>(null)
const selectedId = ref<string | null>(null)
// The view: the arrangement lives in world pixels, the canvas shows it scaled then shifted.
const zoom = ref(1)
const pan = ref<Point>({ x: 0, y: 0 })
let panGesture: { pointerId: number, startX: number, startY: number, originX: number, originY: number } | null = null
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
  mastered: 'var(--color-roadmap-line)',
  current: 'var(--color-roadmap-line)',
  closed: 'var(--color-roadmap-line)',
} as const

const arrangement = computed(() => {
  const canvas = canvasSize.value
  if (!canvas) return null
  return mergeArrangement(
    defaultArrangement(props.modules.map(module => module.id), canvas),
    savedArrangement.value,
  )
})

// Where every card rests. A card still in its starting spot keeps clear of the
// floating panels, which line up with the board at the starting view. A card the
// Student has moved stays where they put it, anywhere on the unbounded board,
// and only steps off other cards. Panels sit on the screen, not the board, so
// once the board is zoomed or panned they can say nothing about a moved card.
const settledBoxes = computed(() => {
  const canvas = canvasSize.value
  const points = arrangement.value
  if (!canvas || !points) return {}
  const startingIds: string[] = []
  const starting: Box[] = []
  const movedIds: string[] = []
  const moved: Box[] = []
  for (const module of props.modules) {
    const size = cardSizes.value[module.id]
    const point = points[module.id]
    if (!size || !point) continue
    if (module.id in savedArrangement.value) {
      movedIds.push(module.id)
      moved.push(placeCard(point, size, canvas))
    }
    else {
      startingIds.push(module.id)
      starting.push(avoid(placeCard(point, size, canvas), obstacles.value, canvas))
    }
  }
  const settled = spread(spread(starting, canvas, 12, obstacles.value).concat(moved), canvas, 12, [], false)
  const placedBoxes: Record<string, Box> = {}
  ;[...startingIds, ...movedIds].forEach((id, index) => {
    const box = settled[index]
    if (box) placedBoxes[id] = box
  })
  return placedBoxes
})

// While a card is dragged it follows the pointer exactly and nothing else moves.
const boxes = computed(() => {
  const settled = settledBoxes.value
  const canvas = canvasSize.value
  const dragging = dragPoint.value
  const size = dragging ? cardSizes.value[dragging.id] : undefined
  if (!canvas || !dragging || !size || !(dragging.id in settled)) return settled
  return { ...settled, [dragging.id]: placeCard(dragging.point, size, canvas) }
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
    sizes[id] = { width: box.width / zoom.value, height: box.height / zoom.value }
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
  // Selection is drawn by the card's own border and halo, never a second frame
  // around it: an outline outside the current card's glow read as a box in a box.
  const selected = selectedId.value === module.id
  // A dragged card trades its resting shadow for a deeper one and stops easing.
  if (dragging(module.id)) {
    const width = module.current ? 'w-[232px]' : 'w-[208px]'
    const border = module.current ? 'border-brand-600' : selected ? 'border-brand-400' : 'border-ink-300'
    return `${width} border ${border} bg-paper shadow-[0_2px_4px_rgba(15,23,42,0.06),0_20px_40px_-12px_rgba(15,23,42,0.28)]`
  }
  const motion = ' transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0'
  if (module.current) {
    return `w-[232px] border border-brand-600 bg-paper shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-600)_10%,transparent),0_12px_28px_-10px_color-mix(in_oklab,var(--color-brand-600)_30%,transparent)]${motion}`
  }
  if (module.state === 'closed') {
    const face = selected
      ? 'border-solid border-ink-400 bg-paper shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ink-500)_12%,transparent)]'
      : 'border-dashed border-roadmap-line bg-ink-50'
    return `w-[208px] border ${face}${motion}`
  }
  const face = selected
    ? 'border-brand-400 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-brand-600)_12%,transparent),0_10px_24px_-10px_rgba(15,23,42,0.18)]'
    : 'border-ink-200 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_16px_-8px_rgba(15,23,42,0.10)] hover:border-ink-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_28px_-12px_rgba(15,23,42,0.18)]'
  return `w-[208px] border bg-paper ${face}${motion}`
}

function glyphClass(module: RoadmapModule): string {
  if (module.state === 'mastered') return 'bg-emerald-50 ring-1 ring-emerald-200'
  if (module.state === 'closed') return 'bg-ink-100 ring-1 ring-ink-200'
  if (module.current) return 'bg-brand-600 ring-4 ring-brand-100'
  return 'bg-paper ring-[1.5px] ring-brand-300'
}

function announcement(module: RoadmapModule): string {
  const state = module.state === 'mastered' ? 'mastered' : module.state === 'closed' ? 'closed' : 'open'
  const current = module.current ? 'current, ' : ''
  const mastery = module.state === 'closed' ? '' : `, ${masteryPercent(module)}% mastery`
  return `${module.name}, ${current}${state}${mastery}. Drag to move.`
}

const thresholdPercent = computed(() => Math.round(props.masteryThreshold * 100))

// A closed module shows no mastery, so only an unlocked one reaches the bar.
function masteryPercent(module: RoadmapModule): number {
  return module.state === 'closed' ? 0 : Math.round(module.mastery * 100)
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
    offsetX: toWorldX(event.clientX - rect.left) - box.x,
    offsetY: toWorldY(event.clientY - rect.top) - box.y,
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
  emit('selectModule', id)
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
    point: pointAt(toWorldX(clientX - rect.left) - active.offsetX, toWorldY(clientY - rect.top) - active.offsetY, size, limits),
  }
}

function commitDrag(id: string) {
  const limits = canvasSize.value
  const size = cardSizes.value[id]
  const box = boxes.value[id]
  dragPoint.value = null
  if (!limits || !size || !box) return
  saveModule(id, pointAt(...clearSpot(id, box), size, limits))
}

// A dropped card steps once to the nearest spot off every other card.
function clearSpot(id: string, box: Box): [number, number] {
  const others = Object.entries(settledBoxes.value)
    .filter(([other]) => other !== id)
    .map(([, other]) => other)
  const canvas = canvasSize.value
  if (!canvas) return [box.x, box.y]
  const cleared = spread([...others, box], canvas, 12, [], false).at(-1) ?? box
  return [cleared.x, cleared.y]
}

function nudge(id: string, dx: number, dy: number) {
  const limits = canvasSize.value
  const size = cardSizes.value[id]
  const box = boxes.value[id]
  if (!limits || !size || !box) return
  saveModule(id, pointAt(box.x + dx, box.y + dy, size, limits))
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
  resetView()
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

function toWorldX(x: number): number {
  return (x - pan.value.x) / zoom.value
}

function toWorldY(y: number): number {
  return (y - pan.value.y) / zoom.value
}

const zoomPercent = computed(() => Math.round(zoom.value * 100))
const worldStyle = computed(() => ({
  transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

// Zoom keeping the point (screen pixels inside the canvas) fixed under the cursor.
function zoomTo(next: number, anchorX?: number, anchorY?: number) {
  const canvas = canvasSize.value
  const target = clamp(next, minZoom, maxZoom)
  const current = zoom.value
  if (target === current) return
  const ax = anchorX ?? (canvas ? canvas.width / 2 : 0)
  const ay = anchorY ?? (canvas ? canvas.height / 2 : 0)
  const ratio = target / current
  pan.value = { x: ax - (ax - pan.value.x) * ratio, y: ay - (ay - pan.value.y) * ratio }
  zoom.value = target
}

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

// Brings every card into view, wherever it was dragged, clear of the floating panels.
function fitAll() {
  const canvas = canvasSize.value
  if (!canvas) return
  const view = fitView(Object.values(settledBoxes.value), canvas, obstacles.value, { min: minZoom, max: 1 })
  zoom.value = view.zoom
  pan.value = view.pan
}

function onWheel(event: WheelEvent) {
  const element = canvasEl.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  if (event.ctrlKey || event.metaKey) {
    zoomTo(zoom.value * Math.exp(-event.deltaY * 0.002), event.clientX - rect.left, event.clientY - rect.top)
    return
  }
  pan.value = { x: pan.value.x - event.deltaX, y: pan.value.y - event.deltaY }
}

function onCanvasKeyDown(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement && event.target.closest('li')) return
  if (event.key === '+' || event.key === '=') zoomTo(zoom.value * zoomStep)
  else if (event.key === '-') zoomTo(zoom.value / zoomStep)
  else if (event.key === '0') fitAll()
  else return
  event.preventDefault()
}

function onCanvasPointerDown(event: PointerEvent) {
  if (event.button !== 0 || gesture || panGesture) return
  const target = event.target
  if (!(target instanceof Element) || target.closest('button, h2, p')) return
  panGesture = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: pan.value.x, originY: pan.value.y }
  window.addEventListener('pointermove', onPanMove, true)
  window.addEventListener('pointerup', endPan, true)
  window.addEventListener('pointercancel', endPan, true)
}

function onPanMove(event: PointerEvent) {
  const active = panGesture
  if (!active || event.pointerId !== active.pointerId) return
  pan.value = { x: active.originX + event.clientX - active.startX, y: active.originY + event.clientY - active.startY }
}

function endPan(event: PointerEvent) {
  if (!panGesture || event.pointerId !== panGesture.pointerId) return
  panGesture = null
  window.removeEventListener('pointermove', onPanMove, true)
  window.removeEventListener('pointerup', endPan, true)
  window.removeEventListener('pointercancel', endPan, true)
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
  panGesture = null
  window.removeEventListener('pointermove', onPanMove, true)
  window.removeEventListener('pointerup', endPan, true)
  window.removeEventListener('pointercancel', endPan, true)
})
</script>

<template>
  <div
    ref="canvasEl"
    class="relative z-0 row-start-1 h-full min-h-0 w-full min-w-0 touch-none overflow-hidden bg-ink-50 md:col-span-2 lg:absolute lg:inset-0 lg:h-auto"
    tabindex="-1"
    @wheel.prevent="onWheel"
    @keydown="onCanvasKeyDown"
    @pointerdown="onCanvasPointerDown"
  >
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="background-image: radial-gradient(color-mix(in_oklab,var(--color-ink-400)_45%,transparent) 1px, transparent 1.2px); background-size: 24px 24px;"
    />

    <div
      ref="labelEl"
      class="absolute top-[18px] right-4 left-4 z-[2] flex flex-wrap items-center gap-x-6 gap-y-1 lg:right-auto lg:left-6"
    >
      <h2 class="flex items-center gap-2 text-sm leading-[21px] font-medium tracking-[-0.35px] whitespace-nowrap text-ink-600">
        <span
          class="size-2.5 shrink-0 rounded-full bg-brand-600"
          aria-hidden="true"
        />
        Course roadmap
      </h2>
      <p class="text-xs leading-[18px] text-ink-500 max-lg:min-w-0 lg:whitespace-nowrap">
        {{ course }}
      </p>
    </div>

    <div
      class="absolute inset-0"
      :style="worldStyle"
    >
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
        :stroke="stroke[line.kind]"
        :stroke-dasharray="line.kind === 'closed' ? '5 5' : undefined"
        stroke-linecap="round"
        :stroke-width="highlighted(line) ? 1.75 : 1"
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
        class="absolute top-0 left-0 rounded-[14px]"
        :class="[cardClass(module), dragging(module.id) ? 'z-[3]' : 'z-[1]']"
        :style="placement(module.id)"
        :aria-current="module.current ? 'true' : undefined"
      >
        <button
          type="button"
          class="block w-full rounded-[14px] px-4 pt-3.5 pb-4 text-left touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          :class="dragging(module.id) ? 'cursor-grabbing' : 'cursor-pointer'"
          :aria-pressed="selectedId === module.id"
          :aria-busy="pendingModuleId === module.id ? true : undefined"
          :aria-label="announcement(module)"
          @pointerenter="onHover($event, module)"
          @pointerdown="onPointerDown($event, module.id)"
          @lostpointercapture="onLostPointerCapture"
          @dragstart.prevent
          @click="onClick(module.id)"
          @keydown="onKeyDown($event, module.id)"
        >
          <span class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2">
              <span
                class="flex size-[18px] shrink-0 items-center justify-center rounded-full"
                :class="glyphClass(module)"
                aria-hidden="true"
              >
                <img
                  v-if="module.state === 'mastered'"
                  src="/roadmap-canvas-tick.svg"
                  alt=""
                  width="11"
                  height="11"
                  draggable="false"
                >
                <img
                  v-else-if="module.state === 'closed'"
                  src="/roadmap-canvas-lock.svg"
                  alt=""
                  width="10"
                  height="10"
                  draggable="false"
                  class="opacity-70"
                >
                <span
                  v-else-if="module.current"
                  class="size-1.5 rounded-full bg-paper"
                />
              </span>
              <span class="font-mono text-[10px] leading-4 tracking-[0.6px] text-ink-400 tabular-nums">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
            </span>
            <span
              v-if="module.current"
              class="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] leading-[14px] font-semibold tracking-[0.3px] text-brand-700"
            >Current</span>
          </span>
          <span
            class="mt-2.5 block text-pretty"
            :class="module.current
              ? 'text-[15px] leading-5 font-semibold tracking-[-0.3px] text-ink-900'
              : module.state === 'closed'
                ? 'text-sm leading-5 font-medium tracking-[-0.2px] text-ink-500'
                : 'text-sm leading-5 font-semibold tracking-[-0.2px] text-ink-800'"
          >{{ module.name }}</span>

          <span
            v-if="module.state !== 'closed'"
            class="mt-3.5 flex items-center gap-2.5"
          >
            <span
              class="relative h-1 min-w-0 flex-1 rounded-full bg-ink-100"
              aria-hidden="true"
            >
              <span
                class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                :class="module.state === 'mastered' ? 'bg-emerald-500' : 'bg-brand-600'"
                :style="{ width: `${masteryPercent(module)}%` }"
              />
              <span
                class="absolute -top-[3px] -bottom-[3px] w-px rounded-full bg-ink-300"
                :style="{ left: `${thresholdPercent}%` }"
              />
            </span>
            <span class="shrink-0 font-mono text-[10px] leading-4 text-ink-500 tabular-nums">
              {{ masteryPercent(module) }}%
            </span>
          </span>
        </button>
      </li>
    </ul>
    </div>

    <div
      ref="footerEl"
      class="absolute bottom-5 left-4 z-[2] flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 lg:left-auto lg:max-w-none lg:flex-nowrap lg:right-[400px]"
    >
      <button
        type="button"
        class="min-h-11 shrink-0 cursor-pointer rounded-lg border border-ink-200/80 bg-paper/90 px-2.5 text-[11px] leading-[16.5px] font-medium whitespace-nowrap text-ink-600 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] backdrop-blur-[4px] transition-[background-color,color,translate] duration-150 hover:bg-paper hover:text-ink-900 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 md:min-h-0 md:py-[5px]"
        @click="resetArrangement"
      >
        Reset arrangement
      </button>
      <div
        class="flex shrink-0 items-center rounded-lg border border-ink-200/80 bg-paper/90 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] backdrop-blur-[4px]"
        role="group"
        aria-label="Zoom"
      >
        <button
          type="button"
          class="min-h-11 min-w-9 cursor-pointer rounded-l-lg text-sm text-ink-600 transition-colors duration-150 hover:bg-paper hover:text-ink-900 active:bg-ink-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900 disabled:cursor-default disabled:opacity-40 md:min-h-0 md:py-[3px]"
          aria-label="Zoom out"
          :disabled="zoom <= minZoom"
          @click="zoomTo(zoom / zoomStep)"
        >
          −
        </button>
        <button
          type="button"
          class="min-h-11 min-w-12 cursor-pointer px-1 font-mono text-[11px] text-ink-500 tabular-nums hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900 md:min-h-0 md:py-[5px]"
          aria-label="Fit all modules"
          title="Fit all modules"
          @click="fitAll"
        >
          {{ zoomPercent }}%
        </button>
        <button
          type="button"
          class="min-h-11 min-w-9 cursor-pointer rounded-r-lg text-sm text-ink-600 transition-colors duration-150 hover:bg-paper hover:text-ink-900 active:bg-ink-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-900 disabled:cursor-default disabled:opacity-40 md:min-h-0 md:py-[3px]"
          aria-label="Zoom in"
          :disabled="zoom >= maxZoom"
          @click="zoomTo(zoom * zoomStep)"
        >
          +
        </button>
      </div>
      <p
        class="flex items-center gap-2 rounded-lg border border-ink-200/80 bg-paper/90 px-[11px] py-[5px] font-mono text-[11px] leading-[16.5px] whitespace-nowrap text-ink-500 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] backdrop-blur-[4px]"
        aria-hidden="true"
      >
        <span>Ctrl+scroll to zoom</span>
        <span class="text-ink-300">|</span>
        <span>Studio canvas</span>
      </p>
    </div>
  </div>
</template>
