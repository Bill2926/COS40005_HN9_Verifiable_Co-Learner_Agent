<script setup lang="ts">
import type { RoadmapModule } from '#shared/turn'

const props = defineProps<{
  modules: RoadmapModule[]
  masteryThreshold: number
}>()

const emit = defineEmits<{
  selectModule: [moduleId: string]
}>()

const masteredCount = computed(() => props.modules.filter(module => module.state === 'mastered').length)
const thresholdPercent = computed(() => Math.round(props.masteryThreshold * 100))

// A closed module shows no mastery, so only an unlocked one reaches the bar.
function masteryPercent(module: RoadmapModule): number {
  return module.state === 'closed' ? 0 : Math.round(module.mastery * 100)
}

const groups = computed(() => {
  const grouped: { part: string, label: string, modules: RoadmapModule[] }[] = []
  for (const module of props.modules) {
    const last = grouped.at(-1)
    if (!last || last.part !== module.part) {
      grouped.push({
        part: module.part,
        label: `Part ${grouped.length + 1}: ${module.part}`,
        modules: [module],
      })
    }
    else {
      last.modules.push(module)
    }
  }
  return grouped
})

function cardClass(module: RoadmapModule): string {
  if (module.state === 'closed') {
    return 'flex flex-col gap-1 bg-slate-100/70 opacity-80 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.6)]'
  }
  if (module.current) {
    return 'bg-indigo-50/60 shadow-[inset_0_0_0_1px_#a5b4fc,0px_0px_0px_1px_rgba(199,210,254,0.6)]'
  }
  return 'bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9),0px_1px_1px_rgba(0,0,0,0.02)]'
}
</script>

<template>
  <aside class="h-full min-h-0 min-w-0 flex-col border-r border-slate-200 bg-slate-50/80 md:max-lg:block md:max-lg:h-auto md:max-lg:overflow-x-auto md:max-lg:overflow-y-hidden md:max-lg:border-r-0 md:max-lg:border-b lg:flex">
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:max-lg:w-max md:max-lg:min-w-full md:max-lg:flex-none md:max-lg:flex-row md:max-lg:items-center md:max-lg:overflow-visible">
      <div class="flex items-center justify-between gap-2 md:max-lg:w-36 md:max-lg:shrink-0 md:max-lg:flex-col md:max-lg:items-start">
        <h2 class="text-xs font-semibold leading-4 tracking-[-0.3px] text-slate-400 uppercase">
          Course roadmap
        </h2>
        <p class="shrink-0 font-mono text-[10px] leading-[15px] text-slate-400">
          {{ masteredCount }}/{{ modules.length }} mastered
        </p>
      </div>
      <ul class="flex flex-col gap-1.5 md:max-lg:flex-row md:max-lg:flex-nowrap">
        <template
          v-for="group in groups"
          :key="group.label"
        >
          <li
            role="presentation"
            class="px-1 pt-2 md:max-lg:flex md:max-lg:w-40 md:max-lg:shrink-0 md:max-lg:items-center md:max-lg:pt-0"
          >
            <h3 class="text-[10px] font-semibold tracking-[0.4px] text-slate-400 uppercase">
              {{ group.label }}
            </h3>
          </li>
          <li
            v-for="module in group.modules"
            :key="module.id"
            class="md:max-lg:w-52 md:max-lg:shrink-0"
            :aria-current="module.current ? 'true' : undefined"
          >
            <button
              type="button"
              class="w-full rounded-[4px] p-[11px] text-left"
              :class="cardClass(module)"
              @click="emit('selectModule', module.id)"
            >
              <template v-if="module.state === 'closed'">
                <div class="flex items-center justify-between gap-2">
                  <p class="flex min-w-0 items-center gap-1.5 text-xs font-medium leading-4 text-slate-600">
                    <img
                      src="/course-roadmap-lock.svg"
                      alt=""
                      width="12"
                      height="12"
                    >
                    {{ module.name }}
                  </p>
                  <p class="shrink-0 font-mono text-[10px] leading-[15px] text-slate-400">
                    Closed
                  </p>
                </div>
                <p class="min-h-[17px] text-[11px] leading-[16.5px] text-slate-400">
                  {{ module.closedReason }}
                </p>
              </template>
              <div
                v-else
                class="flex items-center justify-between gap-2"
              >
                <p
                  class="min-w-0 text-xs leading-4"
                  :class="module.current ? 'font-semibold text-indigo-950' : 'font-medium text-slate-800'"
                >
                  {{ module.name }}
                </p>
                <p
                  v-if="module.state === 'mastered'"
                  class="flex h-[21px] shrink-0 items-center gap-1 rounded-[4px] border border-emerald-200/60 bg-emerald-50 px-[7px] text-[10px] font-medium leading-[15px] text-emerald-700"
                >
                  <img
                    src="/course-roadmap-tick.svg"
                    alt=""
                    width="10"
                    height="10"
                  >
                  Mastered
                </p>
                <p
                  v-else
                  class="flex h-[21px] shrink-0 items-center gap-1 rounded-[4px] border border-indigo-200 bg-indigo-100/70 px-[7px] text-[10px] font-medium leading-[15px] text-indigo-700"
                >
                  <span
                    v-if="module.current"
                    class="size-1.5 shrink-0 rounded-full bg-indigo-600"
                    aria-hidden="true"
                  />
                  {{ module.current ? 'Open · Current' : 'Open' }}
                </p>
              </div>
              <div
                v-if="module.state !== 'closed'"
                class="mt-2 flex items-center gap-2"
              >
                <span
                  class="relative h-1.5 min-w-0 flex-1 rounded-full bg-slate-200/80"
                  aria-hidden="true"
                >
                  <span
                    class="absolute inset-y-0 left-0 rounded-full"
                    :class="module.state === 'mastered' ? 'bg-emerald-500' : 'bg-indigo-500'"
                    :style="{ width: `${masteryPercent(module)}%` }"
                  />
                  <span
                    class="absolute -top-0.5 -bottom-0.5 w-px bg-slate-400"
                    :style="{ left: `${thresholdPercent}%` }"
                  />
                </span>
                <p class="shrink-0 font-mono text-[10px] leading-[15px] text-slate-500 tabular-nums">
                  {{ masteryPercent(module) }}%
                </p>
              </div>
            </button>
          </li>
        </template>
      </ul>
    </div>
  </aside>
</template>
