<script setup lang="ts">
// One turn through the VerifyShield: a student message, the two proposed moves,
// the verdict, and the three ways it can go. Wording follows server/verify-shield/decide.ts.
const proposals = [
  { name: 'Teacher', move: 'explain_concept', portrait: '/portraits/teacher.png', frame: 'border-indigo-200 bg-indigo-50' },
  { name: 'Deskmate', move: 'peer_question', portrait: '/portraits/deskmate.png', frame: 'border-amber-200 bg-amber-50' },
] as const

const lanes = [
  { verdict: 'Allow', text: 'In the agent’s role and in an unlocked module. The agent writes its reply.', ring: 'ring-emerald-200 bg-emerald-50 text-emerald-800' },
  { verdict: 'Downgrade', text: 'Teaching about a closed module or out of course becomes a redirect.', ring: 'ring-amber-200 bg-amber-50 text-amber-800' },
  { verdict: 'Block', text: 'Outside the agent’s role, such as a deskmate explaining. Nothing is shown.', ring: 'ring-rose-200 bg-rose-50 text-rose-800' },
] as const
</script>

<template>
  <div
    role="img"
    aria-label="A student message goes to the teacher and deskmate, whose proposed moves pass through the VerifyShield, which allows, downgrades or blocks each one."
    class="grid gap-3 rounded-xl border border-default bg-slate-50/60 p-4 md:grid-cols-[1fr_auto_1.1fr_auto_1fr_auto_1.6fr] md:items-center md:gap-0 md:p-6"
  >
    <div class="rounded-lg border border-slate-200 bg-white p-3 text-[13px] leading-5 shadow-xs">
      <p class="text-[11px] font-semibold tracking-wide text-muted uppercase">
        Student
      </p>
      <p class="mt-1 font-mono text-[12px] text-highlighted">
        “Can you just give me the loop?”
      </p>
    </div>

    <span class="shield-wire" aria-hidden="true"><i /></span>

    <div class="flex flex-col gap-2">
      <div
        v-for="proposal in proposals"
        :key="proposal.name"
        class="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 shadow-xs"
      >
        <span class="size-8 shrink-0 overflow-hidden rounded-[4px] border" :class="proposal.frame">
          <img :src="proposal.portrait" alt="" width="32" height="32" class="size-full object-cover [image-rendering:pixelated]">
        </span>
        <span class="min-w-0">
          <span class="block text-[12px] font-semibold text-highlighted">{{ proposal.name }}</span>
          <code class="block truncate text-[11px] text-muted">{{ proposal.move }}</code>
        </span>
      </div>
    </div>

    <span class="shield-wire" aria-hidden="true"><i style="animation-delay: 0.9s" /></span>

    <div class="flex flex-col items-center gap-2 rounded-lg bg-slate-900 p-4 text-center text-white shadow-sm">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="text-indigo-300">
        <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <span class="text-sm font-semibold">VerifyShield</span>
      <span class="text-[11px] leading-4 text-slate-300">Same rules, same verdict, every time</span>
    </div>

    <span class="shield-wire" aria-hidden="true"><i style="animation-delay: 1.8s" /></span>

    <ul class="flex flex-col gap-2">
      <li
        v-for="lane in lanes"
        :key="lane.verdict"
        class="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 text-[12px] leading-[18px] text-default shadow-xs"
      >
        <span class="mt-px shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1" :class="lane.ring">
          {{ lane.verdict }}
        </span>
        <span>{{ lane.text }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* A wire between two stages: vertical on a phone, horizontal from md. A dot runs along it. */
.shield-wire {
  position: relative;
  justify-self: center;
  width: 2px;
  height: 20px;
  background: var(--color-slate-300);
  overflow: hidden;
}
.shield-wire i {
  position: absolute;
  left: -2px;
  top: 0;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-indigo-500);
  animation: wire-down 2.7s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@media (width >= 48rem) {
  .shield-wire {
    width: 40px;
    height: 2px;
    overflow: visible;
  }
  .shield-wire i {
    top: -2px;
    left: 0;
    animation-name: wire-across;
  }
}
@keyframes wire-down {
  0% { transform: translateY(-6px); opacity: 0; }
  20% { opacity: 1; }
  60%, 100% { transform: translateY(20px); opacity: 0; }
}
@keyframes wire-across {
  0% { transform: translateX(0); opacity: 0; }
  15% { opacity: 1; }
  55% { transform: translateX(34px); opacity: 1; }
  70%, 100% { transform: translateX(34px); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .shield-wire i { animation: none; opacity: 0; }
}
</style>
