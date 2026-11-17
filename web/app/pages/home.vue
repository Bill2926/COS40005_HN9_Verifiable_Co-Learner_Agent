<script setup lang="ts">
import { sessionStudentId, studentIdFromAuth } from '#shared/student-id'

// Public: no signed-in middleware. A signed-in student is sent to their workspace instead of sign-in.

// The HN9 team. `handle` gives the GitHub link; a member without one shows only a name.
const team: { handle?: string, name?: string, major: string }[] = [
  { handle: 'atuan1605', name: 'Le Anh Tuan', major: 'Software Development' },
  { handle: 'Bill2926', name: 'Nguyen Duc Manh', major: 'Artificial Intelligence' },
  { handle: 'daotheone', name: 'Nguyen Xuan Doanh', major: 'Software Development' },
  { handle: 'nnqtrung', name: 'Nguyen Quoc Trung', major: 'Cybersecurity' },
  { handle: 'TM22187', name: 'Do Trinh Thuan Minh', major: 'Artificial Intelligence' },
]

const supervisor = {
  name: 'Dr. Le Minh Duc',
  roles: ['Head of Computer Science Department', 'Project supervisor'],
}

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

const roles = [
  {
    name: 'Teacher agent',
    portrait: '/portraits/teacher.png',
    frame: 'border-brand-200 bg-brand-50 shadow-[2px_2px_0_0_var(--color-brand-300)]',
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
    frame: 'border-feature-line bg-feature text-feature-accent',
    text: 'Fixed rules that rule on every proposed move and check every reply before you read it. Each verdict goes into a decision log.',
  },
] as const

useHead({
  title: 'Home',
  meta: [
    { name: 'description', content: 'Verifiable Co-Learner: a co-learner for university students at Swinburne, with a teacher agent, a deskmate agent and a VerifyShield that checks every reply.' },
    { property: 'og:title', content: 'About Verifiable Co-Learner' },
    { property: 'og:description', content: 'A co-learner for your course, with a teacher and a deskmate beside you.' },
  ],
})

const wrap = 'mx-auto w-full max-w-6xl px-4 md:px-8'
const section = 'scroll-mt-16 border-t border-default py-16 md:flex md:min-h-[calc(100dvh-4rem)] md:flex-col md:py-24'
const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-on-accent shadow-xs hover:bg-accent-hover active:bg-accent-hover max-md:w-full md:min-h-10'
const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-sm border border-default bg-default px-4 py-2.5 text-sm font-medium text-highlighted shadow-xs hover:border-ink-300 hover:bg-ink-50 max-md:w-full md:min-h-10'
</script>

<template>
  <div class="min-h-dvh bg-default text-default">
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-default focus:px-3 focus:py-2 focus:text-sm focus:shadow-md">
      Skip to content
    </a>

    <header class="sticky top-0 z-40 border-b border-default/80 bg-default/90 backdrop-blur">
      <div :class="wrap" class="flex h-16 items-center justify-between gap-4">
        <NuxtLink to="/home" class="flex min-h-11 items-center gap-3 text-base font-semibold tracking-tight text-highlighted">
          <img src="/swinburne-fpt-logo.webp" alt="Swinburne University of Technology, in alliance with FPT Education" width="871" height="705" class="block h-10 w-auto shrink-0">
          <span class="max-sm:sr-only">Verifiable Co-Learner</span>
        </NuxtLink>
        <nav aria-label="Home" class="flex items-center gap-1 text-sm">
          <a v-for="link in [{ href: '#how', label: 'How it works' }, { href: '#course', label: 'Course' }, { href: '#team', label: 'Team' }]" :key="link.href" :href="link.href" class="hidden min-h-10 items-center rounded-sm px-3 text-muted hover:bg-ink-100 hover:text-highlighted md:inline-flex">
            {{ link.label }}
          </a>
            <NuxtLink :to="start.to" class="ml-2 inline-flex min-h-11 items-center rounded-sm bg-accent px-3.5 text-sm font-medium text-on-accent shadow-xs hover:bg-accent-hover md:min-h-9">
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
              Built for university courses
            </p>
            <h1 class="about-rise text-4xl/[1.08] font-semibold tracking-tight text-highlighted md:text-5xl/[1.05] xl:text-[3.25rem]/[1.05]" style="--i: 1">
              A co-learner for your course, with a teacher and a deskmate beside you.
            </h1>
            <p class="about-rise max-w-xl text-lg/7 text-muted" style="--i: 2">
              Learn any course step by step with AI agents whose every reply is checked before you see it.
              Your activity in the app is recorded. It is not used to grade you, and no screen shows it.
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
      <section id="why" :class="section" class="bg-ink-50/70">
        <div :class="wrap" class="flex flex-1 flex-col justify-between gap-12">
          <h2 class="text-sm font-medium text-primary-700">
            Why a co-learner
          </h2>
          <p class="max-w-5xl text-5xl/[1.02] font-semibold tracking-tight text-highlighted md:text-7xl/[1] lg:text-8xl/[0.98]">
            Learn deeper, <span class="text-ink-400">not just faster.</span>
          </p>
          <div class="grid gap-8 text-base/7 text-muted md:grid-cols-2 md:gap-12">
            <p>
              An AI that hands over finished answers lets a student pass an exercise without the idea behind it. That shortcut feels like progress and leaves nothing for the exam.
            </p>
            <p>
              Here the agents stay inside the course. The next module opens once your mastery reaches the threshold your lecturer sets, and mastery comes only from the work you submit.
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
      <section id="course" :class="section" class="bg-ink-50/70 md:justify-center">
        <div :class="wrap" class="flex flex-col gap-10 lg:gap-12">
          <div class="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-16">
            <h2 class="text-3xl/tight font-semibold tracking-tight text-highlighted md:text-4xl/tight lg:pt-0.5">
              A step-by-step learning guide.
            </h2>
            <div class="flex flex-col gap-3 text-base/7 text-muted">
              <p>
                Work through your course one module at a time. In each one you learn with the teacher, talk it through with your deskmate and submit your own work.
              </p>
              <p>
                Your mastery grows only from what you submit. When it reaches the threshold your lecturer sets, the next module opens. Questions outside the course get a redirect back to your module.
              </p>
            </div>
          </div>
          <AboutLearningRoadmap />
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
                Verifiable Co-Learner is our COS40005 capstone project: a study of how AI agents can help university students learn without taking the learning away from them.
              </p>
              <a :href="repository" class="inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary-700 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-700 md:min-h-0">
                Read the code on GitHub
              </a>
            </div>
          </div>
          <div class="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-medium text-muted">
                Supervisor
              </h3>
              <div class="flex flex-1 flex-col justify-between gap-8 rounded-lg border border-default bg-default p-6 shadow-xs md:p-8">
                <span class="flex flex-col gap-2">
                  <span class="text-3xl/tight font-semibold tracking-tight text-highlighted">{{ supervisor.name }}</span>
                  <span v-for="line in supervisor.roles" :key="line" class="block text-base text-muted">{{ line }}</span>
                </span>
              </div>
            </div>
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-medium text-muted">
                Our Team Members
              </h3>
              <ul class="flex flex-1 flex-col divide-y divide-default overflow-hidden rounded-lg border border-default bg-default shadow-xs">
                <li v-for="member in team" :key="member.handle ?? member.name" class="flex flex-1">
                  <component
                    :is="member.handle ? 'a' : 'div'"
                    :href="member.handle ? `https://github.com/${member.handle}` : undefined"
                    class="flex min-h-14 w-full items-center justify-between gap-4 px-6 py-3 transition"
                    :class="member.handle && 'hover:bg-ink-50'"
                  >
                    <span class="min-w-0">
                      <span class="block truncate text-base font-semibold text-highlighted">{{ member.name ?? member.handle }}</span>
                      <span class="block text-xs text-muted">{{ member.major }}</span>
                    </span>
                    <span v-if="member.handle" class="shrink-0 text-sm text-muted">@{{ member.handle }} on GitHub</span>
                  </component>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Close. -->
      <section id="start" :class="section" class="bg-feature text-on-feature md:justify-center">
        <div :class="wrap" class="flex flex-col items-start gap-8">
          <h2 class="max-w-4xl text-4xl/[1.05] font-semibold tracking-tight md:text-6xl/[1.02]">
            Start your learning journey today.
          </h2>
          <p class="max-w-xl text-base/7 text-feature-muted">
            Sign in with your student account, and your module and conversation are waiting where you left them.
          </p>
          <NuxtLink :to="start.to" class="inline-flex min-h-11 items-center justify-center rounded-sm bg-on-feature px-5 py-2.5 text-sm font-semibold text-feature shadow-xs hover:bg-feature-muted max-md:w-full md:min-h-10">
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
        <a :href="repository" aria-label="GitHub repository" class="inline-flex size-11 items-center justify-center rounded-sm hover:text-highlighted sm:size-8">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>
        </a>
      </div>
    </footer>
  </div>
</template>
