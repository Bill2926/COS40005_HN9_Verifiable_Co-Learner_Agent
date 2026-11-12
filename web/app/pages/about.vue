<script setup lang="ts">
import { sessionStudentId, studentIdFromAuth } from '#shared/student-id'

// Public: no signed-in middleware. A signed-in student is sent to their workspace instead of sign-in.

// The HN9 team, from the repository's contributors. Real names and roles are not
// recorded anywhere in the repo yet: fill `name` and `role` here when the team supplies them.
const team: { handle: string, name?: string, role?: string }[] = [
  { handle: 'atuan1605' },
  { handle: 'Bill2926' },
  { handle: 'daotheone' },
  { handle: 'nnqtrung' },
]

const repository = 'https://github.com/Bill2926/COS40005_HN9_Verifiable_Co-Learner_Agent'

const signedIn = useState('about-signed-in', () => false)
if (import.meta.server) {
  const event = useRequestEvent()
  signedIn.value = Boolean(event && await sessionStudentId(event))
}
onMounted(async () => {
  try {
    signedIn.value = Boolean(await studentIdFromAuth(useNuxtApp().$supabase))
  }
  catch {}
})

const start = computed(() => signedIn.value
  ? { to: '/', label: 'Open your workspace' }
  : { to: '/sign-in', label: 'Sign in to start' })

interface OutlineModule { number: number, name: string, part: string, summary: string, available: boolean }
const { data: outline } = await useFetch<{ title: string, modules: OutlineModule[] }>('/course-outline')

const parts = computed(() => {
  const grouped: { label: string, modules: OutlineModule[] }[] = []
  for (const module of outline.value?.modules ?? []) {
    const last = grouped.at(-1)
    if (last && last.modules[0]!.part === module.part) last.modules.push(module)
    else grouped.push({ label: `Part ${grouped.length + 1}: ${module.part}`, modules: [module] })
  }
  return grouped
})
const firstModule = computed(() => outline.value?.modules[0])

const roles = [
  {
    name: 'Teacher agent',
    portrait: '/portraits/teacher.png',
    frame: 'border-indigo-200 bg-indigo-50 shadow-[2px_2px_0_0_var(--color-indigo-300)]',
    text: 'Knows the full content of the module you are on. The only agent that explains, corrects a misconception or suggests moving on.',
  },
  {
    name: 'Deskmate agent',
    portrait: '/portraits/deskmate.png',
    frame: 'border-amber-200 bg-amber-50 shadow-[2px_2px_0_0_var(--color-amber-300)]',
    text: 'Works at about your level and never sees the materials or solutions. It may ask a peer question or share its confusion, nothing more.',
  },
  {
    name: 'VerifyShield',
    portrait: null,
    frame: 'border-slate-700 bg-slate-900 text-indigo-300',
    text: 'Fixed rules that rule on every proposed move and check every reply before you read it. Each verdict goes into a decision log.',
  },
] as const

useHead({
  title: 'About',
  meta: [
    { name: 'description', content: 'Verifiable Co-Learner: a Python co-learner for first-year students at Swinburne, with a teacher agent, a deskmate agent and a VerifyShield that checks every reply.' },
    { property: 'og:title', content: 'About Verifiable Co-Learner' },
    { property: 'og:description', content: 'A Python co-learner for first-year students, with a teacher and a deskmate beside you.' },
  ],
})

const wrap = 'mx-auto w-full max-w-6xl px-4 md:px-8'
const section = 'scroll-mt-16 border-t border-default py-16 md:flex md:min-h-[calc(100dvh-4rem)] md:flex-col md:py-24'
const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-sm bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-primary-700 active:bg-primary-700 max-md:w-full md:min-h-10'
const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-sm border border-default bg-default px-4 py-2.5 text-sm font-medium text-highlighted shadow-xs hover:border-slate-300 hover:bg-slate-50 max-md:w-full md:min-h-10'
</script>

<template>
  <div class="min-h-dvh bg-default text-default">
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-default focus:px-3 focus:py-2 focus:text-sm focus:shadow-md">
      Skip to content
    </a>

    <header class="sticky top-0 z-40 border-b border-default/80 bg-default/90 backdrop-blur">
      <div :class="wrap" class="flex h-16 items-center justify-between gap-4">
        <NuxtLink to="/about" class="flex min-h-11 items-center gap-3 text-base font-semibold tracking-tight text-highlighted">
          <img src="/swinburne-crest.png" alt="Swinburne University of Technology" width="190" height="288" class="block h-10 w-auto shrink-0">
          <span class="max-sm:sr-only">Verifiable Co-Learner</span>
        </NuxtLink>
        <nav aria-label="About" class="flex items-center gap-1 text-sm">
          <a v-for="link in [{ href: '#how', label: 'How it works' }, { href: '#course', label: 'Course' }, { href: '#team', label: 'Team' }]" :key="link.href" :href="link.href" class="hidden min-h-10 items-center rounded-sm px-3 text-muted hover:bg-slate-100 hover:text-highlighted md:inline-flex">
            {{ link.label }}
          </a>
          <NuxtLink :to="start.to" class="ml-2 inline-flex min-h-11 items-center rounded-sm bg-primary-600 px-3.5 text-sm font-medium text-white shadow-xs hover:bg-primary-700 md:min-h-9">
            {{ signedIn ? 'Workspace' : 'Sign in' }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main">
      <!-- Hero: what it is, for whom, one hard fact, the main action. -->
      <section id="top" class="py-12 md:flex md:min-h-[calc(100dvh-4rem)] md:items-center md:py-16" data-enter>
        <div :class="wrap" class="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div class="flex flex-col gap-6">
            <p class="about-rise text-sm font-medium text-primary-700" style="--i: 0">
              Introduction to Programming with Python
            </p>
            <h1 class="about-rise text-4xl/[1.08] font-semibold tracking-tight text-highlighted md:text-5xl/[1.05] xl:text-[3.25rem]/[1.05]" style="--i: 1">
              A Python co-learner for first-year students, with a teacher and a deskmate beside you.
            </h1>
            <p class="about-rise max-w-xl text-lg/7 text-muted" style="--i: 2">
              Five modules, 45 automatic tests, and every agent reply checked by the VerifyShield before you see it.
            </p>
            <div class="about-rise flex flex-col gap-3 pt-2 sm:flex-row" style="--i: 3">
              <NuxtLink :to="start.to" :class="primaryButton">
                {{ start.label }}
              </NuxtLink>
              <a href="#how" :class="secondaryButton">See how a turn works</a>
            </div>
          </div>
          <AboutSampleTurn class="about-rise w-full max-w-lg justify-self-center lg:justify-self-end" style="--i: 4" />
        </div>
      </section>

      <!-- Why: the type moment. -->
      <section id="why" :class="section" class="bg-slate-50/70">
        <div :class="wrap" class="flex flex-1 flex-col justify-between gap-12">
          <h2 class="text-sm font-medium text-primary-700">
            Why a co-learner
          </h2>
          <p class="max-w-5xl text-5xl/[1.02] font-semibold tracking-tight text-highlighted md:text-7xl/[1] lg:text-8xl/[0.98]">
            Learn deeper, <span class="text-slate-400">not just faster.</span>
          </p>
          <div class="grid gap-8 text-base/7 text-muted md:grid-cols-2 md:gap-12">
            <p>
              An AI that hands over working code lets a student pass an exercise without the idea behind it. That shortcut feels like progress and leaves nothing for the exam.
            </p>
            <p>
              Here the agents stay inside the course. Module 2 opens once your mastery of Module 1 reaches 90%, and mastery comes only from the code you submit.
            </p>
          </div>
        </div>
      </section>

      <!-- How a turn works: the three roles, then the verdict diagram. -->
      <section id="how" :class="section">
        <div :class="wrap" class="flex flex-col gap-12">
          <div class="flex max-w-2xl flex-col gap-4">
            <h2 class="text-3xl/tight font-semibold tracking-tight text-highlighted md:text-4xl/tight">
              Two agents answer you. One set of rules decides what they may say.
            </h2>
            <p class="text-base/7 text-muted">
              Each agent proposes a move from a closed list. The VerifyShield rules on it, and only an approved move gets written out.
            </p>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <article v-for="role in roles" :key="role.name" class="flex flex-col gap-4 rounded-lg border border-default bg-default p-5 shadow-xs">
              <span class="grid size-12 place-items-center overflow-hidden rounded-[4px] border" :class="role.frame">
                <img v-if="role.portrait" :src="role.portrait" alt="" width="48" height="48" class="size-full object-cover [image-rendering:pixelated]">
                <svg v-else viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <h3 class="text-base font-semibold text-highlighted">
                {{ role.name }}
              </h3>
              <p class="text-sm/6 text-muted">
                {{ role.text }}
              </p>
            </article>
          </div>

          <AboutShieldDiagram />
        </div>
      </section>

      <!-- The course roadmap, from the course model. -->
      <section id="course" :class="section" class="bg-slate-50/70">
        <div :class="wrap" class="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div class="flex flex-col gap-4">
            <h2 class="text-3xl/tight font-semibold tracking-tight text-highlighted md:text-4xl/tight">
              Eleven modules, in five parts, one at a time.
            </h2>
            <p class="text-base/7 text-muted">
              The first five are open to study today. Each later module opens when you master the one before it, and stays open after that.
            </p>
            <p class="text-base/7 text-muted">
              Questions about classes, pandas or anything else outside the course get a redirect back to your module, not an answer.
            </p>
          </div>
          <ol class="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            <li v-for="part in parts" :key="part.label" class="flex flex-col gap-2">
              <h3 class="text-xs font-semibold tracking-wide text-muted uppercase">
                {{ part.label }}
              </h3>
              <ul class="flex flex-col gap-1.5">
                <li
                  v-for="module in part.modules"
                  :key="module.number"
                  class="flex items-start gap-3 rounded-md px-3 py-3 text-sm"
                  :class="module.available
                    ? 'bg-white text-highlighted shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9),0px_1px_1px_rgba(0,0,0,0.02)]'
                    : 'bg-slate-100/70 text-muted shadow-[inset_0_0_0_1px_rgba(226,232,240,0.6)]'"
                >
                  <span class="w-5 shrink-0 pt-px font-mono text-xs text-muted">{{ module.number }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-medium">{{ module.name }}</span>
                    <span class="mt-0.5 block text-xs/5 text-muted">{{ module.summary }}</span>
                  </span>
                  <img v-if="!module.available" src="/course-roadmap-lock.svg" alt="Not available yet" width="14" height="14" class="shrink-0 opacity-70">
                  <span v-else class="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">Open</span>
                </li>
              </ul>
            </li>
          </ol>
        </div>
      </section>

      <!-- The team. -->
      <section id="team" :class="section">
        <div :class="wrap" class="flex flex-1 flex-col gap-12">
          <div class="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-16">
            <h2 class="text-3xl/tight font-semibold tracking-tight text-highlighted md:text-4xl/tight">
              Built by team HN9 at Swinburne.
            </h2>
            <div class="flex flex-col gap-3">
              <p class="text-base/7 text-muted">
                Verifiable Co-Learner is our COS40005 capstone project: a study of how AI agents can help first-year students learn to program without taking the learning away from them.
              </p>
              <a :href="repository" class="inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary-700 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-700 md:min-h-0">
                Read the code on GitHub
              </a>
            </div>
          </div>
          <ul class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <li v-for="member in team" :key="member.handle">
              <a
                :href="`https://github.com/${member.handle}`"
                class="group flex h-full flex-col overflow-hidden rounded-lg border border-default bg-default shadow-xs transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <span class="block aspect-square overflow-hidden bg-slate-100">
                  <img
                    :src="`https://github.com/${member.handle}.png?size=480`"
                    :alt="member.name ?? member.handle"
                    width="480"
                    height="480"
                    loading="lazy"
                    class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  >
                </span>
                <span class="block p-4">
                  <span class="block truncate text-base font-semibold text-highlighted">{{ member.name ?? member.handle }}</span>
                  <span class="block truncate text-sm text-muted">{{ member.role ?? `@${member.handle} on GitHub` }}</span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      <!-- Close. -->
      <section id="start" :class="section" class="bg-slate-900 text-white md:justify-center">
        <div :class="wrap" class="flex flex-col items-start gap-8">
          <h2 class="max-w-4xl text-4xl/[1.05] font-semibold tracking-tight md:text-6xl/[1.02]">
            Start with Module 1: {{ firstModule?.name ?? 'Getting Started with Programming and Python' }}.
          </h2>
          <p class="max-w-xl text-base/7 text-slate-300">
            Sign in with your student account, and your module and conversation are waiting where you left them.
          </p>
          <NuxtLink :to="start.to" class="inline-flex min-h-11 items-center justify-center rounded-sm bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-xs hover:bg-indigo-50 max-md:w-full md:min-h-10">
            {{ start.label }}
          </NuxtLink>
        </div>
      </section>
    </main>

    <footer class="border-t border-default bg-default">
      <div :class="wrap" class="flex flex-col gap-3 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p class="flex items-center gap-3">
          <img src="/swinburne-fpt-logo.webp" alt="Swinburne University of Technology, in alliance with FPT Education" width="871" height="705" class="h-20 w-auto">
          COS40005 Capstone Project A, team HN9, Swinburne University of Technology
        </p>
        <a :href="repository" class="inline-flex min-h-11 items-center hover:text-highlighted hover:underline sm:min-h-0">GitHub repository</a>
      </div>
    </footer>
  </div>
</template>
