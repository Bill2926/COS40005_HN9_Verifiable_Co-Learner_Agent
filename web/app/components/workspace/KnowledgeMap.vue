<script setup lang="ts">
import type { MapTopic } from '#shared/turn'

const props = defineProps<{
  topics: MapTopic[]
}>()

const masteredCount = computed(() => props.topics.filter(topic => topic.state === 'mastered').length)

function cardClass(topic: MapTopic): string {
  if (topic.state === 'closed') {
    return 'flex flex-col gap-1 bg-slate-100/70 opacity-80 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.6)]'
  }
  if (topic.current) {
    return 'bg-indigo-50/60 shadow-[inset_0_0_0_1px_#a5b4fc,0px_0px_0px_1px_rgba(199,210,254,0.6)]'
  }
  return 'bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9),0px_1px_1px_rgba(0,0,0,0.02)]'
}
</script>

<template>
  <aside class="flex h-full min-h-0 min-w-0 flex-col border-r border-slate-200 bg-slate-50/80">
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-xs font-semibold leading-4 tracking-[-0.3px] text-slate-400 uppercase">
          Knowledge map
        </h2>
        <p class="shrink-0 font-mono text-[10px] leading-[15px] text-slate-400">
          {{ masteredCount }}/{{ topics.length }} mastered
        </p>
      </div>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="topic in topics"
          :key="topic.id"
          class="rounded-[4px] p-[11px]"
          :class="cardClass(topic)"
          :aria-current="topic.current ? 'true' : undefined"
        >
          <template v-if="topic.state === 'closed'">
            <div class="flex items-center justify-between gap-2">
              <p class="flex min-w-0 items-center gap-1.5 text-xs font-medium leading-4 text-slate-600">
                <img
                  src="/knowledge-map-lock.svg"
                  alt=""
                  width="12"
                  height="12"
                >
                {{ topic.name }}
              </p>
              <p class="shrink-0 font-mono text-[10px] leading-[15px] text-slate-400">
                Closed
              </p>
            </div>
            <p class="min-h-[17px] text-[11px] leading-[16.5px] text-slate-400">
              {{ topic.closedReason }}
            </p>
          </template>
          <div
            v-else
            class="flex items-center justify-between gap-2"
          >
            <p
              class="min-w-0 text-xs leading-4"
              :class="topic.current ? 'font-semibold text-indigo-950' : 'font-medium text-slate-800'"
            >
              {{ topic.name }}
            </p>
            <p
              v-if="topic.state === 'mastered'"
              class="flex h-[21px] shrink-0 items-center gap-1 rounded-[4px] border border-emerald-200/60 bg-emerald-50 px-[7px] text-[10px] font-medium leading-[15px] text-emerald-700"
            >
              <img
                src="/knowledge-map-tick.svg"
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
                v-if="topic.current"
                class="size-1.5 shrink-0 rounded-full bg-indigo-600"
                aria-hidden="true"
              />
              {{ topic.current ? 'Open · Current' : 'Open' }}
            </p>
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>
