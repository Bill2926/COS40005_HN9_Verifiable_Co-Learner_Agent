<script setup lang="ts">
// A sample turn, drawn in the conversation's own styles.
const sample = [
  {
    author: 'student',
    name: 'You',
    text: 'Why does my total keep coming out as 0?',
    portrait: '/portraits/student.png',
    bubble: 'rounded-tl-2xl rounded-tr-[2px] rounded-br-2xl rounded-bl-2xl bg-slate-700 px-[14px] py-[10px] text-white',
    nameClass: 'text-white',
    frame: 'border-slate-300 bg-slate-100 shadow-[-2px_2px_0_0_var(--color-slate-400)]',
  },
  {
    author: 'deskmate',
    name: 'Deskmate',
    text: 'Mine too! Does it matter where total = 0 goes?',
    portrait: '/portraits/deskmate.png',
    bubble: 'rounded-tl-[2px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-amber-200/80 bg-amber-50 px-[15px] py-[11px] text-amber-950',
    nameClass: 'text-amber-950',
    frame: 'border-amber-200 bg-amber-50 shadow-[2px_2px_0_0_var(--color-amber-300)]',
  },
  {
    author: 'teacher',
    name: 'Teacher',
    text: 'It does. Set total = 0 inside the loop and it starts over on every pass. Try moving it above the loop.',
    portrait: '/portraits/teacher.png',
    bubble: 'rounded-tl-[2px] rounded-tr-2xl rounded-br-2xl rounded-bl-2xl border border-indigo-200/80 bg-indigo-50 px-[15px] py-[11px] text-indigo-950',
    nameClass: 'text-indigo-900',
    frame: 'border-indigo-200 bg-indigo-50 shadow-[2px_2px_0_0_var(--color-indigo-300)]',
  },
] as const
</script>

<template>
  <div
    aria-hidden="true"
    class="flex flex-col gap-4 rounded-xl border border-default bg-slate-50/60 p-5"
  >
    <div
      v-for="message in sample"
      :key="message.author"
      class="flex items-start gap-3"
      :class="message.author === 'student' ? 'flex-row-reverse' : 'flex-row'"
    >
      <span
        class="mt-0.5 size-9 shrink-0 overflow-hidden rounded-[4px] border"
        :class="message.frame"
      >
        <img
          :src="message.portrait"
          alt=""
          width="36"
          height="36"
          class="size-full object-cover [image-rendering:pixelated]"
        >
      </span>
      <div
        class="w-fit max-w-[80%] text-[13px] leading-5"
        :class="message.bubble"
      >
        <p class="mb-0.5 text-[12px] leading-4 font-semibold" :class="message.nameClass">
          {{ message.name }}
        </p>
        <p>{{ message.text }}</p>
      </div>
    </div>
    <p class="ml-12 flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] leading-4 font-medium text-primary-700 ring-1 ring-primary-200/80">
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Checked by VerifyShield
    </p>
  </div>
</template>
