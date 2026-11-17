<script setup lang="ts">
// The header both product owner pages share: the nav between Decisions and
// Settings, a link to the lecturer page for a product owner who also lectures,
// and the way back to the course workspace.
const route = useRoute()

const pages = [
  { to: '/admin', label: 'Decisions' },
  { to: '/admin/settings', label: 'Settings' },
] as const

const isLecturer = ref(false)
onMounted(async () => {
  try {
    await $fetch('/api/lecturer')
    isLecturer.value = true
  }
  catch {
    isLecturer.value = false
  }
})

const linkClass = 'text-sm text-muted underline decoration-transparent underline-offset-4 hover:text-highlighted hover:decoration-current'
</script>

<template>
  <header class="phone-safe-top shrink-0 border-b border-default/80 bg-default px-4 py-3 md:px-8">
    <div class="mx-auto flex w-full max-w-[90rem] flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p class="flex items-center gap-2 text-sm font-semibold tracking-tight text-highlighted">
          <img
            src="/swinburne-fpt-logo.webp"
            alt=""
            width="871"
            height="705"
            class="block h-8 w-auto shrink-0"
          >
          Verifiable Co-Learner
        </p>
        <nav
          aria-label="Product owner"
          class="flex items-center gap-1"
        >
          <NuxtLink
            v-for="item in pages"
            :key="item.to"
            :to="item.to"
            class="inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-medium md:min-h-9"
            :class="route.path === item.to ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-elevated hover:text-highlighted'"
            :aria-current="route.path === item.to ? 'page' : undefined"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <NuxtLink
          v-if="isLecturer"
          to="/lecturer"
          :class="linkClass"
        >
          Lecturer page
        </NuxtLink>
        <NuxtLink
          :to="{ path: '/', query: { workspace: '1' } }"
          :class="linkClass"
        >
          Back to the course
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
