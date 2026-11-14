<script setup lang="ts">
// A small copy of the workspace roadmap, for the Home page. Module names are general, not one
// course's. When it first scrolls into view, the current module's loop ticks off, its mastery
// crosses the threshold, and the next module opens. Without JavaScript, or with reduced motion,
// it shows that finished state.
const threshold = 80
const start = 62
const end = 86

const loop = ['Learn with the teacher', 'Talk it through with your deskmate', 'Submit your own work']

const modules = [
  { name: 'Getting started', kind: 'mastered', mastery: 100 },
  { name: 'Core ideas', kind: 'mastered', mastery: 94 },
  { name: 'Putting ideas together', kind: 'current', mastery: end },
  { name: 'Solving real problems', kind: 'next', mastery: 0 },
  { name: 'Final project', kind: 'closed', mastery: 0 },
] as const

// Where each station sits on the board, in percent. Stations on the top row hang their card
// below; stations on the bottom row stand theirs above, so the path runs between the cards.
const stations = [
  { x: 10, y: 14 },
  { x: 30, y: 86 },
  { x: 50, y: 14 },
  { x: 70, y: 86 },
  { x: 90, y: 14 },
]

function segment(index: number): string {
  const a = stations[index]!
  const b = stations[index + 1]!
  const mid = (a.x + b.x) / 2
  return `M${a.x * 10},${a.y} C${mid * 10},${a.y} ${mid * 10},${b.y} ${b.x * 10},${b.y}`
}

const ticks = ref(loop.length)
const mastery = ref(end)
const unlocked = computed(() => mastery.value >= threshold)
const playing = ref(false)

const root = ref<HTMLElement>()
let timers: ReturnType<typeof setTimeout>[] = []
let frame = 0

function reset() {
  timers.forEach(clearTimeout)
  cancelAnimationFrame(frame)
  timers = []
  ticks.value = 0
  mastery.value = start
}

function play() {
  if (playing.value) return
  reset()
  playing.value = true
  loop.forEach((_, index) => timers.push(setTimeout(() => { ticks.value = index + 1 }, 350 + index * 450)))
  timers.push(setTimeout(() => {
    const begin = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / 1400)
      const eased = 1 - (1 - t) ** 3
      mastery.value = Math.round(start + (end - start) * eased)
      if (t < 1) frame = requestAnimationFrame(step)
      else playing.value = false
    }
    frame = requestAnimationFrame(step)
  }, 350 + loop.length * 450))
}

function replay(event: PointerEvent) {
  if (event.pointerType === 'mouse' && !playing.value && !reduced()) play()
}

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

onMounted(() => {
  const element = root.value
  if (!element || reduced() || !('IntersectionObserver' in window)) return
  if (element.getBoundingClientRect().top < window.innerHeight) return
  reset()
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return
    observer.disconnect()
    play()
  }, { threshold: 0.45 })
  observer.observe(element)
})

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  cancelAnimationFrame(frame)
})

function cardClass(kind: string): string {
  if (kind === 'current') return 'border-brand-600 shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-600)_10%,transparent),0_12px_28px_-10px_color-mix(in_oklab,var(--color-brand-600)_30%,transparent)]'
  if (kind === 'next' && unlocked.value) return 'border-brand-300 shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
  if (kind === 'next' || kind === 'closed') return 'border-dashed border-ink-300'
  return 'border-ink-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
}

function glyphClass(kind: string): string {
  if (kind === 'mastered') return 'bg-emerald-50 ring-1 ring-emerald-200'
  if (kind === 'current') return 'bg-brand-600 ring-4 ring-brand-100'
  if (kind === 'next' && unlocked.value) return 'bg-paper ring-[1.5px] ring-brand-400'
  return 'bg-ink-100 ring-1 ring-ink-200'
}

function open(kind: string) {
  return kind === 'mastered' || kind === 'current' || (kind === 'next' && unlocked.value)
}

function shown(kind: string, value: number) {
  return kind === 'current' ? mastery.value : value
}

function summary(module: (typeof modules)[number]): string {
  if (module.kind === 'mastered') return `${module.name}, mastered`
  if (module.kind === 'current') return `${module.name}, current module, mastery past the ${threshold}% threshold`
  if (module.kind === 'next') return `${module.name}, opened by passing the threshold`
  return `${module.name}, locked`
}
</script>

<template>
  <div
    ref="root"
    class="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50 p-4 sm:p-6 lg:h-[26rem] lg:p-0"
    @pointerenter="replay"
  >
    <div
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style="background-image: radial-gradient(color-mix(in oklab, var(--color-ink-400) 45%, transparent) 1px, transparent 1.2px); background-size: 24px 24px;"
    />

    <!-- The path between stations, drawn only on the wide board. -->
    <svg class="absolute inset-0 hidden size-full lg:block" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        v-for="(_, index) in stations.slice(0, -1)"
        :key="index"
        :d="segment(index)"
        fill="none"
        stroke="var(--color-roadmap-line)"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
        :stroke-width="index < 2 ? 1.75 : 1"
        :stroke-dasharray="index === 3 || (index === 2 && !unlocked) ? '5 5' : undefined"
        class="transition-[stroke-width] duration-500"
      />
    </svg>

    <ol class="relative flex flex-col gap-3 lg:static" aria-label="Course roadmap">
      <li
        v-for="(module, index) in modules"
        :key="module.name"
        class="roadmap-stop relative flex items-start gap-3 lg:absolute lg:block lg:w-[18%] lg:-translate-x-1/2"
        :class="module.kind === 'current' && 'lg:w-[19%]'"
        :style="{
          '--x': `${stations[index]!.x}%`,
          '--top': index % 2 === 0 ? `calc(${stations[index]!.y}% + 22px)` : 'auto',
          '--bottom': index % 2 === 1 ? `calc(${100 - stations[index]!.y}% + 22px)` : 'auto',
        }"
        :aria-label="summary(module)"
        :aria-current="module.kind === 'current' ? 'step' : undefined"
      >
        <!-- The station: on the path on wide screens, in a rail beside the card on narrow ones. -->
        <span
          class="relative z-10 mt-3.5 flex size-[18px] shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-300 lg:absolute lg:left-1/2 lg:mt-0 lg:-translate-x-1/2"
          :class="[glyphClass(module.kind), index % 2 === 0 ? 'lg:-top-[31px]' : 'lg:-bottom-[31px]']"
          aria-hidden="true"
        >
          <img v-if="module.kind === 'mastered'" src="/roadmap-canvas-tick.svg" alt="" width="11" height="11">
          <span v-else-if="module.kind === 'current'" class="size-1.5 rounded-full bg-paper" />
          <img v-else-if="!open(module.kind)" src="/roadmap-canvas-lock.svg" alt="" width="10" height="10" class="opacity-70">
        </span>
        <span v-if="index < modules.length - 1" class="absolute top-8 bottom-[-12px] left-[8.5px] w-px bg-roadmap-line/40 lg:hidden" aria-hidden="true" />

        <div
          class="min-w-0 flex-1 rounded-[14px] border bg-paper px-4 pt-3.5 pb-4 lg:px-3.5 xl:px-4 transition-[border-color,box-shadow,background-color,translate] duration-300 hover:-translate-y-0.5"
          :class="cardClass(module.kind)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs whitespace-nowrap text-ink-500 tabular-nums">Module {{ index + 1 }}</span>
            <span v-if="module.kind === 'current'" class="rounded-full bg-brand-50 px-2 py-0.5 whitespace-nowrap text-[11px] font-semibold text-brand-700">Current</span>
            <span v-else-if="module.kind === 'next'" class="rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-colors duration-300" :class="unlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'">{{ unlocked ? 'Now open' : 'Locked' }}</span>
          </div>
          <p
            class="mt-2 text-pretty"
            :class="module.kind === 'current'
              ? 'text-[15px]/5 font-semibold text-ink-900'
              : open(module.kind) ? 'text-sm/5 font-semibold text-ink-800' : 'text-sm/5 font-medium text-ink-500'"
          >
            {{ module.name }}
          </p>

          <ul v-if="module.kind === 'current'" class="mt-3 flex flex-col gap-1.5">
            <li v-for="(step, stepIndex) in loop" :key="step" class="flex items-start gap-2 text-xs/[18px]" :class="ticks > stepIndex ? 'text-ink-800' : 'text-ink-500'">
              <span
                class="mt-px flex size-4 shrink-0 items-center justify-center rounded-full ring-1 transition-[background-color,box-shadow] duration-300"
                :class="ticks > stepIndex ? 'bg-emerald-50 ring-emerald-200' : 'bg-paper ring-ink-200'"
                aria-hidden="true"
              >
                <img src="/roadmap-canvas-tick.svg" alt="" width="10" height="10" class="transition-[opacity,scale] duration-300" :class="ticks > stepIndex ? 'scale-100 opacity-100' : 'scale-50 opacity-0'">
              </span>
              {{ step }}
            </li>
          </ul>

          <div v-if="module.kind !== 'closed' && (module.kind !== 'next' || unlocked)" class="mt-3.5 flex items-center gap-2.5">
            <span class="relative h-1 min-w-0 flex-1 rounded-full bg-ink-100" aria-hidden="true">
              <span
                class="absolute inset-y-0 left-0 rounded-full"
                :class="module.kind === 'mastered' ? 'bg-emerald-500' : 'bg-brand-600'"
                :style="{ width: `${shown(module.kind, module.mastery)}%` }"
              />
              <span class="absolute -top-[3px] -bottom-[3px] w-px rounded-full bg-ink-400" :style="{ left: `${threshold}%` }" />
            </span>
            <span class="w-8 shrink-0 text-right text-[11px] text-ink-600 tabular-nums">{{ shown(module.kind, module.mastery) }}%</span>
          </div>
          <p v-if="module.kind === 'current'" class="mt-2 text-[11px]/4 text-ink-500">
            The next module opens at {{ threshold }}%.
          </p>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .roadmap-stop {
    left: var(--x);
    top: var(--top);
    bottom: var(--bottom);
  }
}
</style>
